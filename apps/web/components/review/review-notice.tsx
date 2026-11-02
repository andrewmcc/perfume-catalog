import Link from 'next/link';
import { connection } from 'next/server';
import { reviewCount } from '@/lib/scans/queue';
import { createServerClient } from '@/lib/supabase/server';

/** "N to review" above Today's content; nothing when the queue is empty. */
export async function ReviewNotice() {
  await connection();
  const n = await reviewCount(await createServerClient());
  if (n === 0) return null;
  return (
    <Link href="/review" className="label-card mb-5 flex min-h-11 items-center justify-between px-4 py-3 text-ink">
      <span>
        <span className="font-display text-lg italic">{n} to review</span>
        <span className="block text-sm text-muted">Check what the scanner read, then add it to your shelf.</span>
      </span>
      <span aria-hidden="true" className="text-oxblood">
        →
      </span>
    </Link>
  );
}
