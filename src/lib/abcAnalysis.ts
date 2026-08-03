import { Product, Sale } from '../types';

export interface ABCAnalysisResult {
  abcMap: Map<string, 'A' | 'B' | 'C'>;
  hasHistory: boolean;
  productRevenues: Map<string, number>;
}

export function calculateABCClassification(
  products: Product[],
  sales: Sale[]
): ABCAnalysisResult {
  const productRevenues = new Map<string, number>();
  let totalRevenue = 0;

  sales.forEach((sale) => {
    if (sale.isCancelled) return;
    sale.items?.forEach((item) => {
      if (item.product?.id) {
        const pId = item.product.id;
        const price = item.product.price || 0;
        const qty = item.quantity || 1;
        const revenue = price * qty;
        productRevenues.set(pId, (productRevenues.get(pId) || 0) + revenue);
        totalRevenue += revenue;
      }
    });
  });

  const abcMap = new Map<string, 'A' | 'B' | 'C'>();

  if (totalRevenue <= 0 || productRevenues.size === 0) {
    products.forEach((p) => abcMap.set(p.id, 'C'));
    return { abcMap, hasHistory: false, productRevenues };
  }

  // Sort product IDs by revenue descending
  const sorted = Array.from(productRevenues.entries()).sort((a, b) => b[1] - a[1]);

  let accumulated = 0;
  sorted.forEach(([pId, rev]) => {
    accumulated += rev;
    const pct = accumulated / totalRevenue;
    if (pct <= 0.80) {
      abcMap.set(pId, 'A');
    } else if (pct <= 0.95) {
      abcMap.set(pId, 'B');
    } else {
      abcMap.set(pId, 'C');
    }
  });

  products.forEach((p) => {
    if (!abcMap.has(p.id)) {
      abcMap.set(p.id, 'C');
    }
  });

  return { abcMap, hasHistory: true, productRevenues };
}
