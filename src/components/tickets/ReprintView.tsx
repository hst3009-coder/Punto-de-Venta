import React from 'react';
import { Sale, PaymentMethod, StoreIdentity, CartItem, DashboardConfig, isMixedSale, Closure, Customer } from '../../types';
import { Receipt, Undo2, Printer, Edit, Coins, CreditCard, Wallet, QrCode } from 'lucide-react';
import { ReceiptTemplate } from '../ReceiptTemplate';
import { isEventWithinClosedShift } from '../../lib/dashboardCalculations';
import { getSaleTimestamp } from '../../lib/dates';

export interface ReprintViewProps {
  selectedSale: Sale | null;
  activeReceiptView: 'original' | 'return';
  setActiveReceiptView: (view: 'original' | 'return') => void;
  clerkName: string;
  storeIdentity: StoreIdentity;
  dashboardConfig?: DashboardConfig;
  customers?: Customer[];
  closures?: Closure[];
  isEditingPayment: boolean;
  setIsEditingPayment: (editing: boolean) => void;
  getPaymentBadge: (method: PaymentMethod) => React.ReactNode;
  handleOpenItemReturn: (item: CartItem) => void;
}

export const ReprintView: React.FC<ReprintViewProps> = ({
  selectedSale,
  activeReceiptView,
  setActiveReceiptView,
  clerkName,
  storeIdentity,
  dashboardConfig,
  customers = [],
  closures = [],
  isEditingPayment,
  setIsEditingPayment,
  getPaymentBadge,
  handleOpenItemReturn,
}) => {
  if (!selectedSale) {
    return (
      <div className="w-1/2 flex flex-col bg-slate-50 overflow-y-auto">
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mb-4 border border-slate-200">
            <Receipt className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-700 text-base">Factura no seleccionada</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Seleccione una factura de la lista de la izquierda para ver su contenido, modificar el pago, imprimir o realizar devoluciones.
          </p>
        </div>
      </div>
    );
  }

  // Determine if sale is editable: sale is NOT cancelled AND NOT within a closed shift
  const isSaleEditable = Boolean(
    selectedSale &&
    !selectedSale.isCancelled &&
    !isEventWithinClosedShift(selectedSale.soldBy?.id, getSaleTimestamp(selectedSale), closures)
  );

  return (
    <div className="w-1/2 flex flex-col bg-slate-50 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Mode Selector Toggle */}
        <div className="bg-white p-1 rounded-xl border border-slate-200 grid grid-cols-2 text-center shrink-0">
          <button
            onClick={() => setActiveReceiptView('original')}
            className={`py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeReceiptView === 'original'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 cursor-pointer'
            }`}
          >
            <Receipt className="w-4 h-4" /> Factura Original
          </button>
          <button
            onClick={() => setActiveReceiptView('return')}
            disabled={!selectedSale.isCancelled && !((selectedSale as any).returnedItems && (selectedSale as any).returnedItems.length > 0)}
            className={`py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeReceiptView === 'return'
                ? 'bg-indigo-600 text-white shadow-xs'
                : selectedSale.isCancelled || ((selectedSale as any).returnedItems && (selectedSale as any).returnedItems.length > 0)
                ? 'text-slate-500 hover:text-slate-800 cursor-pointer'
                : 'text-slate-300 cursor-not-allowed bg-slate-50'
            }`}
          >
            <Undo2 className="w-4 h-4" /> Ticket de Devolución
          </button>
        </div>

        {/* Receipt Thermal container */}
        <div className="flex justify-center">
          <ReceiptTemplate
            sale={selectedSale}
            clerkName={clerkName}
            storeIdentity={storeIdentity}
            ticketConfig={dashboardConfig?.ticketConfig}
            viewType={activeReceiptView}
          />
        </div>

        {/* --- OPERATIONS / EDITING PANEL --- */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-xs">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Acciones Rápidas del Administrador
          </h4>

          {/* 1. PRINT BUTTON */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs border border-slate-200"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              {activeReceiptView === 'original' ? 'Reimprimir Factura' : 'Imprimir Reembolso'}
            </button>
          </div>

          {/* 2. PAYMENT METHOD & CUSTOMER EDITOR */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                <Edit className="w-3.5 h-3.5 text-indigo-500" /> Método de Pago y Cliente:
              </span>
              {isSaleEditable && (
                <button
                  type="button"
                  onClick={() => setIsEditingPayment(true)}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 hover:underline cursor-pointer"
                >
                  Editar Pago
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-150 flex justify-between items-center">
                <span>Cliente:</span>
                <span className="font-extrabold text-slate-800">
                  {selectedSale.customerName || 'Público General'}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-150 flex justify-between items-center">
                <span>Registrado como:</span>
                {getPaymentBadge(selectedSale.paymentMethod)}
              </div>

              {isMixedSale(selectedSale) && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 space-y-1 text-xs">
                  <span className="text-[10px] font-black uppercase text-amber-800 block mb-1">
                    Desglose de Pago Mixto:
                  </span>
                  {selectedSale.paymentBreakdown.map((b, i) => (
                    <div key={b.id || i} className="flex justify-between font-semibold text-slate-700">
                      <span>
                        {b.method === 'cash'
                          ? '💵 Efectivo'
                          : b.method === 'card'
                          ? '💳 Tarjeta'
                          : b.method === 'transfer'
                          ? '🏦 Transferencia'
                          : b.method === 'credit'
                          ? '👥 Crédito'
                          : '🏷️ Nota de Crédito'}
                        :
                      </span>
                      <span>RD$ {b.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. ITEM-BY-ITEM RETURNS */}
          {activeReceiptView === 'original' && !selectedSale.isCancelled && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                  <Undo2 className="w-3.5 h-3.5 text-rose-500" /> Devolución de Artículos Individuales:
                </span>
              </div>

              <div className="space-y-2">
                {selectedSale.items.map((item, idx) => {
                  const returned =
                    (selectedSale as any).returnedItems
                      ?.filter((r: any) => r.productId === item.product.id)
                      ?.reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;

                  const remaining = item.quantity - returned;
                  const isFullyReturned = remaining <= 0;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl border border-slate-150 bg-slate-50/50"
                    >
                      <div className="min-w-0 flex-1">
                        <span
                          className={`font-bold block truncate text-slate-800 ${
                            isFullyReturned ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {item.product.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold block">
                          Precio: ${item.product.price.toFixed(2)} | Comprados: {item.quantity}{' '}
                          {returned > 0 && `(${returned} dev.)`}
                        </span>
                      </div>

                      {isFullyReturned ? (
                        <span className="bg-slate-100 text-slate-400 font-bold text-[9px] py-1 px-2.5 rounded-lg border border-slate-200">
                          Completado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenItemReturn(item)}
                          className="py-1 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                        >
                          Devolver
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancel warning if fully cancelled */}
          {selectedSale.isCancelled && (
            <div className="bg-rose-50 border border-rose-150 p-3.5 rounded-xl text-xs text-rose-800 font-semibold space-y-1">
              <span className="font-extrabold block">🚫 Esta Factura ha sido Cancelada</span>
              <p className="text-[10px] text-rose-700/90 leading-normal font-medium">
                La mercancía correspondiente ha sido devuelta automáticamente al inventario activo. Puede reimprimir el comprobante de reembolso en cualquier momento seleccionando la pestaña "Ticket de Devolución".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
