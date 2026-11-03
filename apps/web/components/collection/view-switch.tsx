'use client';

export type View = 'owned' | 'sets' | 'wishlist' | 'tried';
const VIEWS: { id: View; label: string }[] = [
  { id: 'owned', label: 'Owned' },
  { id: 'sets', label: 'Sets' },
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'tried', label: 'Tried' },
];

export function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="tablist" aria-label="Collection view" className="grid grid-cols-4 rounded-[4px] border border-line bg-card p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={view === v.id}
          onClick={() => onChange(v.id)}
          className={`min-h-10 rounded-[3px] text-sm ${view === v.id ? 'bg-oxblood text-paper' : 'text-muted hover:text-ink'}`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
