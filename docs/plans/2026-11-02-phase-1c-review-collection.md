# Phase 1c: Review, Enrichment and Collection, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** turn extracted scans into owned items. A review queue (bulk-approve confident reads, edit, untick, discard, retry), AI enrichment of new perfumes, and the Collection: Owned · Sets · Wishlist, search, filters, the perfume page with source badges and editing, and the set page.

**Architecture:**
- **Approval** is one security-definer SQL function, `approve_result`, called with the member's session. It derives the collection from the scan row, locks the scan, matches or creates the perfume, creates the set (set mode, once per scan), then the item and its photos, atomically.
- **Review flags, approve-input building, effective fields, pyramid weight, search and filters** are pure functions in `@perfume/core`, with unit tests.
- **Enrichment** is a server job (service role + Claude, text only) run in `after()` when approval created a perfume. It fills null fields only, with `sources[f] = 'ai'`.
- **Collection** reads `items`, `perfumes`, `sets` and `item_photos` with the member's session; photos are signed URLs (1 h).

Mirrors Seeds' 1c: `~/code/seeds/docs/plans/2026-10-27-phase-1c-review-catalogue.md`, `supabase/migrations/*approve_scan*`, `apps/web/lib/scans/queue.ts`, `apps/web/app/(app)/review/`, `packages/core/src/review/`, `packages/core/src/enrichment/`.

**Tech Stack:** Next.js 16 (route handlers, `after()`, `connection()`), Supabase (plpgsql RPC, RLS, signed URLs), `@anthropic-ai/sdk` structured outputs (`claude-sonnet-5-5`), zod 4, Vitest, Playwright MCP for UI checks.

**Spec:** [docs/specs/2026-10-31-design.md](../specs/2026-10-31-design.md) §2 Identification, §3 Collection, Data model. See [docs/decisions.md](../decisions.md).

## Global Constraints

- **Supabase CLI:** every call runs with `SUPABASE_ACCESS_TOKEN="$(cat .superpowers/secrets/supabase-token.txt)"`. Never echo secrets. If `db push` is blocked, hand the user the exact `!` command.
- **Shared `perfumes` rows are never written by clients.** Only `approve_result` (security definer, `set search_path = ''`) and the enrichment service role write them. [spec]
- **Shared vs private perfume** [spec: "private until a real label photo confirms it"]: a perfume created by approval is **shared** (`collection_id null`) only when house and name were not edited and the read's `identified_from` is `label` or `both`; otherwise it is **private** to the scan's collection.
- **Matching** — `find_perfume(p_collection uuid, p_house text, p_name text, p_conc text) returns uuid`, `stable`, security invoker:
  - Candidates: shared rows plus rows of `p_collection`.
  - With a concentration: exact `match_key`, else a row with the same house|name and null concentration.
  - Without one: any row with `match_key like normalise_name(house)||'|'||normalise_name(name)||'|%'`.
  - Tie-break: collection row first, then shared, then oldest `created_at`.
- **Provenance** (`perfumes.sources[field]`): `'label'` (read, unedited), `'edited'` (reviewer changed it before approval), `'ai'` (enrichment). Item overrides display as "Edited". Badge copy: **From label · AI-suggested · Edited**.
- **Flags** (a flagged result is never bulk-approved) [spec §2, ruling as Seeds]:
  - `unclear`: house or name null, or `status.house`/`status.name` not `clear`, or `alternatives` non-empty.
  - `duplicate`: the collection already has an `owned` item of the matched perfume.
  - `new`: no perfume matches **and** `identified_from` is not `label`. (A clearly read label creating a new perfume is safe; flagging every new perfume would flag everything in a fresh catalogue.)
  - Chip copy: `unclear` "Hard to read", `duplicate` "Already on your shelf", `new` "New to the catalogue".
