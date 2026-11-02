import type { ReactNode } from 'react';

/** Centred engraved label on paper: wordmark above, the form inside a card with a fine inner rule. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <p className="text-center font-display text-4xl tracking-[0.08em] text-oxblood">Flacon</p>
      <div className="label-card px-6 py-7">{children}</div>
    </main>
  );
}

export const linkClass = 'inline-flex min-h-11 items-center text-sm text-oxblood underline underline-offset-4';
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
