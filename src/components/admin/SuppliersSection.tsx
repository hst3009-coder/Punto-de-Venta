import React, { useState, useMemo } from 'react';
import { Supplier } from '../../types';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  User,
  MapPin,
  X,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { firestoreService } from '../../lib/firebase';
import { useAlert } from '../../context/AlertContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { isFuzzyMatch } from '../../lib/textSearch';

interface SuppliersSectionProps {
  suppliers: Supplier[];
  onSelectSupplier?: (supplierName: string) => void;
}

export const SuppliersSection: React.FC<SuppliersSectionProps> = ({ suppliers, onSelectSupplier }) => {
  const { showAlert, showConfirm } = useAlert();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const filteredSuppliers = useMemo(() => {
    if (!debouncedSearch.trim()) return suppliers;
    return suppliers.filter((s) => {
      const matchName = isFuzzyMatch(debouncedSearch, s.name);
      const matchContact = s.contactName ? isFuzzyMatch(debouncedSearch, s.contactName) : false;
      const matchPhone = s.phone ? isFuzzyMatch(debouncedSearch, s.phone) : false;
      const matchEmail = s.email ? isFuzzyMatch(debouncedSearch, s.email) : false;
      return matchName || matchContact || matchPhone || matchEmail;
    });
  }, [suppliers, debouncedSearch]);

  const handleOpenCreateModal = () => {
    setEditingSupplier(null);
    setName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name || '');
    setContactName(supplier.contactName || '');
    setPhone(supplier.phone || '');
    setEmail(supplier.email || '');
    setAddress(supplier.address || '');
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showAlert('El nombre del proveedor es obligatorio.');
      return;
    }

    try {
      const supplierId = editingSupplier ? editingSupplier.id : `sup_${Date.now()}`;
      const payload: Supplier = {
        id: supplierId,
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toISOString(),
      };

      await firestoreService.setDocWithId('suppliers', supplierId, payload);
      showAlert(
        editingSupplier
          ? `Proveedor "${payload.name}" actualizado correctamente.`
          : `Proveedor "${payload.name}" registrado correctamente.`
      );
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving supplier:', err);
      showAlert('Ocurrió un error al guardar los datos del proveedor.');
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    showConfirm(
      'Eliminar Proveedor',
      `¿Estás seguro de que deseas eliminar al proveedor "${supplier.name}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await firestoreService.deleteDoc('suppliers', supplier.id);
          showAlert(`Proveedor "${supplier.name}" eliminado.`);
        } catch (err) {
          console.error('Error deleting supplier:', err);
          showAlert('Error al eliminar el proveedor.');
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">Directorio de Proveedores</h2>
            <p className="text-xs text-slate-500 font-medium">
              Gestiona los datos de contacto de tus proveedores ({suppliers.length} registrados)
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Proveedor</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoComplete="off"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar proveedor por nombre, contacto, teléfono o correo..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
        />
      </div>

      {/* Suppliers Table */}
      {filteredSuppliers.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
          <div className="p-3 bg-slate-100 text-slate-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-500 font-bold">
            {searchQuery.trim()
              ? 'No se encontraron proveedores que coincidan con la búsqueda.'
              : 'Aún no has registrado ningún proveedor.'}
          </p>
          {!searchQuery.trim() && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
            >
              + Agregar el primer proveedor
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Proveedor</th>
                  <th className="py-3.5 px-4">Persona de Contacto</th>
                  <th className="py-3.5 px-4">Teléfono (WhatsApp)</th>
                  <th className="py-3.5 px-4">Correo Electrónico</th>
                  <th className="py-3.5 px-4">Dirección</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-800">{supplier.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {supplier.contactName ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{supplier.contactName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono">
                      {supplier.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-slate-800">{supplier.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {supplier.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{supplier.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {supplier.address ? (
                        <div className="flex items-center gap-1.5 truncate" title={supplier.address}>
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{supplier.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(supplier)}
                          className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                          title="Editar Proveedor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(supplier)}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar Proveedor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 w-full max-w-md h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">
                  {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="flex-1 overflow-y-auto flex flex-col justify-between">
              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Nombre del Proveedor *
                  </label>
                  <input autoComplete="off"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Distribuidora Dominicana S.R.L."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Persona de Contacto
                  </label>
                  <input autoComplete="off"
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ej. Juan Pérez (Vendedor)"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input autoComplete="off"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 809-555-0199"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se utilizará para el envío de Órdenes de Compra por WhatsApp.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Correo Electrónico
                  </label>
                  <input autoComplete="off"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ej. ventas@distribuidora.com"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Dirección
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej. Av. 27 de Febrero #120, Santo Domingo"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  {editingSupplier ? 'Guardar Cambios' : 'Crear Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
