import type { ReactNode } from 'react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-8 px-6 pb-10 pt-[max(15vh,env(safe-area-inset-top))]">
      <p className="text-3xl font-semibold tracking-tight">Perfume Catalog</p>
      {children}
    </main>
  );
}

export const inputClass = 'min-h-11 w-full rounded-md border border-black/20 bg-transparent px-3 text-base dark:border-white/25';
export const buttonClass = 'min-h-11 w-full rounded-md bg-foreground px-4 text-base font-medium text-background disabled:opacity-60';
