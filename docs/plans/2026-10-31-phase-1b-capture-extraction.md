# Phase 1b: Capture and Extraction, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the real Scan screen, which has three modes: **Bottle**, **Samples** and **Set**.
- Photos upload to the collection's folder.
- Each scan is extracted on the server with Claude, into `scans` plus one `scan_results` row per perfume read.
- The Phase 0 spike is deleted.

**Architecture:**
- **`packages/core`:** extraction schemas, prompts, normalisation and status rules. Pure and unit-tested.
- **`apps/web`:** a server-only extraction service that uses the service role. It re-checks membership and paths, writes status transitions and results, and is triggered from two routes: one scan (in `after()`) and "process pending".
- **Capture page:** reuses the spike's tested capture primitives, moved to `lib/capture`. It uploads with the member's browser client, protected by storage RLS from 1a.

This mirrors Seeds' 1b: `~/code/seeds/docs/plans/2026-10-27-phase-1b-capture-extraction.md`, `packages/core/src/extraction/`, `apps/web/lib/scans/` and `apps/web/app/(app)/scan/`.

**Tech Stack:** Next.js 16 (`after()`, route handlers), `@supabase/ssr` browser client, `@anthropic-ai/sdk` structured outputs (`claude-sonnet-5-5`), zod 4, Vitest.

**Spec:** [docs/specs/2026-10-31-design.md](../specs/2026-10-31-design.md) §1 Capture and §2 Identification. See also [docs/decisions.md](../decisions.md), especially "Phase 0 spike findings".

## Global Constraints

- **Capture** (decisions, Phase 0):
  - **Bottle mode:**
    - Auto-capture of the square crop: JPEG, 1600 px long edge, quality 0.85.
    - Gate defaults: `minSharpness 200, maxDiff 15, minEdgeRatio 0, stableMs 500, rearmDiff 25, maxGlare 1`.
    - One photo by default; "+ back / box" adds a second.
  - **Samples and Set:** manual shutter, full frame at native resolution, quality 0.9.
  - **Idle pause:** auto-capture pauses after 20 s.
  - **Feedback:** a pop on every capture and a chime when a capture is queued. No vibration on iPhone; `tryHaptic()` elsewhere.
  - **No session defaults** [my call, YAGNI: the spec names none].
- **Uploads:**
  - The browser client uploads to bucket `photos` at `{collection_id}/{scan_id}/photo-{n}.jpg`, then inserts the `scans` row using the client-insertable columns only (`id, collection_id, created_by, mode, photo_paths`).
  - Scan ids are client-generated (`crypto.randomUUID()`).
  - The current collection comes from `getCurrentCollectionId()` (Task 2).
- **Service role writes:** all writes to scan status, results and `scan_results` use the service role. The server treats a scan row as untrusted. Before reading photos, it re-checks that:
  - the requester is a member of `scan.collection_id`;
  - every entry in `photo_paths` starts with `${collection_id}/${scan.id}/`.
- **Extraction:**
  - Model `claude-sonnet-5-5` via `client.beta.messages.parse` with `betaZodOutputFormat`, `betas: ['server-side-fallback-2026-07-01']` and `fallbacks: 'default'`.
  - Load the `claude-api` skill before writing the call.
  - At most 16 union-typed parameters per schema, enforced by a test that inspects the JSON schema the SDK actually sends: run `betaZodOutputFormat(schema)` and count `anyOf`/`type` arrays.
  - Use `""`/`[]`/`0` sentinels, normalised to null.
- **Prompt rules** (Phase 0, user decisions):
  - Printed, legible text is `clear`.
  - Logos, monograms, crests, signature caps and distinctive bottle designs can identify the house and well-known names. Those values are `unclear` and set `identified_from` to `shape|both`.
  - **Truncated or partly hidden names** [user]: return the **most likely** full name from that house's range, `unclear`, plus up to **2 `alternatives`**.
  - Never invent a value with no evidence.
  - Set mode reads vial labels, and never lists scents from memory.
