/** Runs fn over items one at a time; never throws. Failures are collected with their messages. */
export async function runBatch<T>(items: T[], fn: (t: T) => Promise<void>): Promise<{ ok: T[]; failed: { item: T; error: string }[] }> {
  const ok: T[] = [];
  const failed: { item: T; error: string }[] = [];
  for (const item of items) {
    try {
      await fn(item);
      ok.push(item);
    } catch (e) {
      failed.push({ item, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok, failed };
}
