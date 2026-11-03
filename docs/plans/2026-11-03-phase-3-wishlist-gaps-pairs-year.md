# Phase 3: Wishlist, Gaps, Smells like, Layering, Year view, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** finish the spec. Wishlist (add by typing, by scanning a tester, or "Want this" on a suggestion; move to owned), gaps on Stats with AI suggestions, smells like and layer with on the perfume page, the Diary year view, plus the deferred Phase 2 minors.

**Architecture:**
- **Add from text:** two server routes. `identify` asks Claude (memory, no search) what the typed perfume is and returns a proposal; the add sheet shows it as an inline review card labelled "From text, not label". `from-text` creates the item (matching an existing perfume, else a **private** perfume) with status `owned` or `wishlist`, then enriches in `after()` under the lookup quota.
- **AI cost guard:** one service-only `claim_ai(collection, kind, cap)` RPC over `private.ai_calls`, per collection per London-UTC day, like `claim_lookup`.
- **Pure logic in `@perfume/core`:** pair scoring and rule reasons (smells like, layering), gap rules, year grid and heat levels, model prompts and output acceptance. Unit-tested.
- **Model copy pattern = Today's:** rules always produce the lists and reasons; Haiku rewrites the reason lines inside a nested Suspense with a hard timeout, cached with `'use cache'`; any failure keeps rule reasons.

**Tech Stack:** as Phase 2. Load `claude-api` before writing model calls and `dataviz` before the year heatmap.

**Spec:** [docs/specs/2026-10-31-design.md](../specs/2026-10-31-design.md) §1 add without a photo, §3 wishlist/perfume page, §5 year view, §6 gaps. Mockup: `.superpowers/brainstorm/90327-1793471505/content/apothecary-v3-extras.html`. See [docs/decisions.md](../decisions.md).

## Global Constraints

- **Supabase CLI:** `SUPABASE_ACCESS_TOKEN="$(cat .superpowers/secrets/supabase-token.txt)"` on every call; `db push --yes` is authorised. Never echo secrets.
- **Shared `perfumes` rows are never written by clients.** Text-added perfumes are private to the collection (`collection_id` set). Identity `sources` = `'text'`.
- **AI quotas (per collection, per UTC day, service role only):** `identify` 30, `gap_suggest` 10, `pair_reasons` 60. Enrichment after add-from-text uses the existing `claim_lookup` (1/perfume/day, 20/collection/day). Refused → 429 / rule fallback, never a crash.
- **Models:** identify + gap suggestions `EXTRACTION_MODEL` (Sonnet 5.5), structured output, no web search, `betas:['server-side-fallback-2026-07-01']`, `fallbacks:'default'`. Pair reasons `claude-haiku-5-5`, thinking disabled, max_tokens 500, 8 s timeout, maxRetries 0. User text and perfume names fenced as data (`<>` stripped, whitespace collapsed, ≤ 100 chars each).
- **Wishlist:** items with status `wishlist`, no photos required. `items.wish_reason` text ≤ 80 chars, optional. "Move to owned" sets status `owned` and clears nothing else. Wishlist perfumes are never Today candidates, never count in Stats, never smells-like/layering candidates.
- **Wishlist row line** (first that applies): `wish_reason`; "Loved the sample · ★{avg}" when the perfume has ≥ 1 rated wear with avg ≥ 4; else "Added by you".
- **Smells like / Layer with:** candidates are other perfumes with ≥ 1 `owned` item (samples included). At most 3 each; a perfume in "Smells like" is excluded from "Layer with". Hidden when empty. Shown only on perfumes the collection owns or wishes for.
- **Gaps:** computed over owned perfumes; shown only when ≥ 5 owned; a gap = rule count < 2; at most 3, fewest first. Copy "{title} — {count} in {total}."
- **Year view:** `/diary?y=YYYY` (y ∈ 2000–2100). Switch **Month · Year** above the calendar. Heat by wears per day: 0, 1, 2, 3+ → 4 steps of one hue (oxblood ramp, validated with the dataviz script against the card surface). Each day links to `/diary?d=YYYY-MM-DD`; each month label links to `/diary?m=YYYY-MM`. Legend "Less … More" + "N wears in YYYY".
- **Design:** 1a tokens; 390×844 no horizontal scroll; 44 px targets except heatmap cells (month links are the large targets); inline confirmations.
- **Deploy:** merge to `main` locally, push, `vercel deploy --prod --yes` from the repo root. No PR.

## Review Focus

