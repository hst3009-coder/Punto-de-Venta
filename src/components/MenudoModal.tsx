import React, { useState, useMemo } from 'react';
import { X, Coins, Banknote, Copy, Check, CornerDownLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAlert } from '../context/AlertContext';

interface MenudoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTotal?: (total: number) => void;
  isCorteOpen?: boolean;
}

interface Denomination {
  value: number;
  type: 'bill' | 'coin';
  label: string;
}

const DOMINICAN_DENOMINATIONS: Denomination[] = [
  { value: 2000, type: 'bill', label: 'RD$ 2,000' },
  { value: 1000, type: 'bill', label: 'RD$ 1,000' },
  { value: 500, type: 'bill', label: 'RD$ 500' },
  { value: 200, type: 'bill', label: 'RD$ 200' },
  { value: 100, type: 'bill', label: 'RD$ 100' },
  { value: 50, type: 'bill', label: 'RD$ 50' },
  { value: 25, type: 'coin', label: 'RD$ 25' },
  { value: 10, type: 'coin', label: 'RD$ 10' },
  { value: 5, type: 'coin', label: 'RD$ 5' },
  { value: 1, type: 'coin', label: 'RD$ 1' },
];

export const MenudoModal: React.FC<MenudoModalProps> = ({
  isOpen,
  onClose,
  onApplyTotal,
  isCorteOpen = false,
}) => {
  const { showAlert } = useAlert();
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [packages, setPackages] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);

  const handleQtyChange = (value: number, valStr: string) => {
    // Only allow positive integers or empty string
    if (valStr === '') {
      setQuantities((prev) => {
        const next = { ...prev };
        delete next[value];
        return next;
      });
      return;
    }
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setQuantities((prev) => ({
        ...prev,
        [value]: parsed.toString(),
      }));
    }
  };

  const handlePkgChange = (value: number, valStr: string) => {
    // Only allow positive integers or empty string
    if (valStr === '') {
      setPackages((prev) => {
        const next = { ...prev };
        delete next[value];
        return next;
      });
      return;
    }
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setPackages((prev) => ({
        ...prev,
        [value]: parsed.toString(),
      }));
    }
  };

  const totals = useMemo(() => {
    let billTotal = 0;
    let coinTotal = 0;

    DOMINICAN_DENOMINATIONS.forEach((denom) => {
      const qty = parseInt(quantities[denom.value] || '0', 10);
      const pkg = parseInt(packages[denom.value] || '0', 10);
      const multiplier = denom.type === 'bill' ? 50 : 40;
      const totalUnits = qty + pkg * multiplier;
      const subtotal = denom.value * totalUnits;
      if (denom.type === 'bill') {
        billTotal += subtotal;
      } else {
        coinTotal += subtotal;
      }
    });

    return {
      bills: billTotal,
      coins: coinTotal,
      grandTotal: billTotal + coinTotal,
    };
  }, [quantities, packages]);

  const handleClear = () => {
    setQuantities({});
    setPackages({});
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(totals.grandTotal.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      showAlert('No se pudo copiar el total automáticamente. Puedes escribirlo manualmente.');
    }
  };

  const handleUseInCorte = () => {
    if (onApplyTotal) {
      onApplyTotal(totals.grandTotal);
      showAlert(`Total de RD$ ${totals.grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })} transferido al efectivo contado.`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-150 flex justify-between items-center bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Calculadora de Menudo</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Conteo de efectivo por denominación (RD$)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Billetes Section */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                  <Banknote className="w-3.5 h-3.5 text-slate-400" /> Billetes RD$
                </h4>
                <div className="space-y-1.5">
                  {DOMINICAN_DENOMINATIONS.filter((d) => d.type === 'bill').map((denom) => {
                    const qty = quantities[denom.value] || '';
                    const pkg = packages[denom.value] || '';
                    const totalUnits = (parseInt(qty, 10) || 0) + (parseInt(pkg, 10) || 0) * 50;
                    const subtotal = denom.value * totalUnits;
                    return (
                      <div
                        key={denom.value}
                        className="flex items-center justify-between gap-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-xl p-2.5 transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-700 w-20 shrink-0">{denom.label}</span>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <div className="flex items-center gap-1 max-w-[100px]">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Unid:</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={qty}
                              onChange={(e) => handleQtyChange(denom.value, e.target.value)}
                              className="w-full text-center px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-1 max-w-[125px]">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Paq (x50):</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={pkg}
                              onChange={(e) => handlePkgChange(denom.value, e.target.value)}
                              className="w-full text-center px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                            />
                          </div>
                        </div>
                        <span className="text-xs font-bold font-mono text-slate-500 text-right w-28 shrink-0">
                          RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monedas Section */}
              <div className="space-y-2 pt-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                  <Coins className="w-3.5 h-3.5 text-slate-400" /> Monedas RD$
                </h4>
                <div className="space-y-1.5">
                  {DOMINICAN_DENOMINATIONS.filter((d) => d.type === 'coin').map((denom) => {
                    const qty = quantities[denom.value] || '';
                    const pkg = packages[denom.value] || '';
                    const totalUnits = (parseInt(qty, 10) || 0) + (parseInt(pkg, 10) || 0) * 40;
                    const subtotal = denom.value * totalUnits;
                    return (
                      <div
                        key={denom.value}
                        className="flex items-center justify-between gap-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-xl p-2.5 transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-700 w-20 shrink-0">{denom.label}</span>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <div className="flex items-center gap-1 max-w-[100px]">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Unid:</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={qty}
                              onChange={(e) => handleQtyChange(denom.value, e.target.value)}
                              className="w-full text-center px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-1 max-w-[125px]">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Paq (x40):</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={pkg}
                              onChange={(e) => handlePkgChange(denom.value, e.target.value)}
                              className="w-full text-center px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                            />
                          </div>
                        </div>
                        <span className="text-xs font-bold font-mono text-slate-500 text-right w-28 shrink-0">
                          RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer & Totals */}
          <div className="p-5 border-t border-slate-150 bg-slate-50/80 shrink-0 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Total en Billetes:</span>
                <span className="font-mono">RD$ {totals.bills.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Total en Monedas:</span>
                <span className="font-mono">RD$ {totals.coins.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-slate-100 my-1.5" />
              <div className="flex justify-between items-center text-sm font-black text-slate-900">
                <span className="uppercase tracking-tight">Gran Total Contado:</span>
                <span className="text-amber-600 text-lg font-extrabold font-mono">
                  RD$ {totals.grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                title="Limpiar cantidades"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Limpiar
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  copied
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar Total'}
              </button>

              <button
                type="button"
                onClick={handleUseInCorte}
                className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
              >
                <CornerDownLeft className="w-3.5 h-3.5" /> Usar en Corte
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
