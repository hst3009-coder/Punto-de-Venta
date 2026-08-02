import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Sale, CardDeposit, DashboardConfig, isMixedSale } from '../types';
import { getNextBusinessDay } from '../lib/businessDays';
import { roundCents } from '../lib/money';
import { firestoreService } from '../lib/firebase';

interface UseCardDepositGeneratorProps {
  isOpen: boolean;
  sales: Sale[];
  cardDeposits: CardDeposit[];
  dashboardConfig?: DashboardConfig;
}

export function useCardDepositGenerator({
  isOpen,
  sales,
  cardDeposits,
  dashboardConfig,
}: UseCardDepositGeneratorProps) {
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || sales.length === 0) return;

    const generateMissingCardDeposits = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        // 1. Group sales by YYYY-MM-DD
        const cardSalesByDate: Record<string, number> = {};

        sales.forEach((sale) => {
          if (!sale.createdAt) return;
          const dateStr = sale.createdAt.substring(0, 10); // YYYY-MM-DD
          if (sale.paymentMethod === 'card') {
            cardSalesByDate[dateStr] = (cardSalesByDate[dateStr] || 0) + sale.total;
          } else if (isMixedSale(sale)) {
            const cardAmount = sale.paymentBreakdown
              .filter((b) => b.method === 'card')
              .reduce((sum, b) => sum + b.amount, 0);
            if (cardAmount > 0) {
              cardSalesByDate[dateStr] = (cardSalesByDate[dateStr] || 0) + cardAmount;
            }
          }
        });

        // Operations array for batch
        const ops: any[] = [];

        // 2. Process each date we have card sales for
        Object.entries(cardSalesByDate).forEach(([dateStr, calculatedGross]) => {
          const depositsForDate = cardDeposits.filter((d) => d.batchDate === dateStr);

          if (depositsForDate.length === 0) {
            // Create new CardDeposit
            const feePercent = dashboardConfig?.cardFeePercent ?? 3.8;
            const netAmount = roundCents(calculatedGross * (1 - feePercent / 100));

            const parsedDate = new Date(dateStr + 'T00:00:00');
            const expectedDepositDateDate = getNextBusinessDay(
              parsedDate,
              dashboardConfig?.holidays ?? []
            );
            const expectedDepositDate = format(expectedDepositDateDate, 'yyyy-MM-dd');

            const newDeposit: CardDeposit = {
              id: `deposit_${dateStr}_${Date.now()}`,
              batchDate: dateStr,
              expectedDepositDate,
              grossAmount: calculatedGross,
              feePercent,
              netAmount,
              status: 'pending',
              createdAt: new Date().toISOString(),
            };

            ops.push({
              type: 'set' as const,
              collectionName: 'cardDeposits',
              id: newDeposit.id,
              data: newDeposit,
            });
          } else {
            // Update any existing 'pending' deposits if the gross amount has changed
            depositsForDate.forEach((deposit) => {
              if (deposit.status === 'pending' && deposit.grossAmount !== calculatedGross) {
                const newNetAmount = roundCents(calculatedGross * (1 - deposit.feePercent / 100));

                ops.push({
                  type: 'update' as const,
                  collectionName: 'cardDeposits',
                  id: deposit.id,
                  data: {
                    grossAmount: calculatedGross,
                    netAmount: newNetAmount,
                  },
                });
              }
            });
          }
        });

        if (ops.length === 0) return;

        await firestoreService.runBatch(ops);
        console.log(`Auto-processed ${ops.length} card deposit operations.`);
      } catch (err) {
        console.error('Error auto-processing card deposits:', err);
      } finally {
        isProcessingRef.current = false;
      }
    };

    generateMissingCardDeposits();
  }, [isOpen, sales, cardDeposits, dashboardConfig]);
}