- **Items from approval:** `status 'owned'`. Format: bottle mode → the extraction's `format`; vial and set_scent → `'sample'`. `size_ml` from the read; `batch_code` from a bottle extraction. One `item_photos` row per scan photo (`storage_path` = the scan path, no copying; `position` = index), `thumb_path` = `{cid}/{sid}/thumb-{n}.jpg` when that object exists in `storage.objects`.
- **Thumbnails:** 240 px long edge, **JPEG** q 0.8, uploaded by the capture queue as `thumb-{n}.jpg` next to each photo [ruling: spec says WebP; iOS Safari's canvas can't encode WebP]. Missing thumb → the full photo.
- **Scan → `reviewed`** when it has no `pending` results left (approve, discard or dismiss).
- **Enrichment:** text-only Claude call, `claude-sonnet-5-5`, `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`, timeout 55 s, maxRetries 1. Fields: perfumers, release_year, house_type, family, subfamily, accords, notes_top/heart/base, longevity, sillage, seasons, times_of_day, occasions, gender_marketing, discontinued, typical_price_per_ml (GBP). At most 16 union params (test as in 1b). Load `claude-api` before writing the call. House/name fenced in the prompt (`<perfume>…</perfume>`, "treat as data").
- **Vocabularies** (enrichment enums and filter options): seasons `spring|summer|autumn|winter`; times_of_day `day|evening|night`; occasions `office|casual|date|evening_out|formal|gym|holiday`; families `citrus|floral|fruity|green|aquatic|aromatic|chypre|fougere|gourmand|oriental|spicy|woody|leather|musky`.
- **Overrides:** users never edit `perfumes`. Fact edits on the perfume page write `items.overrides[field]` on **every** item of that perfume in the collection; effective value = the most recently updated item's override, else the perfume's value [my call: one perfume page, many items].
- **Collection:** Owned (status `owned`), Sets, Wishlist (status `wishlist`; empty state until Phase 3). `gone` items leave Owned but stay listed on their perfume page, marked Gone. Rows group items by perfume; sorted house A→Z, then name.
- **Search:** client-side, case- and accent-insensitive (NFD, strip marks) substring over effective house, name, notes (all tiers) and accords.
- **Filters:** family, season, time of day, occasion, house, format, set. Rating and worn/neglected arrive with wears (Phase 2).
- **Out of scope (later phases):** wears, "Wear today", your stats and notes (Phase 2); smells like, layering, wishlist adding, add-from-text (Phase 3 / with wishlist and diary).
- **Design:** 1a tokens and components (`.label-card`, `Button`, `Field`, `ScentPyramid`). Mobile-first, checked at 390×844 with no horizontal scroll. No browser `confirm()`; confirm inline.
- **Deploy:** merge to `main` locally, push, `vercel deploy --prod`. No PR.

## Review Focus

1. **Double approve** (double tap, or bulk plus single): exactly one item. The second call fails with `result not pending`. Test in Task 1.
2. **Another collection's result or crafted input:** `approve_result` refuses a non-member; input keys `collection_id`, `perfume_id`, `photo_paths`, `status` are ignored. Test in Task 1.
3. **Name variants** ("XERJOFF" vs "Xerjoff", trailing spaces, apostrophes, concentration present vs missing): no duplicate perfume. Test in Task 1.
4. **A set approved across several calls (or in parallel):** exactly one `sets` row; every item links to it. Test in Task 1.
5. **Accents and empty data in the collection:** "ebene" finds "Ébène"; a perfume with no notes draws the outline pyramid and an empty facts section without crashing. Test in Task 4.

---

### Task 1: Approval RPCs

**Files:**
- Create: `supabase/migrations/00010_review.sql`
- Create: `apps/web/lib/scans/__tests__/review.integration.test.ts`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

