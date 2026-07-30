import { Product, BulkTier, ClientPriceList, ProductPackaging } from '../types';
import { getListPrice } from './priceLists';

export interface EffectivePriceInfo {
  unitPrice: number;
  appliedType: 'standard' | 'price_list' | 'bulk_pricing' | 'packaging' | 'price_override';
  originalCatalogPrice: number;
  bulkTierApplied?: BulkTier;
  appliedPriceListName?: string;
  priceOverrideApplied?: number;
}

/**
 * Validates bulk pricing tiers for a product.
 * Each tier must have minQuantity > 1, and be strictly increasing in minQuantity while strictly decreasing in price.
 */
export function validateBulkTiers(tiers: BulkTier[], basePrice: number): string | null {
  if (!tiers || tiers.length === 0) return null;

  // Sort ascending by minQuantity
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];

    if (isNaN(tier.minQuantity) || tier.minQuantity <= 1) {
      return 'La cantidad mínima para un precio por volumen debe ser al menos de 2 unidades.';
    }

    if (isNaN(tier.price) || tier.price <= 0) {
      return 'El precio por volumen debe ser un valor numérico positivo mayor a 0.';
    }

    if (i === 0) {
      if (tier.price >= basePrice) {
        return `El primer escalón (${tier.minQuantity}+ u.) debe tener un precio (RD$ ${tier.price.toFixed(2)}) menor al precio normal del producto (RD$ ${basePrice.toFixed(2)}).`;
      }
    } else {
      const prevTier = sorted[i - 1];

      if (tier.minQuantity <= prevTier.minQuantity) {
        return `No pueden existir dos escalones con la misma o menor cantidad mínima (${tier.minQuantity} u. vs ${prevTier.minQuantity} u.).`;
      }

      if (tier.price >= prevTier.price) {
        return `El escalón de ${tier.minQuantity}+ unidades debe tener un precio (RD$ ${tier.price.toFixed(2)}) menor al escalón de ${prevTier.minQuantity}+ u. (RD$ ${prevTier.price.toFixed(2)}).`;
      }
    }
  }

  return null;
}

/**
 * Calculates the effective unit price and metadata for a cart item, considering:
 * - Selected packaging (overrides unit prices)
 * - Bulk volume pricing (precios por cantidad)
 * - Active client price list (lista de precios de cliente)
 * - Manual price override (ajuste manual de precio)
 * If multiple mechanisms apply, picks the lowest/most beneficial price for the customer.
 */
export function getEffectiveItemInfo(
  product: Product,
  quantity: number,
  activePriceList: ClientPriceList | null,
  selectedPackaging?: ProductPackaging,
  priceOverride?: number
): EffectivePriceInfo {
  const originalCatalogPrice = product.price;

  // 1. Packaging
  const packagingPrice = selectedPackaging ? selectedPackaging.price : null;

  // 2. Bulk Pricing
  let matchingBulkTier: BulkTier | undefined = undefined;
  if (product.bulkPricing && Array.isArray(product.bulkPricing) && product.bulkPricing.length > 0) {
    const sortedTiers = [...product.bulkPricing]
      .filter((t) => typeof t.minQuantity === 'number' && typeof t.price === 'number')
      .sort((a, b) => b.minQuantity - a.minQuantity); // highest quantity first
    
    matchingBulkTier = sortedTiers.find((t) => quantity >= t.minQuantity);
  }
  const bulkPrice = matchingBulkTier ? matchingBulkTier.price : null;

  // 3. Price List
  const priceListPrice = activePriceList ? getListPrice(product, activePriceList) : null;

  // 4. Manual Price Override
  const overridePrice = typeof priceOverride === 'number' && priceOverride > 0 ? priceOverride : null;

  interface Option {
    price: number;
    type: 'standard' | 'price_list' | 'bulk_pricing' | 'packaging' | 'price_override';
  }

  const options: Option[] = [];

  if (packagingPrice !== null) {
    options.push({ price: packagingPrice, type: 'packaging' });
  }
  if (bulkPrice !== null) {
    options.push({ price: bulkPrice, type: 'bulk_pricing' });
  }
  if (priceListPrice !== null) {
    options.push({ price: priceListPrice, type: 'price_list' });
  }
  if (overridePrice !== null) {
    options.push({ price: overridePrice, type: 'price_override' });
  }
  options.push({ price: originalCatalogPrice, type: 'standard' });

  // Pick lowest price. If tie with overridePrice, prefer price_override
  let best = options[0];
  for (let i = 1; i < options.length; i++) {
    const opt = options[i];
    if (opt.price < best.price) {
      best = opt;
    } else if (opt.price === best.price && opt.type === 'price_override') {
      best = opt;
    }
  }

  if (best.type === 'packaging' && selectedPackaging) {
    return {
      unitPrice: selectedPackaging.price,
      appliedType: 'packaging',
      originalCatalogPrice,
    };
  }

  if (best.type === 'price_override' && overridePrice !== null) {
    return {
      unitPrice: overridePrice,
      appliedType: 'price_override',
      originalCatalogPrice,
      priceOverrideApplied: overridePrice,
    };
  }

  if (best.type === 'bulk_pricing' && bulkPrice !== null) {
    return {
      unitPrice: bulkPrice,
      appliedType: 'bulk_pricing',
      originalCatalogPrice,
      bulkTierApplied: matchingBulkTier,
    };
  }

  if (best.type === 'price_list' && priceListPrice !== null) {
    return {
      unitPrice: priceListPrice,
      appliedType: 'price_list',
      originalCatalogPrice,
      appliedPriceListName: activePriceList?.name,
    };
  }

  return {
    unitPrice: originalCatalogPrice,
    appliedType: 'standard',
    originalCatalogPrice,
  };
}
