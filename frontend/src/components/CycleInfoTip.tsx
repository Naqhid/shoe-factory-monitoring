import React from 'react';
import { HelpCircle } from 'lucide-react';

const CYCLE_INFO_TIP_OPEN_EVENT = 'cycle-info-tip-open';

type Props = {
  text: string;
  label?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
};

/** Tap ? to show help text — avoids clipped hover tooltips inside scroll modals. */
export function CycleInfoTip({ text, label, className = '', fullWidth = false }: Props) {
  const [open, setOpen] = React.useState(false);
  const tipIdRef = React.useRef(`tip-${Math.random().toString(36).slice(2)}`);

  React.useEffect(() => {
    const onOtherTipOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id && detail.id !== tipIdRef.current) {
        setOpen(false);
      }
    };
    window.addEventListener(CYCLE_INFO_TIP_OPEN_EVENT, onOtherTipOpen as EventListener);
    return () => {
      window.removeEventListener(CYCLE_INFO_TIP_OPEN_EVENT, onOtherTipOpen as EventListener);
    };
  }, []);

  return (
    <span className={`relative ${fullWidth ? 'block w-full' : 'inline-flex flex-col items-start max-w-full'} ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              window.dispatchEvent(
                new CustomEvent(CYCLE_INFO_TIP_OPEN_EVENT, { detail: { id: tipIdRef.current } })
              );
            }
            return next;
          });
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
          className={`relative z-20 mt-1.5 max-w-full rounded-lg border border-gray-600 bg-gray-900 text-white text-xs leading-relaxed px-3 py-2.5 shadow-lg whitespace-pre-line break-words ${
            fullWidth ? 'w-full' : 'w-[18rem] max-w-[calc(100vw-3rem)]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </p>
      )}
    </span>
  );
}