**Interfaces:**
- Produces (SQL, all `set search_path = ''`):
  - `alter table scans add column created_set_id uuid`, FK `(collection_id, created_set_id) → sets(collection_id, id) on delete set null (created_set_id)`.
  - `find_perfume(...)` as in Global Constraints. Grant authenticated, service_role.
  - `review_lookup(p_scan_ids uuid[]) returns table(result_id uuid, perfume_id uuid, duplicate boolean)`, security invoker (RLS confines it), for pending results only.
  - `approve_result(p_result_id uuid, p_input jsonb) returns table(item_id uuid, created_perfume_id uuid)`, security definer, grant authenticated only.
    - Load the result's scan, `for update`. Raise `result not pending` unless the result exists, the caller is a member of its collection (`private.is_member`), and the result is `pending`.
    - Input keys (all optional; default from `read` / `scan.extraction`): `house, name, concentration, flanker, size_ml, format, batch_code, set_house, set_name, edited_fields text[]`. Ignore all others.
    - Raise `house and name required` if either resolves to null/blank.
    - `find_perfume`, else insert (shared/private per Global Constraints) with `sources` per field.
    - Set mode: reuse `scans.created_set_id`, else insert `sets(collection_id, house, name)` and store it.
    - Insert item + photos; result → `approved`, `created_item_id`; scan → `reviewed` if no pending left.
  - `discard_result(p_result_id uuid) returns void` and `dismiss_scan(p_scan_id uuid) returns void` (all its pending results → discarded, scan → reviewed), security definer, member-checked, grant authenticated.
  - `claim_scan` explicit branch also claims `extracted` (re-read of an empty or wrong read).

- [ ] **Step 1: Write failing integration tests** (two members in two collections, created via admin; scans inserted by admin with `status 'extracted'` and fixture `read` JSON; storage objects only for the thumb test):
  - `approve creates shared perfume with sources 'label', item (format, size, batch), photos; result approved; scan reviewed`
  - `edited name → private perfume, sources.name 'edited'`
  - `identified_from 'shape' → private perfume`
  - `second approve fails 'result not pending'; two parallel approves create one item` (RF 1)
  - `member of another collection gets 'result not pending'; crafted collection_id/perfume_id/photo_paths keys ignored` (RF 2)
  - `'XERJOFF ' / 'Naxos' matches existing 'Xerjoff'/'Naxos' edp when concentration missing; 'edp' read matches null-concentration row` (RF 3)
  - `set: three scents approved sequentially and two in parallel → one sets row with set_name from extraction, all items linked` (RF 4)
  - `vial and set_scent items have format 'sample'`
  - `thumb_path set when thumb-1.jpg exists, null otherwise`
  - `discard_result and dismiss_scan; scan reviewed when nothing pending; non-member refused`
  - `review_lookup: perfume_id of the match, duplicate true when an owned item exists; other collection's scan returns no rows`
  - `explicit claim_scan claims an extracted scan`