1. **Duplicate adds:** adding a perfume already in the collection's or shared catalogue links to it (via `find_perfume`), never creates a twin. Test in Task 3.
2. **Prompt injection via typed text / names:** fenced; outputs validated (enums, lengths, known ids). Tests in Task 2.
3. **Quota bypass:** `claim_ai` not callable by `authenticated`/`anon`; cache hits don't claim; a refused claim isn't cached. Tests in Tasks 1 and 7.
4. **Thin data:** perfumes with no notes/accords/family give no pairs (not random ones); a collection of 0–4 owned shows no gaps; a year with no wears renders zeros. Tests in Tasks 2 and 5.
5. **Wishlist leakage:** wishlist-only perfumes don't appear in Today, Stats, pair candidates, or the "Wear" picker. Tests in Tasks 2 and 4.

---

### Task 1: Migration 00019 — wish_reason, AI quota, wishlist approvals

**Files:** Create `supabase/migrations/00019_wishlist_ai_quota.sql`, `apps/web/lib/ai/quota.ts`; Test `apps/web/lib/ai/__tests__/quota.integration.test.ts`, extend the review approve integration test.

**Produces:** `items.wish_reason`; `public.claim_ai(p_collection uuid, p_kind text, p_cap int, p_now timestamptz default now()) returns boolean`; `claimAi(db, collectionId, kind: AiKind, now?) : Promise<boolean>` with `AI_CAPS = { identify: 30, gap_suggest: 10, pair_reasons: 60 }`; `approve_result` honours `p_input.status ∈ {owned, wishlist}` (default owned).

- [ ] Tests (RED): claim_ai allows `cap` calls per kind per collection per UTC day then false; kinds independent; next day resets; `authenticated` gets permission denied; `kind` outside the three → exception. Approve with `{status:'wishlist'}` creates a wishlist item; `{status:'gone'}` → owned (ignored). `wish_reason` > 80 chars rejected.
- [ ] Migration: `private.ai_calls(id, collection_id, kind check in (...), created_at)` + index (collection_id, kind, created_at); `claim_ai` security definer, advisory xact lock on (collection, kind), execute to service_role only. `create or replace public.approve_result` copied from 00012 with `v_status` read from input. `alter table items add wish_reason text check (char_length(wish_reason) <= 80)`.
- [ ] `db push --yes`, `pnpm gen:types`, build `@perfume/supabase`; tests GREEN; commit.

### Task 2: Core — pairs, gaps, year grid, prompts

**Files:** Create `packages/core/src/pairs/{pairs.ts,model.ts,index.ts}`, `packages/core/src/gaps/{gaps.ts,model.ts,index.ts}`, `packages/core/src/diary/year.ts`, `packages/core/src/identify/{identify.ts,index.ts}`; export from `index.ts`; tests beside existing core tests.

