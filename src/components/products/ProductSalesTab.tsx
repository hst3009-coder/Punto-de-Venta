import React, { useState, useMemo } from 'react';
import { Sale, Product } from '../../types';
import { matchesProductSearch } from '../../lib/search';
import * as XLSX from 'xlsx';
import { useAlert } from '../../context/AlertContext';
import { getSaleTimestamp } from '../../lib/dates';
import { 
  Search, 
  Calendar, 
  Download, 
  TrendingUp, 
  ArrowLeft, 
  ChevronRight, 
  Clock, 
  Tag, 
  DollarSign, 
  Layers,
  Info,
  X
} from 'lucide-react';
import { startOfMonth, endOfDay, parseISO, format, isWithinInterval } from 'date-fns';

interface ProductSalesTabProps {
  sales: Sale[];
  products: Product[];
}

interface ProductSaleStats {
  productId: string;
  code: string;
  name: string;
  emoji: string;
  category: string;
  quantitySold: number;
  distinctOrders: number;
  totalRevenue: number;
  individualSales: Array<{
    ticketNumber: string;
    date: string;
    quantity: number;
    price: number;
    total: number;
    soldBy?: string;
  }>;
}

export const ProductSalesTab: React.FC<ProductSalesTabProps> = ({ sales, products }) => {
  const { showAlert } = useAlert();
  // Date filters defaulting to start of current month until today
  const [fromDateStr, setFromDateStr] = useState(() => {
    const start = startOfMonth(new Date());
    return format(start, 'yyyy-MM-dd');
  });
  
  const [toDateStr, setToDateStr] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductStats, setSelectedProductStats] = useState<ProductSaleStats | null>(null);

  // Parse filters
  const dateInterval = useMemo(() => {
    try {
      const fromDate = new Date(fromDateStr + 'T00:00:00');
      const toDate = endOfDay(new Date(toDateStr + 'T23:59:59'));
      return { start: fromDate, end: toDate };
    } catch (e) {
      return null;
    }
  }, [fromDateStr, toDateStr]);

  // Compile statistics from sales history
  const productSalesStats = useMemo(() => {
    const statsMap: Record<string, ProductSaleStats> = {};

    // Filter valid sales in date range
    const validSales = sales.filter((sale) => {
      if (sale.isCancelled) return false;
      if (!dateInterval) return true;
      try {
        const saleDate = parseISO(sale.date);
        return isWithinInterval(saleDate, dateInterval);
      } catch (e) {
        return false;
      }
    });

    validSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const prod = item.product;
        if (!prod) return;

        const pId = prod.id;
        const code = prod.code || prod.barcode || pId;
        const name = prod.name;
        const emoji = prod.emoji || '🏷️';
        const category = prod.category || 'Varios';
        const qty = item.quantity || 0;
        const itemPrice = prod.price || 0;
        const total = qty * itemPrice;

        if (!statsMap[pId]) {
          statsMap[pId] = {
            productId: pId,
            code,
            name,
            emoji,
            category,
            quantitySold: 0,
            distinctOrders: 0,
            totalRevenue: 0,
            individualSales: [],
          };
        }

        statsMap[pId].quantitySold += qty;
        statsMap[pId].totalRevenue += total;
        statsMap[pId].individualSales.push({
          ticketNumber: sale.ticketNumber || sale.id.slice(0, 8).toUpperCase(),
          date: sale.date,
          quantity: qty,
          price: itemPrice,
          total,
          soldBy: sale.soldBy?.name,
        });
      });
    });

    // Calculate distinct orders count for each product
    Object.keys(statsMap).forEach((pId) => {
      // Find how many unique ticketNumbers/sale IDs contain this product
      const tickets = new Set(statsMap[pId].individualSales.map((s) => s.ticketNumber));
      statsMap[pId].distinctOrders = tickets.size;

      // Sort individual sales by date descending
      statsMap[pId].individualSales.sort(
        (a, b) => getSaleTimestamp(b as any) - getSaleTimestamp(a as any)
      );
    });

    // Convert map to array and sort by totalRevenue descending
    return Object.values(statsMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [sales, dateInterval]);

  // Filter stats by search query (name, code, category)
  const filteredStats = useMemo(() => {
    return productSalesStats.filter((stat) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        stat.name.toLowerCase().includes(query) ||
        stat.code.toLowerCase().includes(query) ||
        stat.category.toLowerCase().includes(query)
      );
    });
  }, [productSalesStats, searchQuery]);

  // Calculations for Footer Summary
  const grandTotals = useMemo(() => {
    return filteredStats.reduce(
      (acc, item) => {
        acc.quantity += item.quantitySold;
        acc.revenue += item.totalRevenue;
        return acc;
      },
      { quantity: 0, revenue: 0 }
    );
  }, [filteredStats]);

  // Export spreadsheet function
  const handleExportExcel = () => {
    try {
      const exportData = filteredStats.map((stat, idx) => ({
        Ranking: idx + 1,
        Código: stat.code,
        Nombre: stat.name,
        Categoría: stat.category,
        Unidades_Vendidas: stat.quantitySold,
        Pedidos_Distintos: stat.distinctOrders,
        Venta_Total_RD: stat.totalRevenue,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas_por_Producto');
      
      const filename = `ventas_por_producto_${fromDateStr}_a_${toDateStr}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Error exporting product sales to Excel:', err);
      showAlert(
        'Error de Exportación',
        'Error al exportar. Revisa la consola para más detalles.',
        'error'
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-100 overflow-hidden">
      
      {/* MAIN VIEW: Sales table & search controls */}
      <div className="flex-1 p-6 bg-white border-r border-slate-200 overflow-y-auto flex flex-col h-full min-h-0">
        
        {/* Filters Top Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-4 border-b border-slate-200 shrink-0">
          
          {/* Date Range Selection */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 lg:col-span-2">
            <Calendar className="w-4 h-4 text-slate-450 shrink-0" />
            <div className="flex items-center gap-1.5 w-full text-xs font-bold text-slate-650">
              <span className="shrink-0">Desde:</span>
              <input
                type="date"
                value={fromDateStr}
                onChange={(e) => setFromDateStr(e.target.value)}
                className="bg-transparent border-none text-slate-800 font-extrabold focus:ring-0 focus:outline-none cursor-pointer p-0"
              />
              <span className="shrink-0 text-slate-350 px-1">|</span>
              <span className="shrink-0">Hasta:</span>
              <input
                type="date"
                value={toDateStr}
                onChange={(e) => setToDateStr(e.target.value)}
                className="bg-transparent border-none text-slate-800 font-extrabold focus:ring-0 focus:outline-none cursor-pointer p-0"
              />
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-850 focus:outline-none transition-all"
            />
          </div>

        </div>

        {/* Action controls & Download Excel */}
        <div className="py-3 flex justify-between items-center shrink-0">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Análisis de ventas de productos ({filteredStats.length} ítems)
            </span>
          </div>
          <button
            onClick={handleExportExcel}
            disabled={filteredStats.length === 0}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              filteredStats.length === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-indigo-50 border border-indigo-200 text-indigo-750 hover:bg-indigo-100 shadow-xs'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>

        {/* Sales Stats Scrollable Table */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50/20">
          {filteredStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center h-full">
              <TrendingUp className="w-8 h-8 text-slate-350 mb-2" />
              <p className="text-xs font-extrabold text-slate-500 font-bold">No se encontraron ventas</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Prueba ampliando el rango de fechas o ajustando tu búsqueda.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4 text-center">Unidades</th>
                  <th className="py-3 px-4 text-center">Pedidos</th>
                  <th className="py-3 px-4 text-right">Venta Total</th>
                  <th className="py-3 px-4 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs bg-white">
                {filteredStats.map((stat, idx) => (
                  <tr
                    key={stat.productId}
                    onClick={() => setSelectedProductStats(stat)}
                    className="hover:bg-slate-50/85 transition-all cursor-pointer group"
                  >
                    {/* Rank Badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        idx === 0 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : idx === 1 
                          ? 'bg-slate-200 text-slate-700' 
                          : idx === 2 
                          ? 'bg-amber-50 text-amber-900/60'
                          : 'bg-slate-100 text-slate-550'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    
                    {/* Product general info */}
                    <td className="py-3 px-4 min-w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg shrink-0">{stat.emoji}</span>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-850 block truncate group-hover:text-indigo-650 transition-colors">
                            {stat.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono font-bold block uppercase mt-0.5">
                            Cód: {stat.code}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Quantity sold */}
                    <td className="py-3 px-4 text-center font-black text-slate-700">
                      {stat.quantitySold}
                    </td>

                    {/* Distinct transaction orders count */}
                    <td className="py-3 px-4 text-center font-bold text-slate-500">
                      {stat.distinctOrders}
                    </td>

                    {/* Total revenue RD$ */}
                    <td className="py-3 px-4 text-right font-black text-slate-900 text-xs">
                      RD$ {stat.totalRevenue.toFixed(2)}
                    </td>

                    {/* Action disclosure */}
                    <td className="py-3 px-4 text-center">
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Grand summary Footer totals */}
        {filteredStats.length > 0 && (
          <div className="mt-4 p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shrink-0 shadow-lg shadow-slate-900/10">
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Suma Total Filtrada</span>
              <h4 className="text-xs font-bold text-slate-200">Consolidado del rango de fechas activo</h4>
            </div>

            <div className="flex items-center gap-6 text-center self-end sm:self-center">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block">Total Unidades</span>
                <span className="text-sm font-black text-white">{grandTotals.quantity} un.</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block">Total Ingresos</span>
                <span className="text-sm font-black text-emerald-450">RD$ {grandTotals.revenue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* DETAIL DRAWER PANEL (Right-side, slide in) */}
      <div className={`w-full md:w-[420px] bg-slate-50 border-l border-slate-200 p-6 flex flex-col min-h-0 shrink-0 transition-all duration-300 ${
        selectedProductStats ? 'translate-x-0 opacity-100' : 'translate-x-full md:translate-x-0 md:opacity-30'
      }`}>
        {selectedProductStats ? (
          <div className="flex flex-col h-full min-h-0">
            
            {/* Header detail */}
            <div className="pb-4 border-b border-slate-200 shrink-0 flex justify-between items-start gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-3xl w-12 h-12 bg-white border border-slate-150 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                  {selectedProductStats.emoji}
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-slate-850 truncate">{selectedProductStats.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">
                    Cód: {selectedProductStats.code}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductStats(null)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-450 hover:text-slate-700 cursor-pointer transition-colors"
                title="Cerrar detalle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Micro consolidated stats */}
            <div className="grid grid-cols-2 gap-3.5 my-4 shrink-0 text-center">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">U. Vendidas</span>
                <span className="text-sm font-black text-slate-800">{selectedProductStats.quantitySold} un.</span>
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Ingresos Totales</span>
                <span className="text-sm font-black text-emerald-600">RD$ {selectedProductStats.totalRevenue.toFixed(2)}</span>
              </div>
            </div>

            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-2 shrink-0">
              Desglose de transacciones individuales ({selectedProductStats.individualSales.length})
            </span>

            {/* List scrollable of sales detail */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {selectedProductStats.individualSales.map((saleItem, i) => (
                <div
                  key={`${saleItem.ticketNumber}-${i}`}
                  className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center hover:border-indigo-150 transition-all shadow-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-100">
                        {saleItem.ticketNumber}
                      </span>
                      {saleItem.soldBy && (
                        <span className="text-[8px] font-bold px-1.5 bg-slate-100 text-slate-500 rounded uppercase">
                          Cajero: {saleItem.soldBy}
                        </span>
                      )}
                    </div>
                    
                    <span className="text-[10px] text-slate-400 font-bold font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-350" />
                      <span>{format(parseISO(saleItem.date), 'dd/MM/yyyy HH:mm')}</span>
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-slate-800 block">
                      RD$ {saleItem.total.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold block">
                      {saleItem.quantity} un. × ${saleItem.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 max-w-xs mx-auto">
            <Info className="w-10 h-10 text-slate-300 mb-2" />
            <h5 className="text-xs font-black text-slate-650 uppercase">Detalle de Transacciones</h5>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
              Haz clic en cualquier renglón del listado de la izquierda para desplegar el desglose ticket por ticket de ese producto en este rango de fechas.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