- [ ] **Step 2:** `pnpm --filter @perfume/web test:integration` → FAIL (functions missing).
- [ ] **Step 3:** Write the migration; `supabase db push`; regenerate types.
- [ ] **Step 4:** Integration suite PASS (new + 1b's 11).
- [ ] **Step 5:** Commit `feat(db): approve_result, discard/dismiss, perfume matching`.

### Task 2: Review queue

**Files:**
- Create: `packages/core/src/review/{flags.ts,input.ts,batch.ts,index.ts}`, `packages/core/test/review.test.ts`; export from `src/index.ts`
- Create: `apps/web/lib/scans/queue.ts` (server), `apps/web/app/api/scan-results/[id]/approve/route.ts`
- Create: `apps/web/app/(app)/review/page.tsx`, `apps/web/components/review/{review-queue.tsx,bottle-card.tsx,group-card.tsx,read-editor.tsx,photo-viewer.tsx,flag-chips.tsx}`
- Modify: `apps/web/app/(app)/today/page.tsx` (notice), `apps/web/components/scan/recent-captures.tsx` ("Review" link once anything is extracted)

**Interfaces:**
- Consumes: Task 1 RPCs; `PerfumeRead`, `BottleResult`, `SetResult` from core.
- Produces:
  - `type Flag = 'unclear' | 'duplicate' | 'new'`; `reviewFlags(r: { read: PerfumeRead; perfumeId: string | null; duplicate: boolean }): Flag[]`; `FLAG_COPY: Record<Flag, string>`.
  - `type ReadEdits = Partial<{ house: string; name: string; concentration: string | null; flanker: string | null; size_ml: number | null; format: string; batch_code: string | null; set_house: string; set_name: string }>`; `approveInput(read: PerfumeRead, edits: ReadEdits): Record<string, unknown>` — only changed keys, plus `edited_fields`; picking an alternative counts as editing `name`.
  - `runBatch<T>(items: T[], fn: (t: T) => Promise<void>): Promise<{ ok: T[]; failed: { item: T; error: string }[] }>` — sequential, never throws.
  - `loadQueue(): Promise<QueueScan[]>` where `QueueScan = { id; mode; status: 'extracted' | 'failed'; error: string | null; photos: string[] /* signed */; set: { house; name } | null; results: { id; kind; read; flags: Flag[] }[]; created_at }` — pending results only; `extracted` scans with zero pending and zero approved results appear as "couldn't read".
  - `POST /api/scan-results/[id]/approve` body `{ input }` → calls `approve_result` with the member's session; 200 `{ itemId }`, 409 `{ error }` on RPC error, 401 signed out; `after(() => enrichPerfume(created_perfume_id))` once Task 3 exists (Task 2 leaves a no-op hook).
- UI:
  - Header "N to review" and **Approve N confident** (all unflagged pending results; `runBatch`; reports "Approved N" and lists failures, which stay in the queue). Sorted flagged-first, then oldest.
  - Bottle card: photo (tap → full screen, pinch via native zoom), house in small caps, name in Bodoni, concentration, chips, alternatives as tappable chips ("or: …"), **Approve · Edit · Discard**.
  - Group card (samples/set): the whole photo, set house/name (set mode, editable), one row per read with a tick box (ticked by default), chips and Edit; **Approve N ticked** approves ticked rows, discards unticked.
  - Editor sheet: house, name, concentration, flanker, size; bottle adds format and batch code.
  - "Couldn't read (N)": error text, **Read again** (`POST /api/scans/{id}/extract`), **Dismiss** (`dismiss_scan`).
  - Today notice: "N to review" linking `/review` when N > 0 (pending results + failed scans).

- [ ] **Step 1: Write failing tests** (`review.test.ts`):
  - `reviewFlags`: clear read with match, no duplicate → `[]`; name `unclear` → `['unclear']`; alternatives alone → `unclear`; duplicate → `duplicate`; no match + `identified_from 'label'` → `[]`; no match + `'shape'` → `new`.
  - `approveInput`: unchanged → `{ edited_fields: [] }`; name changed → `{ name, edited_fields: ['name'] }`; alternative chosen → name edit; set fields included when given.
  - `runBatch`: items 1..5, 2 and 4 throw → `ok [1,3,5]`, failed 2 and 4 with messages.
- [ ] **Step 2:** `pnpm --filter @perfume/core test` → FAIL. **Step 3:** Implement. PASS.
- [ ] **Step 4:** Build `queue.ts`, route, page, components. Load `frontend-design` for the cards within the 1a system.
- [ ] **Step 5:** `pnpm typecheck && pnpm test && pnpm build` green. Playwright 390×844, throwaway member seeded with a bottle scan (clear), a bottle scan (unclear), a samples scan (3 vials) and a failed scan, from fixture photos: bulk approve takes 1 + clear vials; edit-and-approve the unclear one; untick one vial and approve the group; dismiss the failed one; queue empties; Today notice gone. Delete the throwaway data.
- [ ] **Step 6:** Commit `feat(review): review queue with bulk approve, edit, untick, retry`.

### Task 3: Enrichment

**Files:**
- Create: `packages/core/src/enrichment/{schema.ts,prompt.ts,merge.ts,claude.ts,index.ts}`, `packages/core/test/enrichment.test.ts`
- Create: `apps/web/lib/perfumes/enrich.ts` (`server-only`), `apps/web/lib/perfumes/__tests__/enrich.integration.test.ts`
- Modify: `apps/web/app/api/scan-results/[id]/approve/route.ts` (real hook)

**Interfaces:**
- `PerfumeSuggestionSchema` (sentinels `''`/`[]`/`0`, enums from Global Constraints); `normalizeSuggestion(raw): PerfumeSuggestion` (sentinels → null, arrays filtered to the vocabularies, deduped).
- `fillMissing(current: Record<string, unknown> & { sources: Record<string, string> }, s: PerfumeSuggestion): { update: Record<string, unknown>; sources: Record<string, string> }` — only where current is null or an empty array; each filled key gets `'ai'`.
- `suggestPerfume(client, p: { house: string; name: string; concentration: string | null }): Promise<PerfumeSuggestion>`.
- `enrichPerfume(id: string | null, deps?: { db; suggest }): Promise<void>` — loads, suggests, fills, updates via service role; `console.error('enrich', id, msg)` and swallow.

- [ ] **Step 1: Write failing tests:** `fillMissing` never overwrites a `'label'` field, fills nulls and empty arrays with `'ai'`, skips null suggestions; `normalizeSuggestion` drops out-of-vocabulary seasons and `0` price; schema union count ≤ 16 via `betaZodOutputFormat`. Integration: `enrichPerfume` with a fake `suggest` fills a new perfume's nulls and leaves `house`/`name` sources untouched; null id is a no-op.
- [ ] **Step 2:** FAIL. **Step 3:** Implement and wire the hook. PASS.
- [ ] **Step 4:** Run `suggestPerfume` once for Xerjoff Naxos (expect family oriental/gourmand-ish, honey/tobacco/lavender notes, autumn/winter). Record in the ledger.
- [ ] **Step 5:** Commit `feat(perfumes): AI enrichment of new perfumes`.

### Task 4: Thumbnails and the Collection list

**Files:**
- Create: `packages/core/src/collection/{effective.ts,pyramid.ts,search.ts,filters.ts,index.ts}`, `packages/core/test/collection.test.ts`
- Create: `apps/web/lib/collection/load.ts` (server), `apps/web/components/collection/{collection-view.tsx,perfume-row.tsx,filter-sheet.tsx,view-switch.tsx,source-badge.tsx}`
- Modify: `apps/web/app/(app)/collection/page.tsx`, `apps/web/lib/capture/images.ts` (+ `toThumb(blob): Promise<Blob>`), `apps/web/components/scan/use-scan-queue.ts` (upload `thumb-{n}.jpg`; a thumb failure never fails the item)

**Interfaces:**
- `FACT_FIELDS` (the perfume fields shown and editable); `effectivePerfume(p: PerfumeRow, overrides: Record<string, unknown>): { values: Record<FactField, unknown>; source: Record<FactField, 'label' | 'ai' | 'edited' | null> }`.
- `pyramidWeight(n: { notes_top: string[]; notes_heart: string[]; notes_base: string[] }): 'top' | 'heart' | 'base' | null` — tier with most notes; ties go to the heavier tier (base > heart > top); no notes → null.
- `fold(s: string): string` (lowercase, NFD, strip marks); `matchesSearch(row: CollectionRow, q: string): boolean`.
- `type Filters = Partial<{ family: string[]; season: string[]; time: string[]; occasion: string[]; house: string[]; format: string[]; set: string[] }>`; `applyFilters(rows, f): CollectionRow[]` — AND across keys, OR within a key; `filterOptions(rows)` gives the values present.
- `type CollectionRow = { perfumeId; house; name; concentration; family; seasons; times; occasions; accords; notes: { top; heart; base }; weight; thumb: string | null; items: { id; format; size_ml; status; setId; setName }[] }`; `loadCollection(): Promise<{ rows: CollectionRow[]; sets: SetRow[] }>` with `SetRow = { id; house; name; count; thumb }`.
- UI: switch Owned · Sets · Wishlist; search field; filter button with active count → sheet; rows = thumb, house small caps, name Bodoni, pyramid, "N items" disclosure listing format/size/set; Sets tab rows link `/collection/sets/[id]`; empty states for each tab.

- [ ] **Step 1: Write failing tests** (`collection.test.ts`):
  - `effectivePerfume`: override wins with `'edited'`; perfume `sources` map to `'label'`/`'ai'`; empty perfume → nulls, no throw (RF 5).
  - `pyramidWeight`: `[2,1,1]` → top; `[1,1,1]` → base; `[0,2,2]` → base; all empty → null (RF 5).
  - `matchesSearch`: "ebene" finds name "Eau de Peau Ébène" (RF 5); "honey" finds a base note; "XERJ" finds house; no match → false.
  - `applyFilters`: family OR within key, AND with season; empty filters → all rows.
  - `toThumb` isn't unit-tested (canvas); covered by Playwright.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. PASS.
- [ ] **Step 4:** Build loader, page, components, thumb upload.
- [ ] **Step 5:** `pnpm typecheck && pnpm test && pnpm build` green. Playwright 390×844 with a throwaway member: capture one bottle with the fake camera (thumb object exists in storage), approve it, see it in Owned with thumb and pyramid; search and a filter narrow the list; Sets tab shows an approved set. Delete throwaway data.
- [ ] **Step 6:** Commit `feat(collection): owned/sets/wishlist list with search, filters and thumbnails`.

### Task 5: Perfume page and set page

**Files:**
- Create: `apps/web/app/(app)/collection/[perfumeId]/page.tsx`, `apps/web/app/(app)/collection/sets/[setId]/page.tsx`
- Create: `apps/web/lib/collection/perfume.ts` (server loader), `apps/web/lib/collection/overrides.ts` + `apps/web/lib/collection/__tests__/overrides.test.ts`
- Create: `apps/web/components/collection/{perfume-detail.tsx,facts-edit-form.tsx,item-card.tsx,item-edit-form.tsx,confirm-button.tsx}`

**Interfaces:**
- Consumes: `effectivePerfume`, `pyramidWeight`, `SourceBadge` (Task 4).
- `loadPerfume(perfumeId): Promise<PerfumeDetail | null>` — the perfume (RLS: shared or own), its items in the collection (all statuses) with signed photos, effective facts. `null` → `notFound()`; a perfume with no items in this collection → `notFound()`.
- `overridePatch(current: Record<string, unknown>, perfume: PerfumeRow, edits: Record<FactField, unknown>): Record<string, unknown>` — sets a key only when it differs from the perfume's value; removes it when the edit equals the perfume's value (back to source).
- Facts edit writes `overrides` to every item of the perfume via the browser client (`.update({ overrides }).eq('perfume_id', id).eq('collection_id', cid)`; per-item merge in code).
- Item actions: edit (format, size, price, purchased_on, purchase_source, batch_code, notes), **Mark gone** / **Back on the shelf**, **Delete** (inline confirm). Deleting the last item returns to `/collection`.
- Set page: house, name, its items linking to their perfume pages; delete set (items keep, `set_id` nulls).
- Layout: hero photo, house small caps, name Bodoni italic, concentration; pyramid with notes per tier; facts with badges (family, accords, longevity, sillage, seasons, times, occasions, perfumers, year); items list.

- [ ] **Step 1: Write failing tests** (`overrides.test.ts`): new edit differing from perfume → key set; edit equal to perfume value → key removed; untouched keys kept; arrays compared by value.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. PASS.
- [ ] **Step 4:** Build loader, pages, components.
- [ ] **Step 5:** `pnpm typecheck && pnpm test && pnpm build` green. Playwright 390×844: open a perfume, edit family (badge → Edited, persists on reload, setting it back clears the badge), edit an item's size, mark gone (leaves Owned, still on the page), delete with confirm; set page lists its samples. Delete throwaway data.
- [ ] **Step 6:** Commit `feat(collection): perfume page with badges, overrides and item actions; set page`.

### Task 6: Ship

- [ ] **Step 1:** Final whole-branch review (most capable model), one fix pass.
- [ ] **Step 2:** Merge to `main`, push, `vercel deploy --prod`. Smoke: `/review`, `/collection`, `/collection/{uuid}` 307 to login signed out; approve route 401 signed out.
- [ ] **Step 3:** Record in `docs/decisions.md` ("Phase 1c deployed", rulings worth keeping); commit `docs: Phase 1c deployed`; push.
- [ ] **Step 4: User:** scan a few bottles, a samples photo and a set on the iPhone; review, approve, browse. Report anything wrong.
