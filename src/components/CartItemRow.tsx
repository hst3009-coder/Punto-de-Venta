import React from 'react';
import { CartItem } from '../types';
import { Plus, Minus, Trash2 } from 'lucide-react';

interface CartItemRowProps {
  item: CartItem;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  isSelected: boolean;
  onSelect: () => void;
}

export const CartItemRow = React.memo<CartItemRowProps>(({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  isSelected,
  onSelect,
}) => {
  const { product, quantity } = item;
  const subtotal = product.price * quantity;

  return (
    <div
      id={`cart-item-${product.id}`}
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
            {product.name}
          </h4>
          <p className="text-xs text-slate-500 font-medium">
            ${product.price.toFixed(2)} c/u • inv: {product.stock - quantity}
          </p>
        </div>
      </div>

      {/* Action Controls & Price */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Quantity Controls */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button
            id={`qty-dec-${product.id}`}
            onClick={() => onDecrement(product.id)}
            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-slate-800">
            {quantity}
          </span>
          <button
            id={`qty-inc-${product.id}`}
            onClick={() => onIncrement(product.id)}
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
            onClick={() => onRemove(product.id)}
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