**Produces:**
- `type PairPerfume = { perfumeId; house; name; family; subfamily?; accords: string[]; notes: string[] /* all tiers, lowercased */; weight; sillage; sample: boolean }`, `pairFromRow(row: CollectionRow): PairPerfume`.
- `smellsLike(target, others, n=3): Pair[]`, `layerWith(target, others, exclude: Set<string>, n=3): Pair[]`; `type Pair = { perfume: PairPerfume; score: number; code: PairCode; shared: string[] }`; `pairReason(p: Pair, kind: 'like'|'layer'): string`.
  - Similarity = 3·J(notes) + 2·J(accords) + (same family ? 1 : 0). Smells-like keeps score ≥ 1.2. Code `very_close` (≥ 2.5 → "Very close · shares a, b") else `shares` ("Shares a, b, c"), else `family` ("Also {family}"). Shared lists ≤ 3, in target order.
  - Layering requires ≥ 1 shared note or accord (the bridge) and similarity < 2.5. Score = bridge count (≤ 3) + |heft diff| (heft as Today's, on PairPerfume) + (different family ? 1 : 0); keep ≥ 2. Codes/copy: `lifts` (target heft ≥ 1, other ≤ −1) "Lifts the heavy base · linked by {note}"; `warms` (target ≤ −1, other ≥ 1) "Adds warmth underneath · linked by {note}"; `bridge` "Linked by {a} and {b}".
  - No notes and no accords on target → both empty.
- `GAP_RULES` and `findGaps(rows: CollectionRow[] /* owned only */): Gap[]`, `type Gap = { id: GapId; title: string; count: number; total: number }`. Rules (perfume counts if):
  - `hot_days` "Nothing fresh or aquatic for hot days": family ∈ citrus/aquatic/green or heft ≤ −1, and seasons empty or ∋ summer.
  - `cold_days` "Nothing warm for cold days": heft ≥ 1 and (seasons empty or ∋ winter).
  - `date_night` "Nothing for a date or an evening out": occasions ∋ date or evening_out.
  - `office` "Nothing quiet enough for the office": occasions ∋ office and sillage ∉ strong/enormous.
  - `spring` "Nothing bright for spring": seasons ∋ spring and family ∈ floral/green/citrus/fruity.
  - total < 5 → []. Count < 2 → gap. Sort count asc then rule order; max 3. `gapWishReason(id)` → e.g. "Fills your hot-days gap" (≤ 80).
- `yearGrid(year): { ym: string; weeks: (string|null)[][] }[]` (12 months, Monday-first weeks, null padding); `heatLevel(n): 0|1|2|3`; `isYear(s)`.
- Model helpers (pure + one API call each, Today's pattern):
  - `identifyPrompt(text)`, `IdentifySchema = { found: boolean; house; name; concentration: enum|''; flanker }`, `acceptIdentity(raw)` → `Identity | null` (house/name 1–80 chars, trimmed), `identifyPerfume(client, text)`.
  - `gapPrompt(gap, owned: {house,name}[])`, `GapSuggestSchema = { picks: {house; name; concentration; why}[] }`, `acceptSuggestions(raw, owned)` → ≤ 3, drop owned (normalised house+name), why ≤ 70 one line; `suggestForGap(client, gap, owned)`.
  - `pairReasonsPrompt(target, likes, layers)`, `acceptPairReasons(raw, ids)` (Today's rules, ≤ 70), `suggestPairReasons(client, …)` → `Map<"like:id"|"layer:id", string>`.
- [ ] Tests (RED → GREEN): fixtures for close twin (very_close), shared notes, family only, no-notes target, layering lifts/warms/bridge, smells-like exclusion from layering, sample candidates allowed; gaps: 4 owned → [], hot_days/office detection, max 3 ordering; yearGrid 2028 (leap: Feb 29) and a year starting on Sunday; heatLevel bounds; prompts fence `<script>`-like text; accept functions drop unknown ids, overlong, newline, owned suggestions, empty house.
- [ ] Commit.

### Task 3: Add from text — routes and server logic

**Files:** Create `apps/web/lib/perfumes/add-from-text.ts`, `apps/web/app/api/perfumes/identify/route.ts`, `apps/web/app/api/items/from-text/route.ts`; Test `apps/web/lib/perfumes/__tests__/add-from-text.integration.test.ts`.

**Consumes:** `claimAi`, `identifyPerfume`, `claimLookup`, `enrichPerfume`, `find_perfume`.
**Produces:** `POST /api/perfumes/identify {text ≤ 120}` → `{proposal: Identity & {perfumeId: string|null}} | {proposal: null}`; 401 signed out, 400 bad body, 429 quota. `POST /api/items/from-text {house, name, concentration?, flanker?, status: 'owned'|'wishlist', reason?}` → `{perfumeId, itemId}`. `addFromText(userDb, collectionId, input)`.

- [ ] Tests (RED): existing shared perfume match → no new perfume row, item linked; new → private perfume with `sources.house = 'text'`; `reason` stored only for wishlist, trimmed to ≤ 80; second add of same new perfume reuses the private row; status validated.
- [ ] Implement with the **user's** client (RLS) for perfume insert/item insert; enrichment in `after()` only if `claimLookup` true. Format of item: `full`.
- [ ] `Source` in core gains `'text'` ("From text"), `effectivePerfume` maps it; SourceBadge shows "from text, not label".
- [ ] GREEN; commit.

### Task 4: Wishlist UI

**Files:** Create `apps/web/components/collection/add-sheet.tsx`; Modify `collection-view.tsx`, `perfume-row.tsx`, `item-card.tsx`, `perfume-detail.tsx`, `lib/collection/load.ts` (wish_reason on items), review `bottle-card.tsx`/`group-card.tsx`/`review-queue.tsx` (Wishlist toggle → `input.status`), `lib/wears/load.ts` (wearables owned only — verify), core `CollectionItem.wishReason`.

- [ ] Unit test (RED): `wishLine(row)` in core per the constraint order.
- [ ] Add sheet: text field "House and name" → Identify → card (house, name, concentration editable; badge "From text, not label"; "Already in the catalogue" when perfumeId) → Add to Wishlist / Add to Owned. Errors and 429 ("Try again tomorrow") inline. Entry points: "+ Add" button on Wishlist and Owned views; Wishlist empty state copy: "Add by typing a name, scanning a tester, or "Want this" on a gap suggestion."
- [ ] Wishlist rows show `wishLine`. Item card for wishlist item: "Move to owned" (no Mark gone). Perfume page for wishlist-only: no Wear today, no "Your stats" when 0 wears, header chip "Wishlist".
- [ ] Review: per bottle/vial a "Wishlist" checkbox (default off).
- [ ] Browser check at 390×844: add via text (stub-free, real call once), move to owned. Commit.

### Task 5: Perfume page — Smells like, Layer with

**Files:** Create `apps/web/lib/pairs/load.ts`, `apps/web/lib/pairs/model-reasons.ts`, `apps/web/components/collection/pairs.tsx`; Modify `perfume-detail.tsx` / page to render `<Pairs>` in its own Suspense.

- [ ] Test (RED): `pairsFor(rows, perfumeId)` excludes wishlist-only and gone-only perfumes and the target; empty for unknown id.
- [ ] Model reasons via `'use cache'` + `cacheLife('days')`, key = target id + candidate ids + their rule reasons; inside the cache fn `claimAi('pair_reasons')` first (throw if refused so nothing caches); 8 s timeout → rule reasons.
- [ ] UI per mockup: "Smells like — on your shelf" and "Layer with" (+ marker), each row links to the perfume, house small caps, name Bodoni, sample chip, reason line. Commit.

### Task 6: Stats — Gaps and suggestions

**Files:** Create `apps/web/lib/gaps/suggest.ts`, `apps/web/app/api/gaps/[id]/route.ts`, `apps/web/components/stats/gap-card.tsx`; Modify `lib/stats/load.ts`, stats page.

- [ ] Test (RED): route returns 404 for unknown gap id, 401 signed out; `suggest.ts` with injected suggest fn: caches per (gap, owned names sorted), drops owned, refuses claim → 429.
- [ ] Gap card: title — "{count} in {total}." + "See suggestions" (loads, labelled "Suggested by AI") + per suggestion "Want this" → `POST /api/items/from-text` with status wishlist, reason `gapWishReason(id)`; then "On your wishlist ✓". Section "Gaps in your shelf" above breakdowns; hidden when no gaps. Commit.

### Task 7: Diary year view

**Files:** Create `apps/web/components/diary/year-view.tsx`, `apps/web/components/diary/view-toggle.tsx`; Modify `lib/wears/load.ts` (`loadYearCounts(supabase, year): Map<date, number>`), diary page.

- [ ] Run dataviz validator on the 4-step oxblood ramp vs `#FFFAF0` (light only; app has no dark mode). Record result in ledger.
- [ ] Test (RED): `loadYearCounts` (integration) counts wears per London date for the year only.
- [ ] Page: `?y=` → year view (12 mini months, 3 columns, prev/next year, legend, total); toggle links keep context (year of selected month and vice versa). Cells `aria-label="{date}: N wears"`. Browser check. Commit.

### Task 8: Phase 2 minors

**Files:** as each fix needs; tests where logic.

- [ ] Wear date can't be in the future: form `max={today}` + `asWearInsert` rejects (unit test).
- [ ] Diary entry for a perfume with no items renders as text, not a 404 link.
- [ ] Average shown to one decimal everywhere (no ★ rounding of 3.95 to 4): `formatAvg` unit test.
- [ ] `formatGbp`: £1,000 → "£1k", £1,050 → "£1.1k", no ".0" (unit test).
- [ ] Stats with nothing owned: zero tiles + the hint line.
- [ ] "Your location" casing consistent in Settings.
- [ ] Neglected filter seeded from URL doesn't stick after leaving (state reset on navigation).
- [ ] Today reasons cache key narrowed to fields the prompt uses.
- [ ] Commit.

### Task 9: Docs, final review, deploy

- [ ] `docs/decisions.md` "2026-11-03 — Phase 3 deployed" section (rulings, quotas, gap rules, pair scoring).
- [ ] Full suites (unit, integration), `pnpm build`.
- [ ] Final whole-branch review (opus subagent); fix Critical/Important with RED→GREEN.
- [ ] Merge to main, push, `vercel deploy --prod --yes` from repo root; smoke: signed-out `/api/perfumes/identify` 401, `/diary?y=2026` 307 to login.
