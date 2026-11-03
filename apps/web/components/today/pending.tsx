'use client';

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from 'react';
import { FlaconMark } from '@/components/ui/loading-flacon';

type Pending = { isPending: boolean; startTransition: TransitionStartFunction };
const PendingContext = createContext<Pending>({ isPending: false, startTransition: (f) => void f() });

/** Shares one transition between the controls that change Today and the picks they change. */
export function PendingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return <PendingContext.Provider value={{ isPending, startTransition }}>{children}</PendingContext.Provider>;
}

export const usePending = () => useContext(PendingContext);

/** Dims what is about to change (no layout shift) and says so while the new picks load. */
/** `label` is announced and shown over this region; leave it out for a region that only dims. */
export function PendingRegion({ children, label }: { children: ReactNode; label?: string }) {
  const { isPending } = usePending();
  return (
    <div className="relative">
      <div aria-busy={isPending} className={`transition-opacity duration-200 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
        {children}
      </div>
      {/* Always mounted, outside the busy region, so changing its text is announced. */}
      {label && (
        <p role="status" className="sr-only">
          {isPending ? label : ''}
        </p>
      )}
      {isPending && label && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[45%] flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm text-muted shadow-sm">
            <FlaconMark />
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
