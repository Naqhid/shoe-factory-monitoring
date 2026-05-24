import React from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search...',
  disabled = false,
  required = false,
  id,
  className = '',
}) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        !o.disabled &&
        (o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    );
  }, [options, search]);

  const openPanel = () => {
    if (disabled) return;
    setOpen(true);
    setSearch('');
    setHighlightIndex(0);
  };

  const closePanel = () => {
    setOpen(false);
    setSearch('');
    setHighlightIndex(0);
  };

  const selectOption = (opt: SearchableSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    closePanel();
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    closePanel();
  };

  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closePanel();
      }
    };
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (highlightIndex >= filtered.length) {
      setHighlightIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, highlightIndex]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openPanel();
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[highlightIndex]) {
      e.preventDefault();
      selectOption(filtered[highlightIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  };

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden
          value={value}
          required
          onChange={() => {}}
          className="absolute w-0 h-0 opacity-0 pointer-events-none"
        />
      )}

      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={`w-full flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-left shadow-sm transition-colors
          ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'hover:border-gray-400 cursor-pointer'}
          ${open ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={clearSelection}
            className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
            <Search className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              aria-label={searchPlaceholder}
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setHighlightIndex(0);
                  searchRef.current?.focus();
                }}
                className="text-gray-400 hover:text-gray-600 p-0.5"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-activedescendant={filtered[highlightIndex] ? `ss-opt-${filtered[highlightIndex].value}` : undefined}
            className="max-h-52 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-gray-500 text-center">No matches</li>
            ) : (
              filtered.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = index === highlightIndex;
                return (
                  <li
                    key={opt.value}
                    id={`ss-opt-${opt.value}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectOption(opt)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer
                      ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                      ${isHighlighted ? 'bg-blue-50 text-blue-900' : 'text-gray-800 hover:bg-gray-50'}
                      ${isSelected ? 'font-medium' : ''}`}
                  >
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />}
                  </li>
                );
              })
            )}
          </ul>

          {!search.trim() && options.length > 8 && (
            <div className="px-3 py-1.5 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
              Type to search {options.length} employees
            </div>
          )}
        </div>
      )}
    </div>
  );
};
