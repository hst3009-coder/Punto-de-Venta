import { Product } from '../types';
import {
  normalizeSearchText,
  normalizeString,
  levenshteinDistance,
  isFuzzyMatch,
} from './textSearch';

export { normalizeSearchText, normalizeString, levenshteinDistance, isFuzzyMatch };

export function isFuzzyNameMatch(productName: string, searchQuery: string): boolean {
  return isFuzzyMatch(searchQuery, productName);
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

export function matchesProductExactOrSubstring(
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

export function sortProductsEmptySearch(
  products: Product[],
  monthlySalesCount?: Map<string, number>,
  abcMap?: Map<string, 'A' | 'B' | 'C'>,
  hasAbcHistory?: boolean,
  recentSalesCount?: Map<string, number>
): Product[] {
  // 1. Si hay ventas registradas en lo que va del mes actual, ordena los productos de más vendidos a menos vendidos.
  let totalMonthlyUnits = 0;
  if (monthlySalesCount && monthlySalesCount.size > 0) {
    for (const qty of monthlySalesCount.values()) {
      if (qty > 0) {
        totalMonthlyUnits += qty;
      }
    }
  }

  if (totalMonthlyUnits > 0 && monthlySalesCount) {
    return [...products].sort((a, b) => {
      const salesA = monthlySalesCount.get(a.id) || 0;
      const salesB = monthlySalesCount.get(b.id) || 0;
      if (salesA !== salesB) {
        return salesB - salesA;
      }
      return compareProductsNatural(a, b, recentSalesCount);
    });
  }

  // 2. Si NO hay ventas este mes (negocio nuevo, o inicio de mes), ordena por clasificación ABC (los de categoría A primero, luego B, luego C)
  const abcOrder: Record<'A' | 'B' | 'C', number> = { A: 1, B: 2, C: 3 };
  if (hasAbcHistory && abcMap && abcMap.size > 0) {
    return [...products].sort((a, b) => {
      const classA = abcMap.get(a.id) || 'C';
      const classB = abcMap.get(b.id) || 'C';
      if (classA !== classB) {
        return abcOrder[classA] - abcOrder[classB];
      }
      return compareProductsNatural(a, b, recentSalesCount);
    });
  }

  // 3. Respaldo final: compareProductsNatural
  return [...products].sort((a, b) => compareProductsNatural(a, b, recentSalesCount));
}

export function rankSearchResults(
  products: Product[],
  query: string,
  recentSalesCount?: Map<string, number>,
  monthlySalesCount?: Map<string, number>,
  abcMap?: Map<string, 'A' | 'B' | 'C'>,
  hasAbcHistory?: boolean
): Product[] {
  const queryClean = query.trim();
  if (!queryClean) {
    return sortProductsEmptySearch(products, monthlySalesCount, abcMap, hasAbcHistory, recentSalesCount);
  }

  // Paso 1: Primero calculamos los resultados exactos/substring sobre todo el catálogo
  const exactOrSubstringMatches = products.filter((p) => matchesProductExactOrSubstring(p, queryClean));

  // Paso 2: Solo si ese conjunto está vacío, se corre la búsqueda difusa como segundo paso
  const isFuzzyPool = exactOrSubstringMatches.length === 0;
  const candidatePool = !isFuzzyPool
    ? exactOrSubstringMatches
    : products.filter((p) => isFuzzyNameMatch(p.name || '', queryClean));

  if (isFuzzyPool) {
    return candidatePool.sort((a, b) => compareProductsNatural(a, b, recentSalesCount));
  }

  const isNumericQuery = /^\d+$/.test(queryClean);

  if (isNumericQuery) {
    const startsWithCode: Product[] = [];
    const containsCode: Product[] = [];
    const otherMatches: Product[] = [];

    candidatePool.forEach((p) => {
      const cleanBarcode = p.barcode ? p.barcode.trim().replace(/^0+/, '') : '';
      const cleanId = p.id ? p.id.trim().replace(/^0+/, '') : '';
      const cleanCode = p.code ? p.code.trim().replace(/^0+/, '') : '';
      const cleanSku = p.sku ? p.sku.trim().replace(/^0+/, '') : '';
      const cleanQuery = queryClean.replace(/^0+/, '').toLowerCase();

      const codes = [cleanBarcode, cleanId, cleanCode, cleanSku]
        .filter(Boolean)
        .map((c) => c.toLowerCase());

      if (codes.some((c) => c.startsWith(cleanQuery))) {
        startsWithCode.push(p);
      } else if (codes.some((c) => c.includes(cleanQuery))) {
        containsCode.push(p);
      } else {
        otherMatches.push(p);
      }
    });

    return [
      ...startsWithCode.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
      ...containsCode.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
      ...otherMatches.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
    ];
  }

  // Non-numeric queries
  const normQuery = normalizeString(queryClean);
  const startsWithName: Product[] = [];
  const containsName: Product[] = [];
  const otherMatches: Product[] = [];

  candidatePool.forEach((p) => {
    const normName = normalizeString(p.name || '');
    if (normName.startsWith(normQuery)) {
      startsWithName.push(p);
    } else if (normName.includes(normQuery)) {
      containsName.push(p);
    } else {
      otherMatches.push(p);
    }
  });

  return [
    ...startsWithName.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
    ...containsName.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
    ...otherMatches.sort((a, b) => compareProductsNatural(a, b, recentSalesCount)),
  ];
}

export function matchesProductSearch(
  product: { name: string; category: string; barcode?: string; id: string; code?: string; sku?: string },
  searchQuery: string,
  allowFuzzy: boolean = true
): boolean {
  if (matchesProductExactOrSubstring(product, searchQuery)) {
    return true;
  }
  if (!allowFuzzy) return false;
  const queryClean = searchQuery.trim();
  if (!queryClean) return true;
  return isFuzzyNameMatch(product.name || '', queryClean);
}
