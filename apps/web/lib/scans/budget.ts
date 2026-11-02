// Time limits that keep extraction inside one Vercel function invocation, so a scan is never
// killed mid-call and left `processing`.

/** Must equal `maxDuration` in app/api/scans/* (Next needs those as literals). */
export const ROUTE_MAX_DURATION_S = 300;
/** Per Claude request. Extraction typically takes 2–10 s. */
export const CLAUDE_TIMEOUT_MS = 55_000;
/** SDK retries on 408/409/429/5xx. Each scan tries at most twice on top of this. */
export const CLAUDE_MAX_RETRIES = 1;
/** The sweep starts no new scan after this, so the last one still finishes in time. */
export const SWEEP_START_BUDGET_MS = 60_000;

/** Runs tasks with at most `limit` in flight, starting none after `startBudgetMs`. Task errors are swallowed. */
export async function runLimited<T>(items: T[], limit: number, startBudgetMs: number, task: (item: T) => Promise<unknown>): Promise<void> {
  const deadline = Date.now() + startBudgetMs;
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      if (Date.now() > deadline) return;
      await task(item).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}