- **Status machine:**
  - `uploaded → processing → extracted | failed | discarded`.
  - `discarded` when the mode's flag is false (`is_perfume`, `is_perfume_photo` or `is_discovery_set`), with `error = 'not perfume'`.
  - `reviewed` is set by 1c.
  - `attempts` increments on each try. A call retries once, then ends `failed` with the error.
  - **Stuck:**
    - `uploaded` older than 2 minutes;
    - `processing` older than 10 minutes.
- **Claim before work:** one atomic conditional update (`status='processing', attempts=attempts+1 … where id=$1 and <claimable> returning *`). An empty result means do nothing.
  - **Claimable on explicit extract:** `uploaded | failed | stale processing`.
  - **Claimable on sweep:** stuck only.
- **No cron** (Hobby). Pending and stuck scans are kicked off whenever a member opens Scan or Today.
- **Logging:** `console.error('extract', scanId, message)` on every failure.
- **`scan_results` rows** written on `extracted`:
  - **Bottle:** 1 row, `kind 'bottle'`.
  - **Samples:** 1 row per vial, `kind 'vial'`.
  - **Set:** 1 row per scent, `kind 'set_scent'`. The set's own house and name stay in `scans.extraction`.
  - `read` is the normalised perfume read, including `status`, `alternatives` and `identified_from`.
  - Re-extraction replaces a scan's pending results.
- **Spike deletion:**
  - **Code and gating:**
    - Remove `app/spike`, `app/api/spike` and `lib/spike`, after moving the capture primitives and `summarise` out.
    - Remove the spike branch in `proxy.ts` and the spike paths in `isPublicPath`.
    - Remove `scripts/spike-setup.mts`.
  - **Env:** remove `SPIKE_PASSCODE` and `SUPABASE_ANON_KEY` (local + Vercel).
  - **Storage:** empty and delete the bucket `perfume-spike-captures`.
  - **Keep:** `scripts/spike-export-fixtures.mts` until 1c, renamed `scripts/export-fixtures.mts` and repointed to `photos`/`scans`. Keep the fixtures.
- **Matching** to shared `perfumes` happens in 1c, not here.

## Review Focus

1. **Scan requested by a non-member** (user B posts `/api/scans/<CA scan>/extract`): returns 404. Nothing is read or written. Test in Task 2.
2. **Scan row with a path outside `${collection_id}/${scan_id}/`** (tampered or an old client): refused. Test in Task 2.
3. **Claude fails, refuses or returns unparseable output:** the scan ends `failed` with a readable error after at most 2 attempts, and never stays `processing`. Test in Task 2.
4. **Phone locks mid-batch:** scans already uploaded still extract, through `after()` plus the sweep on the next visit. Test (selection logic) in Task 2.
5. **Upload succeeds but the scan insert fails, or the reverse:** the UI shows it failed with Retry. Retry reuses the same scan id, so there are no duplicates. Test (pure queue logic) in Task 3.

---

### Task 1: Extraction core in `@perfume/core`

**Files:**
- Create: `packages/core/src/extraction/{schema.ts,normalize.ts,prompt.ts,status.ts,claude.ts,index.ts}`, exported from `packages/core/src/index.ts`. Add `@anthropic-ai/sdk` and `zod` to core.
- Create: `packages/core/test/extraction.test.ts`.
- Create: `packages/core/scripts/eval.mts`, which calls the real API and is not part of `pnpm test`. Add the script `"eval": "tsx --env-file=../../apps/web/.env.local scripts/eval.mts"`.
- Starting point: `apps/web/lib/spike/{extract-schema,extract-prompt,extract}.ts`.

