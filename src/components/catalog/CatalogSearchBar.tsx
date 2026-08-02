import React, { useRef } from 'react';
import { Search, X as XIcon } from 'lucide-react';

export interface CatalogSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchExpanded: boolean;
  setIsSearchExpanded: (expanded: boolean) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  categoriesList: string[];
}

export const CatalogSearchBar: React.FC<CatalogSearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  isSearchExpanded,
  setIsSearchExpanded,
  selectedCategory,
  setSelectedCategory,
  categoriesList,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 gap-3">
      {!isSearchExpanded ? (
        /* Collapsed Search Icon Button */
        <button
          type="button"
          onClick={() => {
            setIsSearchExpanded(true);
            setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-2 text-xs font-bold shrink-0"
          title="Buscar productos"
        >
          <Search className="w-4 h-4 text-slate-600" />
          <span className="hidden sm:inline text-slate-500 font-medium">Buscar...</span>
        </button>
      ) : (
        /* Expanded Search Bar */
        <div className="relative flex-1 flex items-center gap-2 max-w-2xl animate-fade-in">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              placeholder="Buscar por nombre, SKU, código, categoría, proveedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => {
                if (!searchQuery.trim()) {
                  setIsSearchExpanded(false);
                }
              }}
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-850 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpiar texto"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setSearchQuery('');
              setIsSearchExpanded(false);
            }}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Cerrar búsqueda"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category Pills (Hidden when search is expanded) */}
      {!isSearchExpanded && (
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas las Categorías
          </button>
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>📁</span>
              <span>{cat}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
