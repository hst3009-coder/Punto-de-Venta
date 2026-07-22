import { Product } from '../types';

export function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function compareProductsNatural(a: Product, b: Product, recentSalesCount?: Map<string, number>): number {
  const nameA = a.name || '';
  const nameB = b.name || '';

  const startsWithLetter = (s: string) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(s);
  
  const aLetter = startsWithLetter(nameA);
  const bLetter = startsWithLetter(nameB);

  // If one starts with letter and other doesn't, letter comes first
  if (aLetter && !bLetter) return -1;
  if (!aLetter && bLetter) return 1;

  // Natural alphabetical/numeric sort
  const comp = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  if (comp !== 0) return comp;

  // Tie-breaker by recent sales if map provided
  if (recentSalesCount) {
    const salesA = recentSalesCount.get(a.id) || 0;
    const salesB = recentSalesCount.get(b.id) || 0;
    if (salesA !== salesB) {
      return salesB - salesA; // Desempate: prioridad al que más se vendió
    }
  }

  return 0;
}

export function rankSearchResults(
  products: Product[],
  query: string,
  recentSalesCount?: Map<string, number>
): Product[] {
  const queryClean = query.trim();
  if (!queryClean) return [...products].sort((a, b) => compareProductsNatural(a, b, recentSalesCount));

  const isNumericQuery = /^\d+$/.test(queryClean);

  if (isNumericQuery) {
    const startsWithCode: Product[] = [];
    const containsCode: Product[] = [];
    const others: Product[] = [];

    products.forEach(p => {
      const cleanBarcode = p.barcode ? p.barcode.trim().replace(/^0+/, '') : '';
      const cleanId = p.id ? p.id.trim().replace(/^0+/, '') : '';
      const cleanCode = p.code ? p.code.trim().replace(/^0+/, '') : '';
      const cleanSku = p.sku ? p.sku.trim().replace(/^0+/, '') : '';
      const cleanQuery = queryClean.replace(/^0+/, '').toLowerCase();

      const codes = [cleanBarcode, cleanId, cleanCode, cleanSku]
        .filter(Boolean)
        .map(c => c.toLowerCase());

      if (codes.some(c => c.startsWith(cleanQuery))) {
        startsWithCode.push(p);
      } else if (codes.some(c => c.includes(cleanQuery))) {
        containsCode.push(p);
      } else {
        others.push(p);
      }
    });

    return [
      ...startsWithCode.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
      ...containsCode.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
      ...others.sort((a, b) => compareProductsNatural(a, b, recentSalesCount))
    ];
  }

  // Non-numeric queries
  const normQuery = normalizeString(queryClean);
  const startsWithName: Product[] = [];
  const containsName: Product[] = [];
  const others: Product[] = [];

  products.forEach(p => {
    const normName = normalizeString(p.name || '');
    if (normName.startsWith(normQuery)) {
      startsWithName.push(p);
    } else if (normName.includes(normQuery)) {
      containsName.push(p);
    } else {
      others.push(p);
    }
  });

  return [
    ...startsWithName.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
    ...containsName.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
    ...others.sort((a, b) => compareProductsNatural(a, b, recentSalesCount))
  ];
}

export function matchesProductSearch(
  product: { name: string; category: string; barcode?: string; id: string; code?: string; sku?: string },
  searchQuery: string
): boolean {
  const queryClean = searchQuery.trim();
  if (!queryClean) return true;

  // 1. Exact code / barcode match (ignoring leading zeros)
  const cleanBarcode = product.barcode ? product.barcode.trim().replace(/^0+/, '') : '';
  const cleanId = product.id ? product.id.trim().replace(/^0+/, '') : '';
  const cleanCode = product.code ? product.code.trim().replace(/^0+/, '') : '';
  const cleanSku = product.sku ? product.sku.trim().replace(/^0+/, '') : '';
  const cleanQueryCode = queryClean.replace(/^0+/, '');

  const isExactCodeMatch =
    (cleanBarcode && cleanBarcode === cleanQueryCode) ||
    (cleanId && cleanId === cleanQueryCode) ||
    (cleanCode && cleanCode === cleanQueryCode) ||
    (cleanSku && cleanSku === cleanQueryCode);

  if (isExactCodeMatch) {
    return true;
  }

  // 2. Dynamic token match for name & category (ignoring tildes and word order)
  const normalizedQuery = normalizeString(queryClean);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return true;

  const normalizedName = normalizeString(product.name || '');
  const normalizedCategory = normalizeString(product.category || '');
  const normalizedCode = normalizeString(product.code || '');
  const normalizedSku = normalizeString(product.sku || '');
  const combinedText = `${normalizedName} ${normalizedCategory} ${normalizedCode} ${normalizedSku}`;

  return tokens.every((token) => combinedText.includes(token));
}
