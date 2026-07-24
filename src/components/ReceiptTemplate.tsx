import React from 'react';
import { Sale, CartItem, PaymentMethod, PaymentBreakdownItem, StoreIdentity, TicketConfig } from '../types';

export interface ReceiptTemplateProps {
  sale?: Sale | null;
  cartItems?: CartItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  paymentMethod?: PaymentMethod;
  mixedBreakdown?: PaymentBreakdownItem[];
  mixedTotalEntered?: number;
  mixedChangeAmount?: number;
  amountPaid?: number;
  change?: number;
  selectedCustomerId?: string;
  customerName?: string;
  ticketNumber?: string;
  date?: string;
  clerkName?: string;
  storeIdentity: StoreIdentity;
  ticketConfig?: TicketConfig;
  viewType?: 'original' | 'refund';
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({
  sale,
  cartItems,
  subtotal,
  tax,
  total,
  paymentMethod,
  mixedBreakdown,
  mixedTotalEntered,
  mixedChangeAmount,
  amountPaid,
  change,
  customerName,
  ticketNumber,
  date,
  clerkName,
  storeIdentity,
  ticketConfig,
  viewType = 'original',
}) => {
  const width = ticketConfig?.width ?? '80mm';
  const printWidth = width === '58mm' ? '50mm' : '72mm';
  const previewMaxWidth = width === '58mm' ? 'max-w-[220px]' : 'max-w-[340px]';

  const fontFamily = ticketConfig?.fontFamily ?? 'mono';
  const fontMap: Record<string, string> = {
    mono: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    sans: 'ui-sans-serif, "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  };
  const fontFamilyStyle = fontMap[fontFamily] || fontMap.mono;

  const showLogo = ticketConfig?.showLogo ?? true;
  const showSlogan = ticketConfig?.showSlogan ?? true;
  const showTaxBreakdown = ticketConfig?.showTaxBreakdown ?? true;
  const showEmployeeName = ticketConfig?.showEmployeeName ?? true;
  const showFooterMessage = ticketConfig?.showFooterMessage ?? true;
  const footerMessageText = ticketConfig?.footerMessageText ?? '¡Gracias por su compra!';

  // Data normalization
  const tktNum = sale ? sale.ticketNumber : (ticketNumber || 'TKT-XXXXXX');
  const dateStr = sale ? sale.date : (date || new Date().toLocaleString('es-DO', { hour12: false }));
  const clerk = clerkName || sale?.employeeName || 'Cajero';
  const cName = customerName || sale?.customerName;

  const effectiveItems = sale
    ? sale.items
    : (cartItems || []);

  const calculatedTotal = sale ? sale.total : (total ?? 0);
  const calculatedSubtotal = sale ? (sale.subtotal ?? calculatedTotal / 1.18) : (subtotal ?? 0);
  const calculatedTax = sale ? (sale.tax ?? (calculatedTotal - calculatedSubtotal)) : (tax ?? 0);

  const effPaymentMethod = sale ? sale.paymentMethod : (paymentMethod || 'cash');
  const effBreakdown = sale ? sale.paymentBreakdown : mixedBreakdown;
  const effPaid = sale ? sale.amountPaid : (effPaymentMethod === 'mixed' ? (mixedTotalEntered ?? 0) : (amountPaid ?? calculatedTotal));
  const effChange = sale ? sale.change : (effPaymentMethod === 'mixed' ? (mixedChangeAmount ?? 0) : (change ?? 0));

  const getRefundTotal = () => {
    if (!sale) return 0;
    if (sale.isCancelled && (!(sale as any).returnedItems || (sale as any).returnedItems.length === 0)) {
      return sale.total;
    }
    if ((sale as any).returnedItems && (sale as any).returnedItems.length > 0) {
      return (sale as any).returnedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    }
    return 0;
  };
  const refundTotal = getRefundTotal();

  return (
    <div
      id="thermal-ticket"
      style={{
        '--ticket-print-width': printWidth,
        fontFamily: fontFamilyStyle,
      } as React.CSSProperties}
      className={`bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-xs text-slate-800 leading-relaxed relative overflow-hidden w-full ${previewMaxWidth} mx-auto`}
    >
      {/* Visual Stamp overlay for cancelled sales */}
      {sale?.isCancelled && viewType === 'original' && (
        <div className="absolute inset-0 flex items-center justify-center rotate-12 pointer-events-none select-none z-10">
          <div className="border-4 border-rose-500 text-rose-500 text-lg font-black px-3 py-1.5 uppercase tracking-widest rounded-xl bg-white/95 opacity-85 shadow-md">
            Anulado / Devuelto
          </div>
        </div>
      )}

      {/* Zigzag cut graphic top */}
      <div className="absolute top-0 inset-x-0 h-1 flex justify-between">
        {Array.from({ length: width === '58mm' ? 12 : 18 }).map((_, i) => (
          <div key={i} className="w-2.5 h-1.5 bg-slate-50 rotate-45 -translate-y-1.5" />
        ))}
      </div>

      {viewType === 'original' ? (
        <div className="space-y-3 pt-1">
          {/* Header */}
          <div className="text-center border-b border-dashed border-slate-200 pb-3 space-y-1">
            {showLogo && storeIdentity.showLogoOnInvoice && storeIdentity.logoUrl && (
              <div className="flex justify-center mb-1">
                <div className="w-10 h-10 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center text-xl font-bold overflow-hidden bg-white shadow-2xs mx-auto">
                  {storeIdentity.logoUrl.startsWith('data:image') || storeIdentity.logoUrl.startsWith('http') ? (
                    <img src={storeIdentity.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    storeIdentity.logoUrl
                  )}
                </div>
              </div>
            )}
            {storeIdentity.showNameOnInvoice && (
              <h4 className="font-extrabold text-sm text-slate-900 tracking-tight uppercase">
                {storeIdentity.name || 'MI NEGOCIO'}
              </h4>
            )}
            {showSlogan && storeIdentity.showSloganOnInvoice && storeIdentity.slogan && (
              <p className="text-[10px] text-slate-500 font-medium italic">{storeIdentity.slogan}</p>
            )}
            {storeIdentity.showAddressOnInvoice && storeIdentity.address && (
              <p className="text-[10px] text-slate-500">{storeIdentity.address}</p>
            )}
            {storeIdentity.showPhoneOnInvoice && storeIdentity.phone && (
              <p className="text-[10px] text-slate-500">Tel: {storeIdentity.phone}</p>
            )}
          </div>

          {/* Ticket metadata */}
          <div className="border-b border-dashed border-slate-200 pb-2 space-y-0.5 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>Ticket:</span>
              <span className="font-bold text-slate-900">#{tktNum}</span>
            </div>
            <div className="flex justify-between">
              <span>Fecha:</span>
              <span>{dateStr}</span>
            </div>
            {showEmployeeName && (
              <div className="flex justify-between">
                <span>Atendió:</span>
                <span>{clerk}</span>
              </div>
            )}
            {cName && (
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span className="font-bold text-slate-900 truncate max-w-[120px]">
                  {cName}
                </span>
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="border-b border-dashed border-slate-200 pb-3 space-y-2">
            <div className="flex justify-between font-bold text-slate-900 text-[11px] pb-1 border-b border-slate-100">
              <span>Descripción</span>
              <span className="text-right">Importe</span>
            </div>
            <div className="space-y-2 text-[11px]">
              {effectiveItems.map((item, index) => {
                const returnedQty = sale
                  ? ((sale as any).returnedItems
                      ?.filter((r: any) => r.productId === item.product.id)
                      ?.reduce((sum: number, r: any) => sum + r.quantity, 0) || 0)
                  : 0;

                const isFullyReturned = returnedQty >= item.quantity;
                const isPartiallyReturned = returnedQty > 0 && returnedQty < item.quantity;

                const itemPrice = item.product.price;
                const activeQty = isPartiallyReturned ? item.quantity - returnedQty : item.quantity;
                const lineTotal = itemPrice * activeQty;
                const displayName = item.selectedPackaging
                  ? `${item.product.name} (${item.selectedPackaging.name})`
                  : item.product.name;

                return (
                  <div key={index} className="flex justify-between items-start gap-2 text-[11px]">
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-semibold ${isFullyReturned ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {displayName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {isPartiallyReturned ? (
                          <>
                            <span className="line-through text-slate-400 mr-1">{item.quantity}</span>
                            <span className="font-bold text-slate-700">{activeQty}</span>
                          </>
                        ) : (
                          item.quantity
                        )}{' '}
                        {item.selectedPackaging ? `empaque${item.quantity !== 1 ? 's' : ''}` : `pza${item.quantity !== 1 ? 's' : ''}`} x RD$ {itemPrice.toFixed(2)}
                      </div>
                      {isFullyReturned && (
                        <span className="text-[9px] font-bold text-rose-500 block">Devolución total</span>
                      )}
                      {isPartiallyReturned && (
                        <span className="text-[9px] font-bold text-amber-600 block">Dev. parcial: {returnedQty}</span>
                      )}
                    </div>
                    <div className="text-right font-semibold text-slate-800 shrink-0">
                      {isFullyReturned ? (
                        <span className="line-through text-slate-400">RD$ {(itemPrice * item.quantity).toFixed(2)}</span>
                      ) : (
                        <span>RD$ {lineTotal.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals Section */}
          <div className="border-b border-dashed border-slate-200 pb-2 space-y-1 text-[11px]">
            {showTaxBreakdown && (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>RD$ {calculatedSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>ITBIS (18%):</span>
                  <span>RD$ {calculatedTax.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
              <span>TOTAL:</span>
              <span>RD$ {calculatedTotal.toFixed(2)}</span>
            </div>

            {refundTotal > 0 && (
              <>
                <div className="flex justify-between text-xs font-bold text-rose-600 pt-1">
                  <span>TOTAL DEVUELTO:</span>
                  <span>-RD$ {refundTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-emerald-600 border-t border-dashed border-slate-200 pt-1">
                  <span>TOTAL NETO:</span>
                  <span>RD$ {(calculatedTotal - refundTotal).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Payment Details */}
          <div className="border-b border-dashed border-slate-200 pb-2 space-y-1 text-[10px] text-slate-600">
            {effPaymentMethod === 'mixed' || (effBreakdown && effBreakdown.length > 0) ? (
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-800 pb-0.5">
                  <span>Forma de pago:</span>
                  <span>Mixto</span>
                </div>
                {(effBreakdown || []).map((item) => {
                  const label =
                    item.method === 'cash' ? 'Efectivo' :
                    item.method === 'card' ? 'Tarjeta' :
                    item.method === 'transfer' ? 'Transf.' :
                    item.method === 'credit' ? 'Crédito' : 'Nota de Crédito';
                  return (
                    <div key={item.id} className="flex justify-between pl-2 text-[10px] text-slate-700">
                      <span>• {label}:</span>
                      <span>RD$ {(Number(item.amount) || 0).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-1 font-semibold text-slate-800">
                  <span>Pagó con:</span>
                  <span>RD$ {effPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-950 font-bold">
                  <span>Cambio:</span>
                  <span>RD$ {effChange.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>Forma de pago:</span>
                  <span className="capitalize font-bold text-slate-800">
                    {effPaymentMethod === 'cash' ? 'Efectivo' :
                     effPaymentMethod === 'card' ? 'Tarjeta' :
                     effPaymentMethod === 'transfer' ? 'Transferencia' :
                     effPaymentMethod === 'qr' ? 'Código QR' : 'A Crédito'}
                  </span>
                </div>
                {effPaymentMethod !== 'credit' ? (
                  <>
                    <div className="flex justify-between">
                      <span>Pagó con:</span>
                      <span>RD$ {effPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-950 font-bold">
                      <span>Cambio:</span>
                      <span>RD$ {effChange.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center font-bold text-rose-700 bg-rose-50 border border-rose-100 py-1.5 px-2 rounded-lg text-[10px] mt-1">
                    PENDIENTE POR COBRAR (DEUDA)
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer message / Barcode */}
          <div className="pt-2 text-center space-y-2">
            {showFooterMessage && footerMessageText && (
              <p className="text-[10px] text-slate-600 font-medium">
                {footerMessageText}
              </p>
            )}

            {/* Simulated Barcode */}
            <div className="flex flex-col items-center justify-center pt-1">
              <div className="flex items-end justify-center gap-[1px] h-6 w-32 bg-white">
                {Array.from({ length: width === '58mm' ? 24 : 32 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-black"
                    style={{
                      width: i % 4 === 0 ? '3px' : i % 3 === 0 ? '1px' : '2px',
                      height: i % 5 === 0 ? '80%' : '100%',
                    }}
                  />
                ))}
              </div>
              <span className="text-[8px] text-slate-400 mt-1 tracking-widest font-mono">
                #{tktNum}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* RETURN / REFUND VIEW */
        <div className="space-y-3 pt-1">
          <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
            <h4 className="font-extrabold text-xs text-rose-600 tracking-tight uppercase">
              TKT DE DEVOLUCIÓN
            </h4>
            <p className="text-[10px] text-slate-600 font-bold uppercase">{storeIdentity.name || 'MI NEGOCIO'}</p>
            <p className="text-[10px] text-slate-500 font-mono">Factura Origen: #{tktNum}</p>
            <p className="text-[10px] text-slate-400 font-mono">Fecha: {dateStr}</p>
          </div>

          <div className="text-[10px] space-y-1 text-slate-600">
            <p className="font-bold text-slate-800">MOTIVO / JUSTIFICACIÓN:</p>
            <div className="bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200 text-[9px] italic text-slate-700 leading-snug">
              {sale?.isCancelled
                ? (sale.cancelReason || 'Anulación completa de la factura.')
                : ((sale as any)?.returnedItems?.[(sale as any).returnedItems.length - 1]?.reason || 'Devolución de artículo.')}
            </div>
          </div>

          {/* Returned items table */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-800 border-b border-dashed border-slate-200 pb-1">ARTÍCULOS DEVUELTOS:</p>
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="border-b border-dashed border-slate-200 text-slate-500">
                  <th className="py-1">Producto</th>
                  <th className="py-1 text-center">Cant</th>
                  <th className="py-1 text-right">Precio</th>
                </tr>
              </thead>
              <tbody>
                {sale?.isCancelled && !(sale as any).returnedItems ? (
                  sale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-dashed border-slate-100">
                      <td className="py-1 text-slate-800 font-medium">{item.product.name}</td>
                      <td className="py-1 text-center font-bold text-rose-600">{item.quantity}</td>
                      <td className="py-1 text-right">RD$ {item.product.price.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  ((sale as any)?.returnedItems || []).map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-dashed border-slate-100">
                      <td className="py-1 text-slate-800 font-medium">
                        {item.productName}
                        <span className="text-[8px] text-slate-400 block font-normal">{item.date}</span>
                      </td>
                      <td className="py-1 text-center font-bold text-rose-600">{item.quantity}</td>
                      <td className="py-1 text-right">RD$ {item.price.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Return Total highlight */}
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-2.5 text-center space-y-0.5">
            <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider block">MONTO TOTAL A FAVOR DEL CLIENTE</span>
            <span className="text-base font-black text-rose-700 block">RD$ {refundTotal.toFixed(2)}</span>
            <span className="text-[8px] font-semibold text-slate-500 block">Método: {effPaymentMethod}</span>
          </div>

          <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[9px] text-slate-400 italic space-y-1">
            <p>Firma del Cliente para vale de reembolso</p>
            <div className="border-b border-slate-300 h-8 w-36 mx-auto mt-3" />
          </div>
        </div>
      )}

      {/* Zigzag cut graphic bottom */}
      <div className="absolute bottom-0 inset-x-0 h-1 flex justify-between rotate-180">
        {Array.from({ length: width === '58mm' ? 12 : 18 }).map((_, i) => (
          <div key={i} className="w-2.5 h-1.5 bg-slate-50 rotate-45 -translate-y-1.5" />
        ))}
      </div>
    </div>
  );
};
