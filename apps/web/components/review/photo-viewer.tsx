'use client';

import { useEffect, useRef } from 'react';

/** Full-screen photo; pinch to zoom (native), tap Close or Escape to leave. */
export function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-50 overflow-auto bg-ink/95 [touch-action:pinch-zoom_pan-x_pan-y]">
      <button
        ref={close}
        onClick={onClose}
        className="fixed top-[calc(0.5rem+env(safe-area-inset-top))] right-3 z-10 min-h-11 rounded-[4px] bg-paper/90 px-4 text-sm text-oxblood"
      >
        Close
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Scanned photo" className="mx-auto min-h-full w-full object-contain" />
    </div>
  );
}
