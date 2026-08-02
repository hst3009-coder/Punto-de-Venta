import { Product, Sale } from '../types';

export interface RestockSuggestion {
  product: Product;
  dailyAvgSales: number;
  daysOfCoverage: number;
  suggestedQty: number;
  totalQtySoldInPeriod: number;
}

export function getRestockSuggestions(
  products: Product[],
  sales: Sale[],
  days: number = 30
): RestockSuggestion[] {
  if (!products || products.length === 0) return [];

  const now = new Date();
  const cutoffTime = now.getTime() - days * 24 * 60 * 60 * 1000;

  // Filter valid non-cancelled sales within the last `days` days
  const recentSales = (sales || []).filter((sale) => {
    if (sale.isCancelled) return false;
    const saleDateStr = sale.date || sale.createdAt;
    if (!saleDateStr) return false;
    const saleTime = new Date(saleDateStr).getTime();
    return !isNaN(saleTime) && saleTime >= cutoffTime;
  });

  // Calculate total units sold per productId
  const qtySoldByProductId: Record<string, number> = {};

  for (const sale of recentSales) {
    if (!sale.items || !Array.isArray(sale.items)) continue;
    for (const item of sale.items) {
      if (!item.product || !item.product.id) continue;
      const pid = item.product.id;
      const unitsPerPkg = item.selectedPackaging?.unitsPerPackage || 1;
      const totalUnits = (item.quantity || 0) * unitsPerPkg;

      qtySoldByProductId[pid] = (qtySoldByProductId[pid] || 0) + totalUnits;
    }
  }

  const suggestions: RestockSuggestion[] = [];

  for (const product of products) {
    // Check visibility and category
    if (product.visible === false) continue;
    if (product.category === 'Genérico') continue;

    const totalQtySold = qtySoldByProductId[product.id] || 0;
    const dailyAvgSales = totalQtySold / Math.max(1, days);

    // If daily average sales is 0, coverage is infinite / N/A -> exclude
    if (dailyAvgSales <= 0) continue;

    const currentStock = Math.max(0, product.stock || 0);
    const daysOfCoverage = currentStock / dailyAvgSales;

    // Filter products with less than 7 days of coverage
    if (daysOfCoverage < 7) {
      const suggestedQty = Math.max(
        1,
        Math.ceil(dailyAvgSales * 30 - currentStock)
      );

      suggestions.push({
        product,
        dailyAvgSales,
        daysOfCoverage,
        suggestedQty,
        totalQtySoldInPeriod: totalQtySold,
      });
    }
  }

  // Sort from most urgent (fewer days of coverage) to least urgent
  suggestions.sort((a, b) => a.daysOfCoverage - b.daysOfCoverage);

  return suggestions;
}
