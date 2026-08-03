import { Product, ClientPriceList } from '../types';

/**
 * Calculates the price of a product for a specific client price list.
 * - Base price without tax: product.cost * (1 + list.profitPercent / 100)
 * - If product is NOT taxExempt: finalPrice = basePrice * 1.18
 * - If product IS taxExempt: finalPrice = basePrice
 * - Always rounded up to the nearest integer peso: Math.ceil(finalPrice)
 */
export function getListPrice(product: Product, list: ClientPriceList): number {
  if (!list || typeof list.profitPercent !== 'number') {
    return product.price;
  }

  const cost = product.cost || 0;
  if (cost <= 0) {
    return product.price;
  }
  const basePrice = cost * (1 + list.profitPercent / 100);
  const finalPrice = product.taxExempt ? basePrice : basePrice * 1.18;

  return Math.ceil(finalPrice);
}
