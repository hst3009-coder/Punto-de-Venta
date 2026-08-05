import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, AccountPayable, Supplier } from '../types';
import { firestoreService } from '../lib/firebase';
import { getStringValue } from '../lib/normalize';
import { User, ChevronDown, Phone, Building2 } from 'lucide-react';

interface SupplierPickerProps {
  value: string;
  onChange: (value: string) => void;
  products?: Product[];
  payables?: AccountPayable[];
  suppliers?: Supplier[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export const SupplierPicker: React.FC<SupplierPickerProps> = ({
  value,
  onChange,
  products,
  payables,
  suppliers,
  placeholder = 'Escribe o selecciona proveedor...',
  className = '',
  id,
}) => {
  const [internalProducts, setInternalProducts] = useState<Product[]>([]);
  const [internalPayables, setInternalPayables] = useState<AccountPayable[]>([]);
  const [internalSuppliers, setInternalSuppliers] = useState<Supplier[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load products if not provided
  useEffect(() => {
    if (!products) {
      firestoreService.getCollectionDocs<Product>('products')
        .then(setInternalProducts)
        .catch(err => console.warn('SupplierPicker: Error loading products', err));
    }
  }, [products]);

  // Load payables if not provided
  useEffect(() => {
    if (!payables) {
      firestoreService.getCollectionDocs<AccountPayable>('accountsPayable')
        .then(setInternalPayables)
        .catch(err => console.warn('SupplierPicker: Error loading payables', err));
    }
  }, [payables]);

  // Load suppliers if not provided
  useEffect(() => {
    if (!suppliers) {
      firestoreService.getCollectionDocs<Supplier>('suppliers')
        .then(setInternalSuppliers)
        .catch(err => console.warn('SupplierPicker: Error loading suppliers', err));
    }
  }, [suppliers]);

  const finalProducts = products || internalProducts;
  const finalPayables = payables || internalPayables;
  const finalSuppliers = suppliers || internalSuppliers;

  // Map of supplier details by name
  const supplierDetailsMap = useMemo(() => {
    const map = new Map<string, Supplier>();
    finalSuppliers.forEach((s) => {
      if (s.name && s.name.trim()) {
        map.set(s.name.trim().toLowerCase(), s);
      }
    });
    return map;
  }, [finalSuppliers]);

  // Extract unique suggestions from suppliers, products, and accountsPayable
  const suggestions = useMemo(() => {
    const set = new Set<string>();
    finalSuppliers.forEach((s) => {
      const name = getStringValue(s.name).trim();
      if (name) set.add(name);
    });
    finalProducts.forEach(p => {
      const provider = getStringValue(p.provider).trim();
      if (provider) set.add(provider);
    });
    finalPayables.forEach(ap => {
      const supplierName = getStringValue(ap.supplierName).trim();
      if (supplierName) set.add(supplierName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [finalSuppliers, finalProducts, finalPayables]);

  // Filter suggestions based on typed value
  const filteredSuggestions = useMemo(() => {
    if (!value.trim()) return suggestions;
    const q = value.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(q));
  }, [value, suggestions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      setHighlightedIndex(prev => 
        filteredSuggestions.length > 0 
          ? (prev + 1) % filteredSuggestions.length 
          : -1
      );
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlightedIndex(prev => 
        filteredSuggestions.length > 0 
          ? (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length 
          : -1
      );
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        onChange(filteredSuggestions[highlightedIndex]);
        setIsOpen(false);
        setHighlightedIndex(-1);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
      e.preventDefault();
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto py-1">
          {filteredSuggestions.map((suggestion, index) => {
            const savedSupplier = supplierDetailsMap.get(suggestion.toLowerCase());
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-3.5 py-2 text-xs border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between gap-2 ${
                  index === highlightedIndex
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-700 font-semibold hover:bg-slate-50'
                }`}
              >
                <span>{suggestion}</span>
                {savedSupplier && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-normal shrink-0">
                    {savedSupplier.phone && (
                      <span className="flex items-center gap-0.5 text-emerald-700 font-mono font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        <Phone className="w-3 h-3" />
                        {savedSupplier.phone}
                      </span>
                    )}
                    {savedSupplier.contactName && !savedSupplier.phone && (
                      <span className="truncate max-w-[100px]">{savedSupplier.contactName}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
