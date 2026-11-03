'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { sheets } from './sheet-stack';

/**
 * Bottom sheet: the backdrop fades in and the panel slides up. Escape or a tap on the backdrop
 * closes it (not while `busy`); focus moves into the panel and back to the trigger on close; the
 * page behind doesn't scroll. Nested sheets: only the top one answers Escape.
 */
export function Sheet({ label, onClose, busy = false, children, className = '' }: { label: string; onClose: () => void; busy?: boolean; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const isBusy = useRef(busy);
  close.current = onClose;
  isBusy.current = busy;

  useEffect(() => {
    const id = sheets.open();
    const opener = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const first = panel.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button, a[href]');
    (first ?? panel.current)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sheets.isTop(id) && !isBusy.current) {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      sheets.close(id);
      if (sheets.size() === 0) document.body.style.overflow = overflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="sheet-backdrop fixed inset-0 z-40 flex items-end bg-ink/40"
      onClick={(e) => {
        // Only a tap on the backdrop itself; taps inside bubble from nested content.
        if (e.target === e.currentTarget && !isBusy.current) close.current();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        className={`sheet-panel label-card mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-b-none px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
