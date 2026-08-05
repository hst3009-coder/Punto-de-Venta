import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Category, Product } from '../types';
import { firestoreService } from '../lib/firebase';
import { Folder, ChevronDown } from 'lucide-react';

interface CategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
  categories?: Category[];
  products?: Product[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  value,
  onChange,
  categories,
  products,
  placeholder = 'Todas las categorías / Departamentos',
  className = '',
  id,
}) => {
  const [internalCategories, setInternalCategories] = useState<Category[]>([]);
  const [internalProducts, setInternalProducts] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!categories) {
      firestoreService.getCollectionDocs<Category>('categories')
        .then(setInternalCategories)
        .catch(err => console.warn('CategoryPicker: Error loading categories', err));
    }
  }, [categories]);

  useEffect(() => {
    if (!products) {
      firestoreService.getCollectionDocs<Product>('products')
        .then(setInternalProducts)
        .catch(err => console.warn('CategoryPicker: Error loading products', err));
    }
  }, [products]);

  const finalCategories = categories || internalCategories;
  const finalProducts = products || internalProducts;

  // Extract suggestions: name and emoji (or category id)
  const suggestions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; emoji?: string }>();
    map.set('all', { id: 'all', name: 'Todas las categorías', emoji: '🏷️' });

    finalCategories.forEach(c => {
      if (c.id && c.name) {
        map.set(c.id, { id: c.id, name: c.name, emoji: c.emoji });
      }
    });

    finalProducts.forEach(p => {
      if (p.category && !map.has(p.category)) {
        map.set(p.category, { id: p.category, name: p.category });
      }
    });

    return Array.from(map.values());
  }, [finalCategories, finalProducts]);

  const filteredSuggestions = useMemo(() => {
    if (!value.trim() || value === 'all') return suggestions;
    const q = value.toLowerCase();
    return suggestions.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [value, suggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        filteredSuggestions.length > 0 ? (prev + 1) % filteredSuggestions.length : -1
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
        onChange(filteredSuggestions[highlightedIndex].id);
        setIsOpen(false);
        setHighlightedIndex(-1);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const displayValue = useMemo(() => {
    const matched = suggestions.find(s => s.id === value || s.name === value);
    if (matched) {
      return matched.emoji ? `${matched.emoji} ${matched.name}` : matched.name;
    }
    return value;
  }, [value, suggestions]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <Folder className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input autoComplete="off"
          id={id}
          type="text"
          value={isOpen ? value : displayValue}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all uppercase"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          tabIndex={-1}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-52 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs">
          {filteredSuggestions.map((item, index) => (
            <li
              key={item.id}
              onClick={() => {
                onChange(item.id);
                setIsOpen(false);
                setHighlightedIndex(-1);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 cursor-pointer font-medium uppercase flex items-center gap-2 ${
                index === highlightedIndex ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{item.emoji || '🏷️'}</span>
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