**Interfaces:**
- **Schemas:** `Mode`, `FieldStatus`, `Concentration`.
- **`PerfumeReadSchema`:** the spike shape plus `alternatives: z.array(z.string())`. The prompt caps it at 2, and normalisation truncates it to 2.
- **Result schemas:** `BottleResultSchema`, `SamplesResultSchema` and `SetResultSchema`, the spike shapes using `PerfumeReadSchema`. `type RawResult<M>`.
- **Normalised types:** `PerfumeRead`, `BottleResult`, `SamplesResult` and `SetResult`, with sentinels turned to null (`""`→null, `0` size→null, `[]` kept for arrays).
- `normalizeResult(mode: Mode, raw: unknown): BottleResult | SamplesResult | SetResult`.
- `promptFor(mode: Mode): string`, containing every prompt rule in Global Constraints.
- `isPerfume(mode, result): boolean`, based on the mode's flag.
- `resultsToRows(mode, result): { kind: 'bottle'|'vial'|'set_scent'; read: PerfumeRead }[]`.
- `nextStatus(r: { result: … } | { error: string }, attemptInCall: 1|2): { status: 'extracted'|'discarded'|'failed'|'retry'; error?: string }`.
- `isStuck(scan: { status: string; updated_at: string }, now: Date): boolean`.
- `extractWithClaude(client: Anthropic, mode: Mode, photos: string[] /* base64 JPEG */): Promise<RawResult>`. It throws on API error, on refusal, or on unparseable output.

- [ ] **Step 1: Write the failing tests:**
  - `normalizeResult` turns `""` into null and `size_ml 0` into null, keeps printed values, and truncates `alternatives` to 2.
  - **Union count:** for each mode schema, the JSON schema produced by `betaZodOutputFormat` has ≤ 16 union-typed parameters.
  - `isPerfume`: false for each mode's flag false, true otherwise.
  - `resultsToRows`:
    - bottle gives 1 row;
    - samples with 3 vials gives 3 `vial` rows;
    - a set with 0 scents gives `[]`;
    - a set with 2 scents gives 2 `set_scent` rows.
  - `nextStatus`:
    - a perfume result gives `extracted`;
    - a flag-false result gives `{ status:'discarded', error:'not perfume' }`;
    - an error at attempt 1 gives `retry`;
    - an error at attempt 2 gives `failed`.
  - `isStuck`:
    - `uploaded`: false at 1 min, true at 3 min;
    - `processing`: false at 9 min, true at 11 min;
    - other statuses: false.
  - `promptFor('bottle')` contains `alternatives` and the branding rule. `promptFor('set')` contains "never list scents from memory".
