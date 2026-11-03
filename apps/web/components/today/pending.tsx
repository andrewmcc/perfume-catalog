'use client';

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from 'react';
import { LoadingFlacon } from '@/components/ui/loading-flacon';

type Pending = { isPending: boolean; startTransition: TransitionStartFunction };
const PendingContext = createContext<Pending>({ isPending: false, startTransition: (f) => void f() });

/** Shares one transition between the controls that change Today and the picks they change. */
export function PendingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return <PendingContext.Provider value={{ isPending, startTransition }}>{children}</PendingContext.Provider>;
}

export const usePending = () => useContext(PendingContext);

/** Dims what is about to change (no layout shift) and says so while the new picks load. */
export function PendingRegion({ children, label }: { children: ReactNode; label: string }) {
  const { isPending } = usePending();
  return (
    <div aria-busy={isPending} className="relative">
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-40' : 'opacity-100'}`}>{children}</div>
      {isPending && (
        <div className="pointer-events-none absolute inset-x-0 top-[45%] flex justify-center">
          <LoadingFlacon size="sm" label={label} className="rounded-full bg-card px-3 py-1.5 shadow-sm" />
        </div>
      )}
    </div>
  );
}
