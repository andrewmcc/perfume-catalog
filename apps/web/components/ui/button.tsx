import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-oxblood text-paper hover:bg-[#5a2020] shadow-[inset_0_0_0_3px_var(--color-oxblood),inset_0_0_0_4px_rgba(232,196,106,0.55)]',
  secondary: 'border border-oxblood bg-transparent text-oxblood hover:bg-oxblood/5',
  quiet: 'text-muted hover:text-ink underline underline-offset-4',
};

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] px-5 text-[15px] font-medium tracking-wide transition-colors disabled:opacity-60';

/** A link that looks like a Button. */
export function ButtonLink({ variant = 'primary', className = '', ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