- [ ] **Step 2:** Run `pnpm --filter @perfume/core test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Run the tests again: PASS. Then `pnpm typecheck`: green.
- [ ] **Step 4:** Write `eval.mts`. It runs extraction over every fixture in `packages/core/test/fixtures/<mode>/<id>/` and prints per-field agreement with `expected.json`. Note that the fixtures are **unverified** apart from the Naxos house, so this is a regression signal, not accuracy. It also prints, for bottle fixtures, how many have non-empty `alternatives`. Run it once and record the numbers in the ledger.
- [ ] **Step 5:** Commit `feat(core): extraction schemas, prompts, normalisation, status rules, eval`.

### Task 2: Collection helper, extraction service and routes

**Files:**
- Create: `supabase/migrations/00009_scan_discarded.sql`. It adds `'discarded'` to the `scans.status` check, and an index on `scans (collection_id, status, updated_at)`.
- Create: `apps/web/lib/collections/current.ts`, with `getCurrentCollectionId(supabase): Promise<string | null>`: the first membership by `created_at`.
- Create: `apps/web/lib/scans/extract-scan.ts` (`import 'server-only'`) and `apps/web/lib/scans/__tests__/select-pending.test.ts`.
- Create: `apps/web/lib/scans/__tests__/extract-scan.integration.test.ts`, which runs against the hosted DB with a fake extract function. Create `apps/web/vitest.integration.config.ts`, which loads `.env.local`, and add the script `test:integration`. Exclude `*.integration.test.ts` from `pnpm test`.
- Create: `apps/web/app/api/scans/[id]/extract/route.ts` and `apps/web/app/api/scans/process-pending/route.ts`.
- Modify: `apps/web/package.json` (add `@perfume/core` and `server-only`), and regenerate the DB types.

**Interfaces:**
- `type ExtractFn = (mode: Mode, photos: string[]) => Promise<unknown>`. The real one wraps `extractWithClaude(new Anthropic(), …)`.
- `extractScan(deps: { db: SupabaseClient<Database>; extract: ExtractFn }, scanId: string, requesterId: string, mode: 'explicit'|'sweep'): Promise<'not_found'|'not_claimed'|'extracted'|'discarded'|'failed'>`. It:
  1. Loads the scan with the service role.
  2. Returns `not_found` when the scan is missing, the requester isn't a member, or any path is outside the prefix.
  3. Claims the scan, downloads its photos, and calls `extract`.
  4. Applies `normalizeResult` and `nextStatus`, with one retry inside the call.
  5. Writes `extraction`, `model`, `error` and `status`. When the status is `extracted`, it replaces the scan's `pending` `scan_results` with `resultsToRows`.
- `selectPending(rows, now): rows`: stuck rows only, oldest first, at most 20.
- `POST /api/scans/[id]/extract`:
  - requires a signed-in user and returns 202;
  - runs `extractScan(…,'explicit')` in `after()`;
  - `maxDuration = 300`.
- `POST /api/scans/process-pending`:
  - selects the requester's collections' stuck scans with the service role, filtered by membership;
  - runs `extractScan(…,'sweep')` in `after()` with concurrency 3;
  - returns `{ queued }`;
  - `maxDuration = 300`.

- [ ] **Step 1: Write the failing integration tests.** Users A and B are in collections CA and CB, and the extract function is fake.
  - `B gets not_found for CA's scan; row untouched`. Review Focus 1.
  - `path outside prefix is refused`. The DB CHECK from 1a migrations 00007/00008 already rejects bad paths, even for the service role, so test the server re-check as a pure function: `pathsOk(collectionId, scanId, paths)` is false for `CB/…`, for `CA/<sid>/../x`, and for a third element. In the integration test, a scan whose collection the requester isn't in returns `not_found`, and nothing is downloaded. Review Focus 2.
  - `bottle success writes extraction, status extracted, attempts 1, one scan_results row kind bottle`.
  - `samples success with 3 vials writes 3 vial rows`.
  - `flag false → discarded, error 'not perfume', no results`.
  - `extract throws twice → failed, attempts 2, error stored; never left processing`. Review Focus 3.
  - `two concurrent extractScan calls: exactly one calls extract, the other returns not_claimed`.
  - `explicit re-claims a failed scan; sweep does not`.
  - `re-extract replaces pending results`.
- [ ] **Step 2: Write the failing unit test** `selectPending`, using mixed statuses and ages. Review Focus 4.
- [ ] **Step 3:** Run both. Expected: FAIL.
- [ ] **Step 4:** Push the migration, then regenerate and build the types. Implement the helper, the service and the routes. Both tests: PASS.
- [ ] **Step 5:** Commit `feat(scans): collection helper, server-side extraction service and routes`.

### Task 3: Scan screen

**Files:**
- Move:
  - `lib/spike/{detector,capture-gate,idle,feedback,use-camera}.ts` and their tests to `lib/capture/`.
  - `lib/spike/summarise.ts` and its test to `lib/scans/summarise.ts`. Adapt it to the core types, and show `alternatives` as "or: A, B".
- Create:
  - `lib/capture/upload-queue.ts` and its test.
  - `app/(app)/scan/page.tsx`, replacing the placeholder.
  - `components/scan/{capture-view.tsx,mode-switch.tsx,recent-captures.tsx}`. The structure starts from `app/spike/capture/*`.

