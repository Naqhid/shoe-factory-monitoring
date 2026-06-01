import React from 'react';
import { HelpCircle } from 'lucide-react';

type Props = {
  text: string;
  label?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
};

/** Tap ? to show help text — avoids clipped hover tooltips inside scroll modals. */
export function CycleInfoTip({ text, label, className = '', fullWidth = false }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <span className={`${fullWidth ? 'block w-full' : 'inline-flex flex-col items-start max-w-full'} ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 text-left touch-manipulation rounded-md hover:bg-gray-100/80 active:bg-gray-200/80 px-0.5 -mx-0.5"
        aria-expanded={open}
        aria-label={open ? 'Hide help' : 'Show help'}
      >
        {label}
        <HelpCircle className={`h-3.5 w-3.5 shrink-0 ${open ? 'text-blue-600' : 'text-gray-400'}`} />
      </button>
      {open && (
        <p
          role="note"
          className={`mt-1.5 rounded-lg border border-gray-600 bg-gray-900 text-white text-xs leading-relaxed px-3 py-2.5 shadow-lg whitespace-pre-line ${
            fullWidth ? 'w-full' : 'w-[min(100%,18rem)]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </p>
      )}
    </span>
  );
}
