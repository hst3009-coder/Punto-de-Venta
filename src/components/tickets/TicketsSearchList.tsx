import React from 'react';
import { Sale, PaymentMethod, Employee } from '../../types';
import { Search, Calendar, Trash2 } from 'lucide-react';

export interface TicketsSearchListProps {
  filteredSales: Sale[];
  salesHistory: Sale[];
  shiftSales: Sale[];
  filterType: 'shift' | 'date';
  setFilterType: (type: 'shift' | 'date') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedDateStr: string;
  setSelectedDateStr: (dateStr: string) => void;
  todayStrISO: string;
  isSelectedDateToday: boolean;
  formattedFilterDate: string;
  currentEmployee: Employee | null;
  clerkName: string;
  isSaleFromSelectedDate: (sale: Sale) => boolean;
  selectedSale: Sale | null;
  onSelectSale: (sale: Sale) => void;
  onOpenCancelPrompt: (saleId: string, e: React.MouseEvent) => void;
  getPaymentBadge: (method: PaymentMethod) => React.ReactNode;
  getRefundTotal: (sale: Sale) => number;
}

interface TicketRowProps {
  sale: Sale;
  isSelected: boolean;
  onSelectSale: (sale: Sale) => void;
  onOpenCancelPrompt: (saleId: string, e: React.MouseEvent) => void;
  getPaymentBadge: (method: PaymentMethod) => React.ReactNode;
  getRefundTotal: (sale: Sale) => number;
}

const TicketRow: React.FC<TicketRowProps> = React.memo(({
  sale,
  isSelected,
  onSelectSale,
  onOpenCancelPrompt,
  getPaymentBadge,
  getRefundTotal,
}) => {
  const isCancelled = sale.isCancelled;
  const refundAmount = getRefundTotal(sale);

  return (
    <div
      onClick={() => onSelectSale(sale)}
      className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-all ${
        isSelected
          ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
          : 'hover:bg-slate-50/50 border-l-4 border-transparent'
      }`}
    >
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black text-slate-800">
            #{sale.ticketNumber}
          </span>
          {isCancelled && (
            <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
              Cancelado / Devuelto
            </span>
          )}
          {!isCancelled && (sale as any).returnedItems && (sale as any).returnedItems.length > 0 && (
            <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
              Devolución Parcial
            </span>
          )}
        </div>

        {/* List items preview */}
        <p className="text-[10px] text-slate-400 font-semibold truncate max-w-xs">
          {sale.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')}
        </p>

        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
          <span>{sale.date}</span>
          <span>•</span>
          <span>{getPaymentBadge(sale.paymentMethod)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div
            className={`text-sm font-black ${
              isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'
            }`}
          >
            ${sale.total.toFixed(2)}
          </div>
          {refundAmount > 0 && (
            <div className="text-[9px] font-extrabold text-rose-600 mt-0.5">
              Dev: ${refundAmount.toFixed(2)}
            </div>
          )}
        </div>

        {/* Fast delete/cancel icon */}
        <button
          type="button"
          disabled={isCancelled}
          onClick={(e) => onOpenCancelPrompt(sale.id, e)}
          title="Anular factura completa"
          className={`p-2 rounded-lg border transition-all ${
            isCancelled
              ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
              : 'bg-rose-50 hover:bg-rose-100 text-rose-500 border-rose-100 hover:border-rose-200 cursor-pointer'
          }`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export const TicketsSearchList: React.FC<TicketsSearchListProps> = ({
  filteredSales,
  salesHistory,
  shiftSales,
  filterType,
  setFilterType,
  searchQuery,
  setSearchQuery,
  selectedDateStr,
  setSelectedDateStr,
  todayStrISO,
  isSelectedDateToday,
  formattedFilterDate,
  currentEmployee,
  clerkName,
  isSaleFromSelectedDate,
  selectedSale,
  onSelectSale,
  onOpenCancelPrompt,
  getPaymentBadge,
  getRefundTotal,
}) => {
  return (
    <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
      {/* Search and Date badge row */}
      <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50 shrink-0">
        {/* Segmented control for Filter Type */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterType('shift')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
              filterType === 'shift'
                ? 'bg-white text-indigo-700 shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Turno Activo ({shiftSales.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('date')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
              filterType === 'date'
                ? 'bg-white text-indigo-700 shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Por Fecha ({salesHistory.filter(isSaleFromSelectedDate).length})
          </button>
        </div>

        <div className="flex gap-2.5 items-center">
          {/* Search query input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 placeholder-slate-400"
              placeholder="Buscar por producto, factura o monto..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                X
              </button>
            )}
          </div>

          {/* Interactive calendar date picker */}
          <div
            className={`border rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shrink-0 transition-all ${
              filterType === 'date'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDateStr(e.target.value);
                  setFilterType('date'); // Auto-switch to date filter on selection
                }
              }}
              className="bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none cursor-pointer"
              title="Seleccione fecha para filtrar"
            />
          </div>
        </div>

        {/* Filtering logic description banner */}
        <div className="text-[10px] text-slate-400 font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-100 flex items-center justify-between">
          <span>
            {searchQuery
              ? '🔍 Mostrando resultados históricos para su búsqueda'
              : filterType === 'shift'
              ? `📅 Mostrando facturas del TURNO ACTIVO de ${currentEmployee?.name || clerkName}`
              : isSelectedDateToday
              ? '📅 Mostrando solo facturas de HOY'
              : `📅 Mostrando facturas del ${formattedFilterDate}`}
          </span>
          <div className="flex gap-2.5 items-center">
            {filterType === 'date' && !isSelectedDateToday && (
              <button
                onClick={() => setSelectedDateStr(todayStrISO)}
                className="text-rose-500 hover:text-rose-700 font-black cursor-pointer hover:underline text-[9px] uppercase tracking-tight"
              >
                Restablecer a hoy
              </button>
            )}
            {searchQuery === '' && (
              <span
                className="text-indigo-500 font-extrabold cursor-pointer hover:underline text-[9px]"
                onClick={() => setSearchQuery(' ')}
              >
                Ver todo el historial →
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sales List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredSales.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-3 border border-slate-100">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm">No se encontraron facturas</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'Intente modificando el término de búsqueda para localizar la factura.'
                : `Aún no se registran facturas el ${formattedFilterDate}. Las facturas de esta fecha aparecerán aquí.`}
            </p>
          </div>
        ) : (
          filteredSales.map((sale) => (
            <TicketRow
              key={sale.id}
              sale={sale}
              isSelected={selectedSale?.id === sale.id}
              onSelectSale={onSelectSale}
              onOpenCancelPrompt={onOpenCancelPrompt}
              getPaymentBadge={getPaymentBadge}
              getRefundTotal={getRefundTotal}
            />
          ))
        )}
      </div>
    </div>
  );
};