**Interfaces:**
- `type QueueItem = { scanId: string; mode: Mode; blobs: Blob[]; uploaded: boolean[]; registered: boolean; stage: 'uploading'|'registering'|'extracting'|'done'|'failed'; error?: string }`.
- `nextStep(item): { kind: 'upload'; index: number } | { kind: 'register' } | { kind: 'extract' } | { kind: 'none' }`. It resumes from the first incomplete step.
- **The page:**
  - The camera view is a `fixed inset-0 z-50` dark layer over the shell, with a close (×) button back to `/today`.
  - A mode switch reads **Bottle · Samples · Set**. Each mode's behaviour matches the spike.
  - The flow per capture is: upload, then insert into `scans`, then `POST /api/scans/{id}/extract`.
  - A "Recent" strip polls this visit's scans every 3 s while any are pending, and shows `summarise` lines. Failed items show Retry.
  - There is **no debug drawer** in production. Gate values come from `DEFAULT_GATE`.
- On load, Scan and Today fire `POST /api/scans/process-pending` and forget it.

- [ ] **Step 1: Write the failing `nextStep` tests.** Review Focus 5.
  - A fresh 2-photo item gives `upload 0`.
  - Photo 0 uploaded gives `upload 1`.
  - All uploaded gives `register`.
  - Registered gives `extract`.
  - Done gives `none`.
  - A failed item that was registered gives `extract`, not `register`.
- [ ] **Step 2:** Run the tests: FAIL. Move the spike modules; the moved tests still pass.
- [ ] **Step 3:** Implement `upload-queue.ts`. Tests: PASS.
- [ ] **Step 4:** Build the page in the 1a design system. Use the oxblood/gold tokens and Bodoni headings for the result lines and the mode switch.
- [ ] **Step 5:** Run `pnpm typecheck && pnpm test && pnpm build`: green. Check with Playwright at 390×844, using a throwaway member and a fake camera:
  - one capture per mode reaches `done` against the real API;
  - the camera-denied state is shown correctly.

  Delete the throwaway member afterwards.
- [ ] **Step 6:** Commit `feat(scan): three-mode capture with server extraction`.

### Task 4: Delete the spike

**Files:** delete everything listed in Global Constraints. Modify `proxy.ts`, `lib/auth/paths.ts` and its test.

- [ ] **Step 1:** Update `paths.test.ts` so that `/spike/capture` and `/api/spike/extract` are no longer public. Run it: FAIL.
- [ ] **Step 2:** Delete the spike code and its proxy branch. Rename and repoint the export script. Tests: PASS.
  - `grep -ri spike apps/web --include=*.ts* -l` should return nothing.
- [ ] **Step 3:** Empty and delete the `perfume-spike-captures` bucket. Remove `SPIKE_PASSCODE` and `SUPABASE_ANON_KEY` from `.env.local`, from Vercel (`vercel env rm … production --yes`) and from `turbo.json` and `.env.example`.
- [ ] **Step 4:** Commit `chore: remove Phase 0 spike`.

### Task 5: Deploy and on-device batch

- [ ] **Step 1:** Run `vercel deploy --prod --yes --non-interactive < /dev/null`. Expected: Ready.
  - Smoke test: signed-out `/scan` redirects to login, and `/spike/capture` gives a login redirect.
- [ ] **Step 2: User on iPhone.** Signed in, tap the scan icon and capture:
  - 10 bottles in Bottle mode;
  - 1 photo of 6+ samples, including at least one with a truncated label;
  - 1 set box, with its insert or the open box.

  Report the results and any failures.
- [ ] **Step 3:** Run an admin query: the batch's scans should all be `extracted` or `discarded`, with none stuck. Record timings, the samples accuracy and the alternatives behaviour in `docs/decisions.md`. Commit `docs: Phase 1b deployed`. Merge into `main` locally, push and deploy.
