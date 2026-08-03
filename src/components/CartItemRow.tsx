import React from 'react';
import { CartItem, BulkTier } from '../types';
import { Plus, Minus, Trash2, Package, Tag, Sliders } from 'lucide-react';

interface CartItemRowProps {
  item: CartItem;
  onIncrement: (productId: string, packagingId?: string) => void;
  onDecrement: (productId: string, packagingId?: string) => void;
  onRemove: (productId: string, packagingId?: string) => void;
  isSelected: boolean;
  onSelect: () => void;
  onOverridePrice?: (item: CartItem) => void;
  originalPrice?: number;
  priceListName?: string;
  bulkTierApplied?: BulkTier;
  appliedPriceType?: 'standard' | 'price_list' | 'bulk_pricing' | 'packaging' | 'price_override';
  priceListFallbackNoCost?: boolean;
}

export const CartItemRow = React.memo<CartItemRowProps>(({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  isSelected,
  onSelect,
  onOverridePrice,
  originalPrice,
  priceListName,
  bulkTierApplied,
  appliedPriceType,
  priceListFallbackNoCost,
}) => {
  const { product, quantity, packagingId, selectedPackaging } = item;
  const subtotal = product.price * quantity;
  const isPriceAdjusted = originalPrice !== undefined && Math.abs(originalPrice - product.price) > 0.001;
  const unitsDeducted = selectedPackaging ? selectedPackaging.unitsPerPackage * quantity : quantity;
  const displayName = selectedPackaging ? `${product.name} — ${selectedPackaging.name}` : product.name;

  const lastTouchRef = React.useRef<number>(0);

  const handleSubtotalTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTouchRef.current < 350) {
      e.stopPropagation();
      onOverridePrice?.(item);
    }
    lastTouchRef.current = now;
  };

  const handleSubtotalDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOverridePrice?.(item);
  };

  return (
    <div
      id={`cart-item-${product.id}${packagingId ? `-${packagingId}` : ''}`}
      onClick={onSelect}
      className={`flex items-center justify-between p-4 border rounded-xl transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-500/20'
          : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/60'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Product Details */}
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-slate-800 text-base leading-tight line-clamp-2 uppercase">
            {displayName}
          </h4>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <p className="text-xs text-slate-500 font-medium">
              ${product.price.toFixed(2)} c/u • inv: {product.stock - unitsDeducted}
            </p>
            {selectedPackaging && (
              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Package className="w-3 h-3 text-indigo-600 shrink-0" />
                Empaque ({selectedPackaging.unitsPerPackage} u/empaque)
              </span>
            )}

            {appliedPriceType === 'price_override' && (
              <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                <Sliders className="w-3 h-3 text-purple-600 shrink-0" />
                Precio ajustado
                {originalPrice && (
                  <span className="line-through text-slate-400 font-normal ml-0.5">
                    ${originalPrice.toFixed(2)}
                  </span>
                )}
              </span>
            )}

            {appliedPriceType === 'bulk_pricing' && bulkTierApplied && (
              <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                <Tag className="w-3 h-3 text-amber-600 shrink-0" />
                Precio por volumen: {bulkTierApplied.minQuantity}+ unidades
              </span>
            )}

            {appliedPriceType === 'price_list' && (
              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                {priceListName || 'Lista'} (Catálogo: ${originalPrice?.toFixed(2)})
              </span>
            )}

            {!appliedPriceType && isPriceAdjusted && !selectedPackaging && (
              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                {priceListName || 'Lista'} (Catálogo: ${originalPrice?.toFixed(2)})
              </span>
            )}

            {priceListFallbackNoCost && (
              <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                ⚠️ Sin costo registrado — se usó el precio normal en vez del precio de lista
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Controls & Price */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Quantity Controls */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button
            id={`qty-dec-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDecrement(product.id, packagingId);
            }}
            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-slate-800">
            {quantity}
          </span>
          <button
            id={`qty-inc-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onIncrement(product.id, packagingId);
            }}
            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Subtotal & Delete */}
        <div className="text-right min-w-[65px] flex flex-col items-end">
          <div
            className="select-none cursor-pointer px-1.5 py-0.5 rounded-lg hover:bg-purple-100/70 border border-transparent hover:border-purple-200 transition-all text-right group/subtotal"
            onDoubleClick={handleSubtotalDoubleClick}
            onTouchStart={handleSubtotalTouchStart}
            title="Doble clic o doble toque para ajustar el precio unitario"
          >
            <span className="text-sm font-bold text-slate-900 block group-hover/subtotal:text-purple-700">
              ${subtotal.toFixed(2)}
            </span>
          </div>
          <button
            id={`qty-del-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(product.id, packagingId);
            }}
            className="text-xs text-red-500 hover:text-red-700 hover:underline mt-0.5 inline-flex items-center gap-0.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Del
          </button>
        </div>
      </div>
    </div>
  );
});
