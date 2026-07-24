import React from 'react';
import { Product, ProductPackaging } from '../types';
import { X, Package, CheckCircle2, Tag } from 'lucide-react';

interface PackagingSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSelectPackaging: (product: Product, packaging?: ProductPackaging) => void;
}

export const PackagingSelectModal: React.FC<PackagingSelectModalProps> = ({
  isOpen,
  onClose,
  product,
  onSelectPackaging,
}) => {
  if (!isOpen || !product) return null;

  const packagings = product.packagings || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600 font-black text-xl shadow-2xs">
              {product.emoji || '📦'}
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight leading-tight line-clamp-1">
                {product.name}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Selecciona la presentación para agregar al carrito
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="p-5 space-y-3 overflow-y-auto">
          {/* Base Unit Option */}
          <button
            onClick={() => {
              onSelectPackaging(product, undefined);
              onClose();
            }}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl transition-all cursor-pointer group text-left shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-indigo-50 text-slate-600 group-hover:text-indigo-600 transition-colors">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-tight block">
                  Unidad Individual
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  1 unidad suelta • Stock: {product.stock}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-slate-900 block">
                RD$ {product.price.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-indigo-600 group-hover:underline">
                Seleccionar
              </span>
            </div>
          </button>

          {/* Packagings Options */}
          {packagings.map((pkg) => {
            const unitEquiv = pkg.unitsPerPackage > 0 ? (pkg.price / pkg.unitsPerPackage) : pkg.price;
            return (
              <button
                key={pkg.id}
                onClick={() => {
                  onSelectPackaging(product, pkg);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-4 bg-indigo-50/40 hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-600 rounded-2xl transition-all cursor-pointer group text-left shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight block">
                      {pkg.name}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-800">
                      Contiene {pkg.unitsPerPackage} {pkg.unitsPerPackage === 1 ? 'unidad' : 'unidades'}
                      <span className="text-slate-400 font-normal ml-1">
                        (RD$ {unitEquiv.toFixed(2)}/u)
                      </span>
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-indigo-950 block">
                    RD$ {pkg.price.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 group-hover:underline">
                    Seleccionar
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
};
