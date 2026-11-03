/** Stands in for a missing photo: a drawn flacon on the label paper, so it reads as "no photo", not "broken". */
export function NoPhoto({ className = 'h-14 w-14' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-[3px] bg-line-soft/60 ${className}`}>
      <svg viewBox="-30 -52 60 98" className="h-3/5 w-3/5">
        <rect x="-9" y="-48" width="18" height="12" rx="2" className="fill-none stroke-line" strokeWidth="2.5" />
        <path d="M-5 -36V-28M5 -36V-28" className="stroke-line" strokeWidth="2.5" />
        <path d="M-20 -16C-20 -24 -14 -28 -6 -28H6C14 -28 20 -24 20 -16V30C20 36 16 40 10 40H-10C-16 40 -20 36 -20 30Z" className="fill-none stroke-line" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
