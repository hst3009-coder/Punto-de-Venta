import { CartItem } from '../types';
import { getPreTaxAmount, roundCents } from './money';
import { getCartItemKey } from './bulkPricing';

export interface ItemOverrideCalculation {
  itemKey: string;
  productName: string;
  quantity: number;
  currentUnitPrice: number;
  proposedUnitPrice: number;
  cost: number;
  hasCost: boolean;
  minUnitPrice: number;
  marginPct: number;
  fails: boolean;
  isFixed: boolean;
}

export interface CartTotalOverrideResult {
  itemCalculations: ItemOverrideCalculation[];
  failingItems: ItemOverrideCalculation[];
  hasFailingItems: boolean;
  suggestedMinTotal: number;
  isValidTotalInput: boolean;
  totalDiff: number;
  deltaPerUnit: number;
  errorMessage: string | null;
  isValid: boolean;
}

export function calculateWaterFillingCartTotalOverride(
  cartItems: CartItem[],
  proposedTotal: number
): CartTotalOverrideResult {
  const isValidTotalInput = !isNaN(proposedTotal) && proposedTotal > 0;

  const currentSubtotalSum = cartItems.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );
  const totalUnits = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const totalDiff = isValidTotalInput ? proposedTotal - currentSubtotalSum : 0;
  const deltaPerUnit = totalUnits > 0 ? totalDiff / totalUnits : 0;

  // Prepare item metadata
  const itemsMeta = cartItems.map((item) => {
    const itemKey = getCartItemKey(item.product.id, item.packagingId);
    const originalUnitPrice = item.product.price;
    const cost = item.product.cost || 0;
    const hasCost = cost > 0;

    let minUnitPrice = 0;
    if (hasCost) {
      const minPreTax = cost * 1.15;
      minUnitPrice = item.product.taxExempt ? minPreTax : minPreTax * 1.18;
      minUnitPrice = roundCents(minUnitPrice);
    }

    return {
      itemKey,
      productName: item.product.name,
      quantity: item.quantity,
      originalUnitPrice,
      cost,
      hasCost,
      minUnitPrice,
      taxExempt: item.product.taxExempt,
    };
  });

  // Calculate absolute minimum total possible (all items at min 15% price)
  const absoluteMinTotal = roundCents(
    itemsMeta.reduce((sum, item) => sum + item.minUnitPrice * item.quantity, 0)
  );

  if (!isValidTotalInput) {
    return {
      itemCalculations: itemsMeta.map((item) => ({
        itemKey: item.itemKey,
        productName: item.productName,
        quantity: item.quantity,
        currentUnitPrice: item.originalUnitPrice,
        proposedUnitPrice: item.originalUnitPrice,
        cost: item.cost,
        hasCost: item.hasCost,
        minUnitPrice: item.minUnitPrice,
        marginPct: 0,
        fails: false,
        isFixed: false,
      })),
      failingItems: [],
      hasFailingItems: false,
      suggestedMinTotal: absoluteMinTotal,
      isValidTotalInput: false,
      totalDiff: 0,
      deltaPerUnit: 0,
      errorMessage: 'Por favor ingresa un monto total mayor a 0',
      isValid: false,
    };
  }

  // Water-filling round algorithm
  // 1. Start with ALL items in freeIndices, none in fixedIndices
  const freeIndices = new Set<number>(itemsMeta.map((_, idx) => idx));
  const fixedIndices = new Set<number>();

  const finalProposedPrices = new Array<number>(itemsMeta.length).fill(0);

  while (true) {
    // a. Sum of fixed items at min 15% price
    let sumaFijados = 0;
    fixedIndices.forEach((idx) => {
      sumaFijados += itemsMeta[idx].minUnitPrice * itemsMeta[idx].quantity;
    });

    // b. Sum of free items at original price
    let sumaLibresOriginal = 0;
    let unidadesLibresTotales = 0;
    freeIndices.forEach((idx) => {
      sumaLibresOriginal += itemsMeta[idx].originalUnitPrice * itemsMeta[idx].quantity;
      unidadesLibresTotales += itemsMeta[idx].quantity;
    });

    // If freeIndices is empty, all items are fixed to min price!
    if (freeIndices.size === 0) {
      itemsMeta.forEach((item, idx) => {
        finalProposedPrices[idx] = item.minUnitPrice;
      });
      break;
    }

    // c. Remaining adjustment needed for free items
    const ajusteRestante = proposedTotal - sumaFijados - sumaLibresOriginal;
    const deltaPerFreeUnit = unidadesLibresTotales > 0 ? ajusteRestante / unidadesLibresTotales : 0;

    // d. Check tentative prices for free items
    const newlyViolatingIndices: number[] = [];
    freeIndices.forEach((idx) => {
      const item = itemsMeta[idx];
      const tentativeUnitPrice = roundCents(item.originalUnitPrice + deltaPerFreeUnit);

      // e. If tentative price goes below 15% min price floor
      if (item.hasCost && tentativeUnitPrice < item.minUnitPrice - 0.001) {
        newlyViolatingIndices.push(idx);
      }
    });

    // e. If any free item violates floor, move violating items to fixed and repeat round
    if (newlyViolatingIndices.length > 0) {
      newlyViolatingIndices.forEach((idx) => {
        freeIndices.delete(idx);
        fixedIndices.add(idx);
      });
      // Repeat round
    } else {
      // f. None violates floor! Stable solution reached!
      freeIndices.forEach((idx) => {
        const item = itemsMeta[idx];
        finalProposedPrices[idx] = roundCents(item.originalUnitPrice + deltaPerFreeUnit);
      });
      fixedIndices.forEach((idx) => {
        const item = itemsMeta[idx];
        finalProposedPrices[idx] = item.minUnitPrice;
      });
      break;
    }
  }

  // Build ItemOverrideCalculation results
  const itemCalculations: ItemOverrideCalculation[] = itemsMeta.map((item, idx) => {
    const proposedUnitPrice = finalProposedPrices[idx];
    let marginPct = 0;
    let fails = false;

    if (item.hasCost) {
      const preTax = getPreTaxAmount(proposedUnitPrice, item.taxExempt);
      marginPct = ((preTax - item.cost) / item.cost) * 100;

      if (proposedUnitPrice < item.minUnitPrice - 0.001 || marginPct < 15 - 0.01) {
        fails = true;
      }
    }

    return {
      itemKey: item.itemKey,
      productName: item.productName,
      quantity: item.quantity,
      currentUnitPrice: item.originalUnitPrice,
      proposedUnitPrice,
      cost: item.cost,
      hasCost: item.hasCost,
      minUnitPrice: item.minUnitPrice,
      marginPct,
      fails,
      isFixed: fixedIndices.has(idx),
    };
  });

  const failingItems = itemCalculations.filter((calc) => calc.fails);
  const isAllFixedAndBelow = freeIndices.size === 0 && proposedTotal < absoluteMinTotal;
  const hasFailingItems = failingItems.length > 0 || isAllFixedAndBelow;

  const suggestedMinTotal = absoluteMinTotal;

  let errorMessage: string | null = null;
  let isValid = false;

  if (hasFailingItems) {
    const count = failingItems.length > 0 ? failingItems.length : cartItems.length;
    errorMessage = `No se puede aplicar este total porque ${count} producto(s) quedarían por debajo del 15% de margen mínimo sobre el costo.`;
  } else {
    isValid = true;
  }

  return {
    itemCalculations,
    failingItems,
    hasFailingItems,
    suggestedMinTotal,
    isValidTotalInput: true,
    totalDiff,
    deltaPerUnit,
    errorMessage,
    isValid,
  };
}
