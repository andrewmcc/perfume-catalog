import type { InputHTMLAttributes, ReactNode } from 'react';

/** Label above a text input; the label text is the field's accessible name. `hint` is an error; `help` is a quiet note. */
export function Field({
  label,
  hint,
  help,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; help?: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm text-muted ${className}`}>
      {label}
      <input
        className={`min-h-11 rounded-[3px] border bg-card px-3 text-[16px] text-ink placeholder:text-muted/70 focus:border-oxblood focus:outline-none ${hint ? 'border-danger ring-1 ring-danger' : 'border-line'}`}
        aria-invalid={hint ? true : undefined}
        {...props}
      />
      {help && <span className="text-[13px]">{help}</span>}
      {hint && <span className="text-[13px] text-danger">{hint}</span>}
    </label>
  );
}
