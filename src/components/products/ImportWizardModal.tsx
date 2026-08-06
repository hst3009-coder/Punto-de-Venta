import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Upload, 
  ChevronRight, 
  ChevronLeft, 
  Download,
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet,
  Settings2,
  Table2,
  Tags,
  Loader2,
  Database,
  ArrowRight,
  Info,
  RefreshCw
} from 'lucide-react';
import { Product, Category } from '../../types';
import { useAlert } from '../../context/AlertContext';
import { firestoreService } from '../../lib/firebase';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
}

type Step = 1 | 2 | 3 | 4 | 5;

interface Mapping {
  [key: string]: number; // fieldKey -> columnIndex
}

interface CategoryMapping {
  [excelValue: string]: {
    type: 'existing' | 'new';
    value: string;
  };
}

const SYSTEM_FIELDS = [
  { key: 'name', label: 'Nombre', required: true, matches: ['nombre', 'producto', 'name', 'item', 'descripcion'] },
  { key: 'code', label: 'Código', required: true, matches: ['codigo', 'codigo de barra', 'code', 'barcode', 'id_producto'] },
  { key: 'sku', label: 'SKU', required: false, matches: ['sku', 'referencia'] },
  { key: 'cost', label: 'Costo', required: false, matches: ['costo', 'cost', 'precio de costo', 'precio_costo', 'costo_unitario'] },
  { key: 'price', label: 'Precio de Venta', required: false, matches: ['venta', 'precio', 'precio de venta', 'price', 'pvp', 'precio_venta'] },
  { key: 'category', label: 'Categoría', required: false, matches: ['categoria', 'category', 'cat', 'tipo'] },
  { key: 'provider', label: 'Proveedor', required: false, matches: ['proveedor', 'provider', 'supplier', 'fabricante'] },
  { key: 'stock', label: 'Stock/Cantidad', required: false, matches: ['stock', 'existencia', 'existencias', 'cantidad', 'qty', 'inventario'] },
  { key: 'expirationDate', label: 'Fecha Vencimiento', required: false, matches: ['vencimiento', 'expira', 'expiration', 'vence'] },
];

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  isOpen,
  onClose,
  products,
  categories
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [step, setStep] = useState<Step>(1);
  const [fileData, setFileData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [mappings, setMappings] = useState<Mapping>({});
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetWizard = () => {
    setStep(1);
    setFileData([]);
    setHeaders([]);
    setFileName('');
    setMappings({});
    setCategoryMappings({});
    setImporting(false);
    setProgress({ current: 0, total: 0 });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length < 2) {
          showAlert('Error', 'El archivo no tiene suficientes datos.', 'error');
          return;
        }

        const rawHeaders = data[0].map(h => String(h || '').trim());
        setHeaders(rawHeaders);
        setFileData(data.slice(1));
        
        // Auto-mapping logic
        const initialMappings: Mapping = {};
        rawHeaders.forEach((header, index) => {
          const normalizedHeader = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const matchedField = SYSTEM_FIELDS.find(field => 
            field.matches.some(m => normalizedHeader.includes(m))
          );
          if (matchedField && !Object.values(initialMappings).includes(index)) {
            initialMappings[matchedField.key] = index;
          }
        });
        setMappings(initialMappings);

      } catch (err) {
        console.error('Error parsing file:', err);
        showAlert('Error', 'No se pudo leer el archivo.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const uniqueExcelCategories = useMemo(() => {
    const catIdx = mappings['category'];
    if (catIdx === undefined) return [];
    const set = new Set<string>();
    fileData.forEach(row => {
      const val = String(row[catIdx] || '').trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [fileData, mappings]);

  const handleNextStep = () => {
    if (step === 2) {
      const catIdx = mappings['category'];
      if (catIdx !== undefined) {
        // Prepare initial category mappings
        const initialCatMappings: CategoryMapping = {};
        uniqueExcelCategories.forEach(cat => {
          const existing = categories.find(c => c.name.toLowerCase() === cat.toLowerCase());
          if (existing) {
            initialCatMappings[cat] = { type: 'existing', value: existing.id };
          } else {
            initialCatMappings[cat] = { type: 'new', value: cat };
          }
        });
        setCategoryMappings(initialCatMappings);
        setStep(3);
      } else {
        setStep(4);
      }
    } else {
      setStep((step + 1) as Step);
    }
  };

  const processedProducts = useMemo(() => {
    const results: { product: Product; isUpdate: boolean; hasError: boolean; error?: string }[] = [];
    
    fileData.forEach(row => {
      const nameIdx = mappings['name'];
      const codeIdx = mappings['code'];
      
      const rawName = nameIdx !== undefined ? String(row[nameIdx] || '').trim() : '';
      const rawCode = codeIdx !== undefined ? String(row[codeIdx] || '').trim() : '';
      
      if (!rawName || !rawCode) {
        results.push({
          product: {} as Product,
          isUpdate: false,
          hasError: true,
          error: !rawName ? 'Falta Nombre' : 'Falta Código'
        });
        return;
      }

      // Check if code already exists
      const existing = products.find(p => p.code === rawCode || p.barcode === rawCode);
      
      const finalCategory = mappings['category'] !== undefined 
        ? (categoryMappings[String(row[mappings['category']] || '').trim()]?.value || 'otros')
        : (categories.find(c => c.id !== 'all')?.id || 'otros');

      const product: Product = {
        id: existing?.id || 'custom-' + crypto.randomUUID(),
        name: rawName,
        code: rawCode,
        barcode: rawCode,
        category: finalCategory,
        price: parseFloat(String(row[mappings['price']] || '0')) || 0,
        cost: parseFloat(String(row[mappings['cost']] || '0')) || 0,
        stock: parseInt(String(row[mappings['stock']] || '0')) || 0,
        sku: mappings['sku'] !== undefined ? String(row[mappings['sku']] || '').trim() : undefined,
        provider: mappings['provider'] !== undefined ? String(row[mappings['provider']] || '').trim() : undefined,
        expirationDate: mappings['expirationDate'] !== undefined ? String(row[mappings['expirationDate']] || '').trim() : undefined,
        color: existing?.color || 'bg-slate-50 text-slate-800 border-slate-200',
        emoji: existing?.emoji || '🏷️',
        visible: existing?.visible ?? true,
      };

      // Calculate profit percent
      if (product.cost && product.cost > 0) {
        product.profitPercent = Number(((product.price - product.cost) / product.cost * 100).toFixed(2));
      }

      results.push({
        product,
        isUpdate: !!existing,
        hasError: false
      });
    });

    return results;
  }, [fileData, mappings, categoryMappings, products, categories]);

  const stats = useMemo(() => {
    const valid = processedProducts.filter(p => !p.hasError);
    return {
      new: valid.filter(p => !p.isUpdate).length,
      updates: valid.filter(p => p.isUpdate).length,
      errors: processedProducts.filter(p => p.hasError).length,
      total: valid.length
    };
  }, [processedProducts]);

  if (!isOpen) return null;

  const handleExecuteImport = async () => {
    const confirm = await showConfirm(
      'Confirmar Importación',
      `Se procesarán ${stats.total} productos (${stats.new} nuevos, ${stats.updates} actualizaciones). ¿Deseas realizar un respaldo antes de continuar?`
    );

    if (!confirm) return;

    setImporting(true);
    const validProducts = processedProducts.filter(p => !p.hasError);
    const BATCH_SIZE = 400;
    const totalBatches = Math.ceil(validProducts.length / BATCH_SIZE);
    setProgress({ current: 0, total: totalBatches });

    try {
      for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
        const chunk = validProducts.slice(i, i + BATCH_SIZE);
        const ops = chunk.map(p => ({
          type: 'set' as const,
          collectionName: 'products',
          id: p.product.id,
          data: p.product
        }));
        await firestoreService.runBatch(ops);
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      showAlert(
        'Importación Exitosa',
        `Se han procesado correctamente ${stats.total} productos.`,
        'success'
      );
      onClose();
      resetWizard();
    } catch (err) {
      console.error('Batch import error:', err);
      showAlert('Error', 'Hubo un problema durante la importación masiva.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleBackup = () => {
    try {
      const backupData = products.map(prod => ({
        ID: prod.id,
        Nombre: prod.name,
        Codigo: prod.code || prod.barcode || '',
        SKU: prod.sku || '',
        Categoria: prod.category || '',
        Precio: prod.price || 0,
        Costo: prod.cost || 0,
        Stock: prod.stock || 0,
        Proveedor: prod.provider || ''
      }));

      const ws = XLSX.utils.json_to_sheet(backupData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Respaldo_Inventario');
      
      const filename = `respaldo_pos_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showAlert('Éxito', 'Respaldo generado correctamente.', 'success');
    } catch (err) {
      console.error('Backup error:', err);
      showAlert('Error', 'No se pudo generar el respaldo.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Asistente de Importación</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Paso {step} de 5: {
                step === 1 ? 'Subir Archivo' :
                step === 2 ? 'Mapear Columnas' :
                step === 3 ? 'Mapear Categorías' :
                step === 4 ? 'Previsualización' : 'Ejecución'
              }</p>
            </div>
          </div>
          <button 
            onClick={() => { resetWizard(); onClose(); }}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="max-w-lg mx-auto py-10">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-4 border-dashed border-slate-100 rounded-[3rem] p-12 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
              >
                <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-white group-hover:text-indigo-500 shadow-inner transition-all">
                  <FileSpreadsheet className="w-10 h-10" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-slate-700 uppercase">Selecciona tu archivo Excel o CSV</p>
                  <p className="text-xs text-slate-400 font-bold mt-1">Arrastra aquí o haz clic para buscar</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
              </div>

              {fileName && (
                <div className="mt-8 bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-between animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="w-6 h-6 text-indigo-500" />
                    <div>
                      <p className="text-sm font-black text-slate-800">{fileName}</p>
                      <p className="text-[10px] text-indigo-600 font-bold uppercase">{fileData.length} filas detectadas</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleNextStep}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 gap-4">
                {SYSTEM_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-32 shrink-0">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                        {field.label}
                        {field.required && <span className="text-rose-500">*</span>}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                    <div className="flex-1">
                      <select
                        value={mappings[field.key] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                          setMappings(prev => ({ ...prev, [field.key]: val as number }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none"
                      >
                        <option value="">-- No mapeado --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex justify-between items-center">
                <button 
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Atrás
                </button>
                <button 
                  disabled={mappings['name'] === undefined || mappings['code'] === undefined}
                  onClick={handleNextStep}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Category Mapping */}
          {step === 3 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-6 flex gap-3">
                <Info className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-700 font-bold leading-relaxed uppercase">
                  Detectamos {uniqueExcelCategories.length} categorías únicas en tu archivo. Mapealas a categorías existentes o crea nuevas.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {uniqueExcelCategories.map(excelCat => (
                  <div key={excelCat} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                    <span className="text-xs font-black text-slate-700 truncate w-1/3">{excelCat}</span>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                    <div className="flex-1 flex gap-2">
                      <select
                        value={categoryMappings[excelCat]?.value || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const isNew = val === 'NEW';
                          setCategoryMappings(prev => ({
                            ...prev,
                            [excelCat]: { 
                              type: isNew ? 'new' : 'existing', 
                              value: isNew ? excelCat : val 
                            }
                          }));
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="NEW">Crear como nueva: "{excelCat}"</option>
                        <optgroup label="Existentes">
                          {categories.filter(c => c.id !== 'all').map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex justify-between items-center">
                <button 
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Atrás
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
                >
                  Previsualizar
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {step === 4 && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase">Productos Nuevos</p>
                    <p className="text-xl font-black text-indigo-600">{stats.new}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-400 uppercase">Actualizaciones</p>
                    <p className="text-xl font-black text-emerald-600">{stats.updates}</p>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                    <p className="text-[10px] font-black text-rose-400 uppercase">Filas con Error</p>
                    <p className="text-xl font-black text-rose-600">{stats.errors}</p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-2xl shadow-lg">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Total a Procesar</p>
                    <p className="text-xl font-black text-white">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                      <th className="p-4">Estado</th>
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Código</th>
                      <th className="p-4 text-right">Precio</th>
                      <th className="p-4 text-right">Costo</th>
                      <th className="p-4 text-center">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {processedProducts.slice(0, 50).map((row, i) => (
                      <tr key={i} className={`text-xs ${row.hasError ? 'bg-rose-50/30' : 'hover:bg-slate-50/50'} transition-colors`}>
                        <td className="p-4">
                          {row.hasError ? (
                            <span className="flex items-center gap-1 text-rose-600 font-black uppercase text-[9px]">
                              <AlertCircle className="w-3 h-3" />
                              {row.error}
                            </span>
                          ) : row.isUpdate ? (
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-black uppercase text-[9px] tracking-wider">Actualizar</span>
                          ) : (
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-black uppercase text-[9px] tracking-wider">Nuevo</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-slate-700">{row.product.name || <span className="text-rose-300 italic">Sin nombre</span>}</td>
                        <td className="p-4 text-slate-500 font-mono text-[10px]">{row.product.code || <span className="text-rose-300">--</span>}</td>
                        <td className="p-4 text-right font-black text-slate-800">${row.product.price?.toLocaleString()}</td>
                        <td className="p-4 text-right font-bold text-slate-400">${row.product.cost?.toLocaleString()}</td>
                        <td className="p-4 text-center font-black text-slate-600">{row.product.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {processedProducts.length > 50 && (
                  <div className="p-4 bg-slate-50 text-center text-[10px] font-black text-slate-400 uppercase border-t border-slate-100">
                    Y otros {processedProducts.length - 50} productos más...
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-4">
                <div className="flex gap-3">
                  <button 
                    onClick={() => setStep(uniqueExcelCategories.length > 0 ? 3 : 2)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Atrás
                  </button>
                  <button 
                    onClick={handleBackup}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase transition-all border border-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Respaldar Inventario Actual
                  </button>
                </div>
                
                <button 
                  disabled={stats.total === 0}
                  onClick={handleExecuteImport}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-[2rem] text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  Importar {stats.total} Productos
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Progress / Execution */}
          {step === 5 || importing && (
            <div className="max-w-md mx-auto py-20 text-center">
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="absolute inset-0 border-8 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Database className="w-10 h-10 text-indigo-600" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Procesando Importación</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Guardando cambios en el servidor...</p>
              
              <div className="w-full bg-slate-100 rounded-full h-3 mb-3 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-[10px] font-black text-indigo-600 uppercase">Batch {progress.current} de {progress.total}</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default ImportWizardModal;
