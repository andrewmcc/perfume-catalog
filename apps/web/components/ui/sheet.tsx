'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { sheets } from './sheet-stack';

/**
 * Bottom sheet: the backdrop fades in and the panel slides up. Escape or a tap on the backdrop
 * closes it (not while `busy`); focus moves into the panel and back to the trigger on close; the
 * page behind doesn't scroll. Nested sheets: only the top one answers Escape. Portalled to <body>
 * so a nested sheet is never positioned inside another sheet's animated panel.
 */
export function Sheet({
  label,
  onClose,
  busy = false,
  children,
  footer,
  className = '',
}: {
  label: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  /** Stays at the bottom of the sheet while the body scrolls (e.g. Done / Clear). */
  footer?: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Captured during render: autoFocus inside the sheet moves focus before effects run.
  const [opener] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)));
  const close = useRef(onClose);
  const isBusy = useRef(busy);
  close.current = onClose;
  isBusy.current = busy;

  useEffect(() => {
    const id = sheets.open();
    // Leave focus where autoFocus put it; otherwise move it to the first control.
    if (!panel.current?.contains(document.activeElement)) {
      const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button, a[href]');
      (first ?? panel.current)?.focus({ preventScroll: true });
    }

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
      // An opener inside a sheet that's also closing is gone; only return to one still on the page.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);

  if (typeof document === 'undefined') return null;
  return createPortal(
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
      {/* The card (and its fine inner rule) stays put; only the body scrolls inside it. */}
      <div ref={panel} tabIndex={-1} className={`sheet-panel label-card mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col rounded-b-none outline-none ${className}`}>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 ${footer ? 'pb-4' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]'}`}>{children}</div>
        {footer && <div className="border-t border-line-soft px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
