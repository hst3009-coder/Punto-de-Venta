import { Category, Product } from '../types';

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getPreTaxAmount(price: number, taxExempt: boolean | undefined): number {
  if (taxExempt) {
    return price;
  }
  return roundCents(price / 1.18);
}

export function roundUpToNearestFive(value: number): number {
  // If value has no decimal part, return it without changes
  if (value % 1 === 0) {
    return value;
  }
  // If it has a decimal part, round up to the nearest multiple of 5
  return roundCents(Math.ceil(value / 5) * 5);
}

export function getCategoryProfitTarget(
  catIdentifier: any,
  categoryProfitTargets?: Record<string, number>,
  categoriesList?: Category[]
): number | undefined {
  if (!categoryProfitTargets || !catIdentifier) return undefined;

  let str = '';
  if (typeof catIdentifier === 'string') {
    str = catIdentifier;
  } else if (typeof catIdentifier === 'object' && catIdentifier !== null) {
    str = catIdentifier.name || catIdentifier.id || '';
  } else {
    str = String(catIdentifier);
  }

  const trimmed = str.trim();
  if (!trimmed) return undefined;

  // 1. Direct key match
  if (typeof categoryProfitTargets[trimmed] === 'number') {
    return categoryProfitTargets[trimmed];
  }

  // 2. Lookup via category object (id vs name)
  const catObj = categoriesList?.find(
    (c) => c.id.toLowerCase() === trimmed.toLowerCase() ||
           c.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (catObj) {
    if (typeof categoryProfitTargets[catObj.name] === 'number') {
      return categoryProfitTargets[catObj.name];
    }
    if (typeof categoryProfitTargets[catObj.id] === 'number') {
      return categoryProfitTargets[catObj.id];
    }
  }

  // 3. Case insensitive key lookup
  const lowerCat = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(categoryProfitTargets)) {
    if (key.toLowerCase() === lowerCat && typeof val === 'number') {
      return val;
    }
  }

  return undefined;
}

export function isProductBelowTargetProfit(
  product: Product,
  categoryProfitTargets?: Record<string, number>,
  categoriesList?: Category[]
): { isBelow: boolean; actualMargin: number; targetMargin: number; diff: number } {
  const cost = product.cost || 0;
  if (cost <= 0) {
    return { isBelow: false, actualMargin: 0, targetMargin: 0, diff: 0 };
  }

  const targetMargin = getCategoryProfitTarget(product.category, categoryProfitTargets, categoriesList);
  if (targetMargin === undefined || isNaN(targetMargin)) {
    return { isBelow: false, actualMargin: 0, targetMargin: 0, diff: 0 };
  }

  const pricePreTax = getPreTaxAmount(product.price, product.taxExempt);
  const actualMargin = ((pricePreTax - cost) / cost) * 100;
  const diff = targetMargin - actualMargin;

  return {
    isBelow: diff >= 5,
    actualMargin,
    targetMargin,
    diff,
  };
}

