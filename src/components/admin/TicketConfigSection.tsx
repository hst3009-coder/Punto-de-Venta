import React from 'react';
import { DashboardConfig, TicketConfig } from '../../types';
import { Printer } from 'lucide-react';

interface TicketConfigSectionProps {
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
}

export const TicketConfigSection: React.FC<TicketConfigSectionProps> = ({
  dashboardConfig,
  onUpdateDashboardConfig,
}) => {
  const ticketConfig: TicketConfig = dashboardConfig?.ticketConfig ?? {
    width: '80mm',
    fontFamily: 'mono',
    showLogo: true,
    showSlogan: true,
    showTaxBreakdown: true,
    showEmployeeName: true,
    showFooterMessage: true,
    footerMessageText: '¡Gracias por su compra!',
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Printer className="w-4 h-4 text-indigo-600" />
        <h4 className="font-bold text-slate-800 text-sm">Configuración de Ticket / Recibo</h4>
      </div>

      {/* Ancho & Tipografía */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600 block">Ancho de Papel</label>
          <select
            value={ticketConfig.width}
            onChange={(e) =>
              onUpdateDashboardConfig({
                ...dashboardConfig,
                ticketConfig: { ...ticketConfig, width: e.target.value as '58mm' | '80mm' },
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          >
            <option value="80mm">80mm (Estándar POS)</option>
            <option value="58mm">58mm (Compacto)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600 block">Tipografía</label>
          <select
            value={ticketConfig.fontFamily}
            onChange={(e) =>
              onUpdateDashboardConfig({
                ...dashboardConfig,
                ticketConfig: { ...ticketConfig, fontFamily: e.target.value as 'mono' | 'sans' | 'serif' },
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          >
            <option value="mono">Monospace (Térmico)</option>
            <option value="sans">Sans-Serif (Limpio)</option>
            <option value="serif">Serif (Clásico)</option>
          </select>
        </div>
      </div>

      {/* Checkboxes para elementos mostrados */}
      <div className="space-y-2 pt-1">
        <label className="text-[11px] font-bold text-slate-600 block">Elementos a Mostrar</label>
        <div className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ticketConfig.showLogo}
              onChange={(e) =>
                onUpdateDashboardConfig({
                  ...dashboardConfig,
                  ticketConfig: { ...ticketConfig, showLogo: e.target.checked },
                })
              }
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Mostrar Logo</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ticketConfig.showSlogan}
              onChange={(e) =>
                onUpdateDashboardConfig({
                  ...dashboardConfig,
                  ticketConfig: { ...ticketConfig, showSlogan: e.target.checked },
                })
              }
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Mostrar Slogan</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ticketConfig.showTaxBreakdown}
              onChange={(e) =>
                onUpdateDashboardConfig({
                  ...dashboardConfig,
                  ticketConfig: { ...ticketConfig, showTaxBreakdown: e.target.checked },
                })
              }
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Desglosar Subtotal / ITBIS</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ticketConfig.showEmployeeName}
              onChange={(e) =>
                onUpdateDashboardConfig({
                  ...dashboardConfig,
                  ticketConfig: { ...ticketConfig, showEmployeeName: e.target.checked },
                })
              }
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Mostrar Cajero ("Atendido por")</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ticketConfig.showFooterMessage}
              onChange={(e) =>
                onUpdateDashboardConfig({
                  ...dashboardConfig,
                  ticketConfig: { ...ticketConfig, showFooterMessage: e.target.checked },
                })
              }
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Mostrar Mensaje de Pie</span>
          </label>
        </div>
      </div>

      {/* Texto del Mensaje al Pie */}
      {ticketConfig.showFooterMessage && (
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600 block">Mensaje de Pie de Ticket</label>
          <input autoComplete="off"
            type="text"
            value={ticketConfig.footerMessageText || ''}
            onChange={(e) =>
              onUpdateDashboardConfig({
                ...dashboardConfig,
                ticketConfig: { ...ticketConfig, footerMessageText: e.target.value },
              })
            }
            placeholder="ej. ¡Gracias por su compra!"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
        </div>
      )}
    </div>
  );
};
