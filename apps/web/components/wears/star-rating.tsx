'use client';

/** 1–5 stars. With onChange each star is a 44 px button; tapping the current rating clears it. */
export function StarRating({ value, onChange, className = '' }: { value: number | null; onChange?: (v: number | null) => void; className?: string }) {
  const stars = [1, 2, 3, 4, 5];
  if (!onChange) {
    if (value == null) return null;
    return (
      <span className={`text-gold-deep ${className}`} role="img" aria-label={`${value} of 5 stars`}>
        {stars.map((n) => (n <= value ? '★' : '☆')).join('')}
      </span>
    );
  }
  return (
    <span role="group" aria-label="Rating" className={`inline-flex ${className}`}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={n === 1 ? '1 star' : `${n} stars`}
          aria-pressed={value != null && n <= value}
          onClick={() => onChange(value === n ? null : n)}
          className="flex h-11 w-11 items-center justify-center text-[26px] leading-none text-gold-deep"
        >
          {value != null && n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  );
}
