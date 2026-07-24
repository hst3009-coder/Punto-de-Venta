import React from 'react';
import { Product } from '../types';
import { Plus, AlertTriangle, Package } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  cartQuantity: number;
}

export const ProductCard = React.memo<ProductCardProps>(({ product, onAddToCart, cartQuantity }) => {
  const isNegativeStock = product.stock <= 0;
  const hasPackagings = product.packagings && product.packagings.length > 0;

  return (
    <button
      id={`product-btn-${product.id}`}
      onClick={() => onAddToCart(product)}
      className={`relative flex flex-col justify-between text-left p-2.5 rounded-2xl border transition-all duration-300 select-none overflow-hidden h-52 w-full bg-white border-slate-200 hover:border-indigo-500 hover:shadow-xl hover:shadow-slate-100 active:scale-[0.98] group cursor-pointer`}
    >
      {/* Top Section: Photo/Image or Emoji */}
      <div className="w-full h-24 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden relative flex items-center justify-center shrink-0">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '';
              (e.target as HTMLImageElement).classList.add('hidden');
              const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-card-icon');
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
        ) : null}
        <span className={`fallback-card-icon text-3xl filter drop-shadow-sm ${product.imageUrl ? 'hidden' : ''}`}>
          {product.emoji || '🏷️'}
        </span>

        {/* Stock Badge */}
        <span className={`absolute top-2 left-2 flex px-1.5 py-0.5 items-center justify-center rounded-lg text-[9px] font-black tracking-wider z-20 shadow-xs ${
          product.stock <= 0
            ? 'bg-rose-600 text-white animate-pulse ring-2 ring-white'
            : product.stock <= 5
            ? 'bg-rose-500 text-white animate-pulse'
            : product.stock <= 15
            ? 'bg-amber-500 text-white'
            : 'bg-emerald-600 text-white'
        }`}>
          Stock: {product.stock}
        </span>

        {/* Packaging Badge */}
        {hasPackagings && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-600/90 text-white backdrop-blur-xs z-20 shadow-2xs">
            <Package className="w-2.5 h-2.5" />
            {product.packagings!.length} presentaciones
          </span>
        )}

        {/* Cart Quantity Badge (Float over the image) */}
        {cartQuantity > 0 && (
          <span className="absolute top-2 right-2 flex h-6 min-w-[24px] px-1.5 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold ring-2 ring-white z-20">
            {cartQuantity}
          </span>
        )}
      </div>

      {/* Bottom Section: Info */}
      <div className="w-full mt-2 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-gray-800 line-clamp-1 text-xs sm:text-sm leading-tight group-hover:text-indigo-600 transition-colors">
            {product.name}
          </h3>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{product.barcode || product.id}</p>
        </div>
        
        <div className="flex justify-between items-end mt-1.5">
          <p className="text-sm sm:text-md font-black text-gray-900">
            ${product.price.toFixed(2)}
          </p>

          <div className="flex items-center">
            {isNegativeStock ? (
              <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5 bg-rose-50 px-1.5 py-0.5 rounded-lg border border-rose-100">
                <AlertTriangle className="w-3 h-3" />
                Reserva
              </span>
            ) : (
              <div className="p-1.5 rounded-xl bg-gray-50 text-gray-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});
