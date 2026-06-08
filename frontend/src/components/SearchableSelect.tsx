import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check, Cpu } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  footerCountLabel?: string;
  disabled?: boolean;
  required?: boolean;
  compact?: boolean;
  id?: string;
  className?: string;
}

function OptionLabel({
  label,
  subLabel,
  compact = false,
}: {
  label: string;
  subLabel?: string;
  compact?: boolean;
}) {
  if (!subLabel) {
    return <span className="truncate">{label}</span>;
  }
  return (
    <span className={`flex items-center gap-1.5 min-w-0 ${compact ? 'gap-1' : ''}`}>
      <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200 font-mono">
        {subLabel}
      </span>
      <span className="truncate text-gray-900">{label}</span>
    </span>
  );
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search...',
  footerCountLabel = 'options',
  disabled = false,
  required = false,
  compact = false,
  id,
  className = '',
}) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>({});
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.subLabel || '').toLowerCase().includes(q)
    );
  }, [options, search]);

  const selectableFiltered = React.useMemo(
    () => filtered.filter((o) => !o.disabled),
    [filtered]
  );

  const updatePanelPosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = Math.max(rect.width, compact ? 260 : 280);
    const maxHeight = 288;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 220 && rect.top > spaceBelow;
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8);

    setPanelStyle({
      position: 'fixed',
      left: Math.max(8, left),
      width: panelWidth,
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      zIndex: 10000,
      maxHeight,
    });
  }, [compact]);

  const openPanel = () => {
    if (disabled) return;
    setOpen(true);
    setSearch('');
    setHighlightIndex(0);
    requestAnimationFrame(updatePanelPosition);
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
    updatePanelPosition();
    const onReposition = () => updatePanelPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePanelPosition, search]);

  React.useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closePanel();
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
    if (highlightIndex >= selectableFiltered.length) {
      setHighlightIndex(Math.max(0, selectableFiltered.length - 1));
    }
  }, [selectableFiltered.length, highlightIndex]);

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
      setHighlightIndex((i) => Math.min(i + 1, selectableFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectableFiltered[highlightIndex]) {
      e.preventDefault();
      selectOption(selectableFiltered[highlightIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  };

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const highlighted = selectableFiltered[highlightIndex];
    if (!highlighted) return;
    const el = listRef.current.querySelector(`[data-value="${CSS.escape(highlighted.value)}"]`) as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open, selectableFiltered]);

  const triggerPadding = compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm';

  const panel = open ? (
    <div
      ref={panelRef}
      style={panelStyle}
      className="rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 overflow-hidden flex flex-col"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
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
            className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <ul
        ref={listRef}
        role="listbox"
        className="overflow-y-auto py-1 flex-1 min-h-0"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-sm text-gray-500 text-center">No matches</li>
        ) : (
          filtered.map((opt) => {
            const isSelected = opt.value === value;
            const selectableIndex = selectableFiltered.findIndex((o) => o.value === opt.value);
            const isHighlighted = !opt.disabled && selectableIndex === highlightIndex;
            return (
              <li
                key={opt.value}
                data-value={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onMouseEnter={() => {
                  if (!opt.disabled && selectableIndex >= 0) setHighlightIndex(selectableIndex);
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(opt)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2
                  ${compact ? 'text-xs' : 'text-sm'}
                  ${opt.disabled ? 'opacity-45 cursor-not-allowed border-l-transparent bg-gray-50/80' : 'border-l-transparent'}
                  ${isHighlighted ? 'bg-indigo-50 text-indigo-950 border-l-indigo-500' : !opt.disabled ? 'text-gray-800 hover:bg-slate-50' : ''}
                  ${isSelected ? 'font-semibold' : ''}`}
              >
                <span className="flex-1 min-w-0">
                  <OptionLabel label={opt.label} subLabel={opt.subLabel} compact={compact} />
                </span>
                {opt.disabled && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">In use</span>
                )}
                {isSelected && !opt.disabled && <Check className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />}
              </li>
            );
          })
        )}
      </ul>

      {!search.trim() && options.length > 8 && (
        <div className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100 bg-gray-50 shrink-0">
          Type to search {options.length} {footerCountLabel}
        </div>
      )}
    </div>
  ) : null;

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
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={`w-full flex items-center gap-2 rounded-lg border bg-white text-left shadow-sm transition-all
          ${triggerPadding}
          ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200' : 'hover:border-indigo-300 border-gray-300 cursor-pointer'}
          ${open ? 'ring-2 ring-indigo-400 border-indigo-400' : ''}
          ${selected ? 'bg-indigo-50/30' : ''}`}
      >
        <Cpu className={`shrink-0 ${selected ? 'text-indigo-600' : 'text-gray-400'} ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} aria-hidden />
        <span className={`flex-1 min-w-0 ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? (
            <OptionLabel label={selected.label} subLabel={selected.subLabel} compact={compact} />
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={clearSelection}
            className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded"
            aria-label="Clear selection"
          >
            <X className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </span>
        )}
        <ChevronDown
          className={`shrink-0 text-gray-500 transition-transform ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  );
};
