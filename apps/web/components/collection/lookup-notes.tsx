'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** For a perfume with no notes: ask the server to look them up (memory, then web search). */
export function LookupNotes({ perfumeId }: { perfumeId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'none' | 'error'>('idle');

  async function lookUp() {
    setState('busy');
    try {
      const res = await fetch(`/api/perfumes/${perfumeId}/enrich`, { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const { found } = (await res.json()) as { found: boolean };
      if (found) router.refresh();
      setState(found ? 'idle' : 'none');
    } catch {
      setState('error');
    }
  }

  if (state === 'busy') return <p className="text-sm text-muted" role="status">Searching the web… this can take half a minute.</p>;
  return (
    <div className="text-sm text-muted">
      <p>{state === 'none' ? 'Nothing reliable found. Add them with Edit details.' : state === 'error' ? 'The lookup failed. Try again later.' : 'Notes unknown.'}</p>
      {state !== 'none' && (
        <button type="button" onClick={lookUp} className="mt-1 min-h-11 text-oxblood underline underline-offset-4">
          Look up notes
        </button>
      )}
    </div>
  );
}
