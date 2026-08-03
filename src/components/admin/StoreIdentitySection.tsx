import React from 'react';
import { StoreIdentity } from '../../types';
import { Store } from 'lucide-react';

interface StoreIdentitySectionProps {
  identity: StoreIdentity;
  onUpdateIdentity: (identity: StoreIdentity) => void;
}

export const StoreIdentitySection: React.FC<StoreIdentitySectionProps> = ({
  identity,
  onUpdateIdentity,
}) => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Store className="w-4 h-4 text-indigo-600" />
        <h4 className="font-bold text-slate-800 text-sm">Identidad de la Tienda</h4>
      </div>

      <div className="space-y-4">
        {/* Nombre */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-500 block">Nombre Comercial</label>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={identity.showNameOnInvoice}
                onChange={(e) => onUpdateIdentity({ ...identity, showNameOnInvoice: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
              />
              Ver en factura
            </label>
          </div>
          <input
            type="text"
            value={identity.name || ''}
            onChange={(e) => onUpdateIdentity({ ...identity, name: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
        </div>

        {/* Slogan */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-500 block">Slogan / Subtítulo</label>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={!!identity.showSloganOnInvoice}
                onChange={(e) => onUpdateIdentity({ ...identity, showSloganOnInvoice: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
              />
              Ver en factura
            </label>
          </div>
          <input
            type="text"
            value={identity.slogan || ''}
            onChange={(e) => onUpdateIdentity({ ...identity, slogan: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
        </div>

        {/* Dirección */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-500 block">Dirección</label>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={!!identity.showAddressOnInvoice}
                onChange={(e) => onUpdateIdentity({ ...identity, showAddressOnInvoice: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
              />
              Ver en factura
            </label>
          </div>
          <input
            type="text"
            value={identity.address || ''}
            onChange={(e) => onUpdateIdentity({ ...identity, address: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
        </div>

        {/* Teléfono */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-500 block">Número de Teléfono</label>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={!!identity.showPhoneOnInvoice}
                onChange={(e) => onUpdateIdentity({ ...identity, showPhoneOnInvoice: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
              />
              Ver en factura
            </label>
          </div>
          <input
            type="text"
            value={identity.phone || ''}
            onChange={(e) => onUpdateIdentity({ ...identity, phone: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
        </div>

        {/* Logo/Icono */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-500 block">Ícono / Logotipo</label>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={!!identity.showLogoOnInvoice}
                onChange={(e) => onUpdateIdentity({ ...identity, showLogoOnInvoice: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
              />
              Ver en factura
            </label>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center text-xl font-bold overflow-hidden bg-white shrink-0 shadow-sm">
              {identity.logoUrl && (identity.logoUrl.startsWith('data:image') || identity.logoUrl.startsWith('http')) ? (
                <img src={identity.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                identity.logoUrl || '☕'
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <input
                type="text"
                value={identity.logoUrl || ''}
                placeholder="Ej: ☕ o enlace de imagen"
                onChange={(e) => onUpdateIdentity({ ...identity, logoUrl: e.target.value })}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors block text-center flex-1">
                  Subir Logotipo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (typeof reader.result === 'string') {
                            onUpdateIdentity({ ...identity, logoUrl: reader.result });
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateIdentity({ ...identity, logoUrl: '☕' })}
                  className="text-[10px] text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition-colors font-bold flex-1"
                >
                  Restablecer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
