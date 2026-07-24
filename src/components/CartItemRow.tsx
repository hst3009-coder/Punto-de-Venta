import React from 'react';
import { CartItem } from '../types';
import { Plus, Minus, Trash2, Package } from 'lucide-react';

interface CartItemRowProps {
  item: CartItem;
  onIncrement: (productId: string, packagingId?: string) => void;
  onDecrement: (productId: string, packagingId?: string) => void;
  onRemove: (productId: string, packagingId?: string) => void;
  isSelected: boolean;
  onSelect: () => void;
  originalPrice?: number;
  priceListName?: string;
}

export const CartItemRow = React.memo<CartItemRowProps>(({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  isSelected,
  onSelect,
  originalPrice,
  priceListName,
}) => {
  const { product, quantity, packagingId, selectedPackaging } = item;
  const subtotal = product.price * quantity;
  const isPriceAdjusted = originalPrice !== undefined && Math.abs(originalPrice - product.price) > 0.001;
  const unitsDeducted = selectedPackaging ? selectedPackaging.unitsPerPackage * quantity : quantity;
  const displayName = selectedPackaging ? `${product.name} — ${selectedPackaging.name}` : product.name;

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
            {isPriceAdjusted && !selectedPackaging && (
              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                {priceListName || 'Lista'} (Catálogo: ${originalPrice.toFixed(2)})
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
            onClick={() => onDecrement(product.id, packagingId)}
            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-slate-800">
            {quantity}
          </span>
          <button
            id={`qty-inc-${product.id}`}
            onClick={() => onIncrement(product.id, packagingId)}
            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Subtotal & Delete */}
        <div className="text-right min-w-[65px]">
          <span className="text-sm font-bold text-slate-900 block">
            ${subtotal.toFixed(2)}
          </span>
          <button
            id={`qty-del-${product.id}`}
            onClick={() => onRemove(product.id, packagingId)}
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
