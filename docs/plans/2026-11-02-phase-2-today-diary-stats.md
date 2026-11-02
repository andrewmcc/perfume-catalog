# Phase 2: Today, Diary and Stats, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make the app a daily habit. Log wears (date, optional time of day, 1–5 stars, notes); a Diary month view; wear stats and notes on the perfume page; tried marks on sets; rating and worn/neglected filters; Today's three picks for the weather, season and time, with reasons and nudges; Stats; a location setting.

**Architecture:**
- **Wears** are a client-writable table under member RLS. A trigger copies `perfume_id` from the item and proves the item is in the wear's collection, so a wear survives item deletion (`item_id` → null) and can't be pointed across collections.
- **Location** is per collection (`collection_settings`, lat/lon rounded to 2 dp), set from a UK postcode (postcodes.io, server) or browser geolocation.
- **Pure logic in `@perfume/core`:** London clock and season, Today scoring and rule reasons, month grid, wear summaries, stats. Unit-tested.
- **Today** is server-rendered from search params (`?n=lighter|bolder&o=<occasion>`). Weather comes from Open-Meteo current conditions, cached 15 min with `'use cache'`. The rules always produce picks and reasons. The model rewrites the reason lines inside a nested Suspense with a hard timeout, cached per day and context. On failure the rule reasons stay.

**Tech Stack:** Next.js 16 (`cacheComponents`, `'use cache'` + `cacheLife`, `connection()`, Suspense), Supabase (RLS, triggers), `@anthropic-ai/sdk` structured outputs, zod 4, Open-Meteo, postcodes.io, Vitest, Playwright MCP.

**Spec:** [docs/specs/2026-10-31-design.md](../specs/2026-10-31-design.md) §3 perfume page/sets/filters, §4 Today, §5 Diary, §6 Stats, §7 Settings (location). See [docs/decisions.md](../decisions.md).

## Global Constraints

- **Supabase CLI:** `SUPABASE_ACCESS_TOKEN="$(cat .superpowers/secrets/supabase-token.txt)"` on every call; `db push --yes` is authorised. Never echo secrets.
- **Clock:** every date, hour and season is computed in `Europe/London`. Wear dates are London calendar dates (`YYYY-MM-DD`).
- **Season by London month:** Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter. The phase is early, mid or late by month position, e.g. "Late autumn" in November.
- **Daypart** (matches the `times_of_day` vocabulary): `day` 05:00–16:59, `evening` 17:00–21:59, `night` 22:00–04:59.
- **Wears:** one or more per day. `time_of_day` is optional (`day|evening|night`), `rating` is an optional smallint 1–5 and `notes` is optional text ≤ 2000 characters. `perfume_id` is copied from the item and never sent by the client. Members can insert, update and delete any wear in their collection.
- **Candidates for Today:** one per perfume with at least one `owned` item. `gone` and `wishlist` items are excluded. A perfume whose owned items are all samples is a "sample" candidate.
- **Today scoring** [my call; the spec leaves the weights to the builder]. Score = sum of:
  - **Season:** +3 if the perfume's seasons include the current season, −2 if seasons are set but don't include it, 0 if unknown.
  - **Daypart:** +2 if it matches, −1 if times are set but don't match, 0 if unknown.
  - **Occasion** (only when `o` is set): +3 if it matches, −1 if occasions are set but don't match.
  - **Weight fit:** `−|heft − ideal|`.
    - `heft` ∈ [−2, 2] = family term (citrus/aquatic/green −1; gourmand/oriental/leather/spicy +1; else 0), plus pyramid weight (top −1, base +1), plus sillage (soft −1, strong/enormous +1), clamped.
    - `ideal`: from temperature °C (≥ 22 → −2, 16–21 → −1, 10–15 → 0, 4–9 → +1, < 4 → +2). Without weather, from the season (summer −1, spring/autumn 0, winter +1). Evening and night add +1. Then the nudge (`lighter` −2, `bolder` +2), and the result is clamped to [−2, 2].
  - **Rotation:**
    - worn today −8; 1–3 days ago −5; 4–7 days −3; 8–14 days −1;
    - never worn: +2, or +3 for a sample candidate (reason "Untried sample");
    - last worn more than 42 days ago: +2 (reason "Not worn in N weeks").
  - **Variety:** a deterministic jitter in [0, 1) from a hash of `date|perfumeId`.
  - **Picking:** the top 3 by score, but a pick with the same family as an earlier pick loses 1 before it is compared.
- **Rule reasons:** each pick shows at most two phrases joined by " · ", strongest first. They come from the codes `untried_sample`, `neglected(weeks)`, `season`, `daypart`, `occasion`, `heavy` ("Heavy base · big sillage"), `fresh` ("Fresh and light") and `weather_fit`. Copy is in Task 5.
- **Model reasons:**
  - Model `claude-haiku-5-5`, structured output `{ picks: { id: string; reason: string }[] }`. Timeout 8 s, maxRetries 0, `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`.
  - Perfume names are fenced as data. A reason is accepted only when the id matches a pick and the text is 1–70 characters after trimming with no newline. Anything else falls back to the rule reason for that pick.
  - Cached with `'use cache'` + `cacheLife('days')`, keyed by date, daypart, nudge, occasion, weather band and pick ids.
  - Load `claude-api` before writing it.
- **Weather:**
  - Request: Open-Meteo `https://api.open-meteo.com/v1/forecast?latitude&longitude&current=temperature_2m,weather_code&timezone=Europe/London`, 5 s timeout, cached `cacheLife({ revalidate: 900 })`.
  - WMO codes map to: 0–1 "clear", 2–3 "cloudy", 45–48 "fog", 51–67 and 80–82 "rain", 71–77 and 85–86 "snow", 95–99 "storms".
  - Attribution "Weather by Open-Meteo.com" goes in the footer of Today and Settings. Any failure → no weather; the rest of the context line stays.
- **Location:** UK postcode via `https://api.postcodes.io/postcodes/{pc}` (copy Seeds `lib/settings/geo.ts`), or browser geolocation. Both are stored rounded to 2 dp. Only lat, lon and the outward code (e.g. "SW1A") are stored.
- **Stats:**
  - **Counts:** bottles = owned items with a format other than `sample`; samples = owned `sample` items; sets = number of sets.
  - **Value:** sum over owned items of `purchase_price` when set, else `typical_price_per_ml × size_ml` when both are known. Labelled "est. value" and "N without a price" when N > 0. GBP, rounded (`£3.2k` from £1,000 up).
  - **Breakdowns:** by family, season and house (owned perfumes; house top 8 plus "Other"), and by format (owned items).
  - **Neglected:** owned perfumes not worn in the last 90 days, including never worn, linking to `/collection?worn=neglected`.
  - **Highlights:** most worn (all time) and highest rated (average, at least 2 rated wears).
- **Collection filters added:**
  - `rating`: values `4` and `3`, meaning an average of at least N; only rows that have ratings match.
  - `worn`: `recent` (worn in the last 90 days) or `neglected`.
  - Filters can be seeded from the URL query (`?worn=neglected`).
- **Out of scope:**
  - Gaps, wishlist, smells like, layering and the diary year view (Phase 3).
  - Delete account and units (only ml exists) [my call: two manually created launch users; deleting an account is a SQL job].
  - The model breaking ties [my call: rules plus jitter decide; the model only phrases].
- **Design:**
  - Use the 1a tokens and components. Stars are ★/☆ in gold-deep, with a 44 px tap target each.
  - Each family has its own diary mark colour (Task 3).
  - Mobile-first at 390×844 with no horizontal scroll. Confirmations are inline, never `confirm()`.
- **Deploy:** merge to `main` locally, push, `vercel deploy --prod`. No PR.

## Review Focus

1. **London date edges:**
   - At 23:30 UTC in BST, the London date is the next day.
   - A wear logged at 00:30 London belongs to that London day.
   - The month grid is right for a month starting on a Sunday, for February in a leap year, and across the October clock change.
   - Tests in Task 2.
2. **Empty and thin data:**
   - Today with 0 owned items shows an empty state, not a crash.
   - When every perfume has empty seasons, notes and family, there are still 3 picks.
   - Stats with no items shows zeros, and value with no prices shows "£0" plus the count.
   - Tests in Tasks 2 and 6.
3. **Cross-collection and spoofed wears:**
   - Inserting a wear whose `item_id` belongs to another collection is refused.
   - A client-sent `perfume_id` is overwritten with the item's.
   - Deleting the item keeps the wear and its perfume.
   - Tests in Task 1.
4. **Model reasons misbehave:**
   - A wrong id, an over-long reason, a newline, a throw or a timeout makes that pick use its rule reason.
   - A perfume name containing `</perfumes>` stays fenced.
   - Tests in Task 5.
5. **Repetition:**
   - The same three picks shouldn't appear every day.
   - Wearing a pick today drops it from tomorrow's top 3 when there are alternatives, and the jitter changes the order across dates.
   - Tests in Task 2.

---

### Task 1: Wears and collection settings schema

**Files:**
- Create: `supabase/migrations/00013_wears_settings.sql`
- Create: `apps/web/lib/wears/__tests__/wears.integration.test.ts`
- Modify: `packages/supabase/src/database.types.ts` (regenerate with `pnpm gen:types`)

**Interfaces:**
- Produces:
  - **`wears` table:**
    - Columns: `id uuid pk`, `created_at`, `updated_at` (trigger `set_updated_at`), `collection_id uuid not null → collections on delete cascade`, `item_id uuid` (composite FK `(collection_id, item_id) → items(collection_id, id) on delete set null (item_id)`), `perfume_id uuid not null → perfumes`, `worn_on date not null`, `time_of_day text check in (day, evening, night)`, `rating smallint check 1..5`, `notes text check length ≤ 2000`, `created_by uuid default auth.uid() → auth.users on delete set null`.
    - Indexes: `(collection_id, worn_on)` and `(perfume_id)`.
  - **Trigger** `private.wear_from_item()`, `before insert or update of item_id, perfume_id, collection_id`, security definer, `search_path=''`:
    - When `item_id` is not null, set `new.perfume_id` from the item; if the item isn't in `new.collection_id`, raise `42501`.
    - On insert with a null `item_id`, raise `wear needs an item`.
    - On update, if `item_id` was set to null by the client while `perfume_id` changed, raise.
  - **RLS** `wears member all` (`private.is_member(collection_id)`).
  - **`collection_settings` table:** `collection_id uuid pk → collections on delete cascade`, `lat numeric(5,2)`, `lon numeric(5,2)`, `place text`, `updated_at`. RLS `member all`.

- [ ] **Step 1: Write failing integration tests.** Two collections, with members and items created via admin, as in `review.integration.test.ts`:
  - `member logs a wear; perfume_id comes from the item`: insert with a bogus `perfume_id` → the row's `perfume_id` equals the item's.
  - `wear with another collection's item is refused`: error code `42501` (or an FK violation).
  - `non-member cannot read or update the wear`: select → 0 rows; update → 0 rows.
  - `deleting the item keeps the wear`: `item_id` null, `perfume_id` unchanged.
  - `rating 0 and 6 are refused; null is fine`.
  - `collection_settings upsert by member; other member cannot read it`.
- [ ] **Step 2:** `pnpm --filter web test:integration -- wears` → FAIL (relation "wears" does not exist).
- [ ] **Step 3:** Write the migration. Run `supabase db push --yes`, then `pnpm gen:types` in `packages/supabase`.
- [ ] **Step 4:** Re-run → PASS (6/6). Run the full integration suite → all green.
- [ ] **Step 5: Commit** `feat(db): wears and collection settings`.

### Task 2: Core: London clock, Today scoring, month grid, wear summaries

**Files:**
- Create: `packages/core/src/time/london.ts`, `packages/core/src/today/{score.ts,reasons.ts,index.ts}`, `packages/core/src/diary/{month.ts,summary.ts,index.ts}`
- Modify: `packages/core/src/index.ts`, `packages/core/src/collection/{row.ts,filters.ts}`
- Test: `packages/core/test/{london.test.ts,today.test.ts,diary.test.ts}`, `packages/core/test/collection.test.ts`

**Interfaces:**
- Produces:
  - **London clock:**
    - `type Daypart = 'day'|'evening'|'night'`, `type Season = 'spring'|'summer'|'autumn'|'winter'`.
    - `londonNow(now: Date): { date: string; hour: number; minute: number; weekday: string; daypart: Daypart; season: Season; phase: 'early'|'mid'|'late' }`.
    - `addDays(date: string, n: number): string` and `daysBetween(a: string, b: string): number`, both on London calendar dates.
  - **Today scoring:**
    - `type Candidate = { perfumeId: string; itemId: string; house: string; name: string; family: string|null; seasons: string[]; times: string[]; occasions: string[]; weight: Weight|null; sillage: string|null; sample: boolean; lastWorn: string|null; sizeMl: number|null; setName: string|null }`.
    - `type TodayContext = { date: string; daypart: Daypart; season: Season; tempC: number|null; nudge: 'lighter'|'bolder'|null; occasion: string|null }`.
    - `type ReasonCode = { code: 'untried_sample'|'neglected'|'season'|'daypart'|'occasion'|'heavy'|'fresh'|'weather_fit'; weeks?: number }`.
    - `type Pick = { candidate: Candidate; score: number; reasons: ReasonCode[] }`.
    - `heft(c: Candidate): number`, `idealHeft(ctx): number`, `pickToday(cands: Candidate[], ctx: TodayContext, n = 3): Pick[]`.
  - **Copy:**
    - `reasonText(r: ReasonCode, ctx): string`.
    - `headline(ctx, ideal): { title: string; sub: string }`, e.g. `{ title: 'Tonight, something with presence', sub: 'Cold evening, so base-heavy and bold.' }`.
  - **Diary:**
    - `monthGrid(ym: string): { date: string; inMonth: boolean }[][]` (Monday-first weeks).
    - `type WearLite = { id: string; perfumeId: string; wornOn: string; rating: number|null }`.
    - `wearSummary(wears: WearLite[]): Map<perfumeId, { count: number; avgRating: number|null; ratedCount: number; lastWorn: string|null }>`.
  - **Collection:**
    - `CollectionRow` gains `wear: { count: number; avgRating: number|null; lastWorn: string|null }`.
    - `Filters` gains `rating` and `worn`.
    - `applyFilters(rows, f, today: string)` takes today's date as a third argument, so worn filters are pure.

- [ ] **Step 1: Write failing tests:**
  - **london:**
    - `2026-07-01T23:30Z → date 2026-07-02, hour 0, night`;
    - `2026-12-01T12:00Z → winter, early`; `2026-11-20 → autumn, late`; `2026-06-15T17:05+01 → evening`;
    - `addDays across 2026-10-25 clock change`;
    - `daysBetween('2026-01-01','2026-03-01') = 59`.
  - **today:**
    - `untried sample gets boost and reason`;
    - `worn today drops out of top 3 when ≥4 candidates`;
    - `summer + 25°C prefers citrus over oriental`; `winter evening + 2°C prefers base-heavy`;
    - `lighter nudge flips the winner`; `occasion match wins`;
    - `no metadata still returns 3 picks`; `0 candidates → []`; `2 candidates → 2`;
    - `jitter differs across dates for equal candidates` (over 10 dates, the first pick isn't always the same);
    - `same family second pick penalised`;
    - `neglected reason has weeks = floor(days/7)`;
    - `reasonText` copy for each code; `headline` for hot day and cold night.
  - **diary:**
    - `monthGrid('2026-11')`: 6 weeks, first cell `2026-10-26`, Monday-first;
    - `monthGrid('2028-02')` has 29 in-month days;
    - `wearSummary` count, average (one decimal) ignores null ratings, and `lastWorn` is the max.
  - **collection:**
    - `rating 4 keeps avg ≥ 4 only`; `worn neglected keeps never worn and > 90 days`; `worn recent keeps ≤ 90 days`.
- [ ] **Step 2:** `pnpm --filter @perfume/core test` → FAIL (missing exports).
- [ ] **Step 3:** Implement per Global Constraints. Use `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', … })` parts. Date maths uses `Date.UTC` on Y-M-D. The jitter is an FNV-1a hash of `${date}|${perfumeId}` divided by 2³².
- [ ] **Step 4:** Re-run → PASS. Typecheck the web app; fix `applyFilters` and `CollectionRow` callers (set `wear` to zeros for now).
- [ ] **Step 5: Commit** `feat(core): London clock, Today scoring, month grid, wear summaries`.

### Task 3: Logging wears and the Diary

**Files:**
- Create: `apps/web/lib/wears/load.ts`, `apps/web/components/wears/{star-rating.tsx,wear-form.tsx,log-wear-sheet.tsx}`, `apps/web/components/diary/{month-view.tsx,day-entries.tsx}`, `apps/web/components/collection/family-colour.ts`
- Modify: `apps/web/app/(app)/diary/page.tsx`

**Interfaces:**
- Consumes: `monthGrid`, `londonNow`, `addDays` (Task 2); the `wears` table (Task 1).
- Produces:
  - `loadMonth(supabase, ym): Promise<DiaryWear[]>` where `DiaryWear = { id; perfumeId; itemId|null; wornOn; timeOfDay|null; rating|null; notes|null; house; name; family|null }` (family is effective: overrides via `latestOverrides`).
  - `loadWearables(supabase): Promise<{ itemId; perfumeId; house; name; format; setName|null }[]>` (owned items).
  - `<StarRating value onChange? />`.
  - `<WearForm initial onSave(patch) onDelete? />`: date (`<input type=date>`), time-of-day chips, stars, notes.
  - `<LogWearSheet wearables defaultDate />`: search, pick an item, then WearForm; insert via the browser client, then `router.refresh()`.
  - `FAMILY_COLOUR: Record<Family, string>` (oxblood, gold, rose, muted and two mixes; aquatic/green/citrus cool; oriental/gourmand/leather warm).
- Page: `/diary?m=YYYY-MM&d=YYYY-MM-DD`.
  - The header reads "‹ October 2026 ›" with prev/next links.
  - Each day cell has a family-coloured bottle mark and a count when there are more than 1 wears; today has a ring.
  - The selected day (default today if it's in the month) lists entries: house, name, stars, notes and time. An entry links to `/collection/{perfumeId}` and has an Edit control (WearForm inline, Save/Delete with inline confirm).
  - A "Log a wear" button opens the sheet, defaulting to the selected day.
  - Empty month: "No wears logged in October."

- [ ] **Step 1:** Unit test `apps/web/components/wears/__tests__/wear-patch.test.ts` for `wearPatch(form): { worn_on; time_of_day; rating; notes }`. Blank notes give null; it never sends `perfume_id` or `collection_id`; notes over 2000 characters throw "Notes are too long". Run → FAIL. Implement in `components/wears/wear-patch.ts` → PASS.
- [ ] **Step 2:** Build the loaders and components, then the page. Typecheck and build → OK.
- [ ] **Step 3:** Playwright at 390×844, signed in as the throwaway test member with seeded items:
  - log 2 wears today and 1 on another day → marks and count shown;
  - edit a rating, then delete with confirm;
  - previous/next month navigation works;
  - no horizontal scroll.
- [ ] **Step 4: Commit** `feat(diary): log, edit and delete wears; month view`.

### Task 4: Perfume page stats and notes, set tried marks, collection filters

**Files:**
- Modify: `apps/web/lib/collection/{load.ts,perfume.ts}`, `apps/web/components/collection/{perfume-detail.tsx,set-detail.tsx,filter-sheet.tsx,collection-view.tsx,labels.ts}`, `apps/web/app/(app)/collection/page.tsx`
- Test: `apps/web/lib/collection/__tests__/load-wears.test.ts` (pure helper)

**Interfaces:**
- Consumes: `wearSummary` and `applyFilters(rows, f, today)` (Task 2), `StarRating`/`WearForm` (Task 3).
- Produces:
  - `loadCollection` also reads `wears(perfume_id, worn_on, rating)` and fills `row.wear`.
  - `PerfumeDetail` gains `wear: { count; avgRating; lastWorn }`, `notes: { id; wornOn; rating; notes; timeOfDay }[]` (wears with notes or a rating, newest first) and `wearItemId: string|null` (first owned non-sample item, else the first owned item).
  - `SetDetail.items[]` gains `tried: boolean` (the perfume has any wear in the collection) [my call: tried at the scent level].
  - `CollectionView` takes `initialFilters: Filters` from `searchParams` (`worn`, `rating`).
- Perfume page additions:
  - **Your stats:** "Worn 14× · avg ★4.3 · last worn 17 Oct", or "Not worn yet".
  - **Wear today:** visible when `wearItemId` is set. It logs today with the current daypart, then shows inline stars and note → Save.
  - **Your notes · avg ★4.3:** the notes list, each linking to `/diary?m=…&d=…`.
- Set page: each sample shows "Tried" or "Untried".
- Filter sheet: "Rating" (4★ and up, 3★ and up) and "Worn" (In the last 3 months, Not in 3 months).

- [ ] **Step 1:** Write a failing test for `wearItemFor(items)` (prefers an owned full bottle, then any owned item, else null) and `notesOf(wears)` (filtering and order). Run → FAIL. Implement in `lib/collection/wear-helpers.ts` → PASS.
- [ ] **Step 2:** Wire the loaders and UI. Typecheck and build.
- [ ] **Step 3:** Playwright:
  - "Wear today" on a perfume page → stats show "Worn 1×"; add 4 stars → appears in notes;
  - the set page shows Tried/Untried;
  - `/collection?worn=neglected` opens with the filter active.
- [ ] **Step 4: Commit** `feat(collection): wear stats and notes, wear today, tried marks, rating and worn filters`.

### Task 5: Location, weather and Today

**Files:**
- Create: `apps/web/lib/settings/geo.ts` (from Seeds, with `normalizePostcode`, `lookupPostcode`, `outwardCode`), `apps/web/lib/weather/current.ts`, `apps/web/lib/today/{load.ts,model-reasons.ts}`, `apps/web/app/api/settings/location/route.ts`, `apps/web/components/settings/location-form.tsx`, `apps/web/components/today/{context-line.tsx,pick-card.tsx,nudges.tsx}`, `packages/core/src/today/model.ts`
- Modify: `apps/web/app/(app)/today/page.tsx`, `apps/web/app/(app)/settings/page.tsx`
- Test: `apps/web/lib/settings/__tests__/geo.test.ts`, `apps/web/lib/weather/__tests__/current.test.ts`, `packages/core/test/today-model.test.ts`

**Interfaces:**
- Consumes: `pickToday`, `reasonText`, `headline`, `londonNow` (Task 2); `collection_settings` (Task 1); the wear flow from Task 4.
- Produces:
  - **Weather:**
    - `fetchCurrent(lat, lon, fetchFn = fetch): Promise<{ tempC: number; conditions: string } | null>`, which never throws.
    - `weatherText(code: number): string`.
    - `getWeather(lat, lon)`: the `'use cache'` wrapper.
  - **Location route:** `POST /api/settings/location` with `{ postcode } | { lat, lon }`.
    - 401 when signed out; 400 "That doesn't look like a UK postcode"; 404 "Postcode not found"; 503 when the lookup fails.
    - Otherwise it upserts `collection_settings` (rounded) with the member session and returns `{ place }`.
    - `DELETE` clears the location.
  - **Core model helpers:**
    - `TodayReasonsSchema` (zod) and `todayReasonsPrompt(picks, ctx)`: fenced `<perfumes>`, with `<>` stripped from names.
    - `acceptReasons(raw, picks): Map<perfumeId, string>`, which validates ids, length and newlines.
  - **Model reasons:** `modelReasons(picks, ctx, deps?) → Map | null`, with a timeout of 8 s, `'use cache'` keyed as in Global Constraints, and errors logged as `console.error('today reasons', msg)`.
  - **Today loader:** `loadToday(supabase, searchParams, now)` → `{ ctx, ideal, headline, picks, weather, hasLocation, place }`.
- Today page:
  - `ProcessPending` and the review notice as now;
  - a context line, e.g. "Saturday · 7:40 pm · Late autumn · 9°C, rain";
  - the headline and sub;
  - 3 pick cards: thumb, house, name, pyramid motif, reason (a Suspense fallback with the rule reason) and a Wear button that logs and then shows inline stars and note;
  - nudges: "Something lighter" / "Something bolder" (toggle links) and an occasion select (links to `?o=`);
  - without a location: "Set your location for weather-aware picks →" linking to `/settings`;
  - 0 owned: "Nothing on your shelf yet. Scan a bottle from the icon at the top.";
  - an attribution footer.
- Settings page: a Location section (postcode field + "Use my location" button + current place + Clear), the Open-Meteo attribution, and Sign out.

- [ ] **Step 1: Write failing tests:**
  - **geo:** `normalizePostcode('sw1a1aa') = 'SW1A 1AA'`; `outwardCode('SW1A 1AA') = 'SW1A'`; `lookupPostcode` 404 → null; network error → `GeoUnavailableError`.
  - **weather:** `fetchCurrent` parses `{current:{temperature_2m:9.4,weather_code:61}}` → `{tempC:9, conditions:'rain'}`; non-200 → null; a timeout → null; `weatherText` maps the code bands.
  - **today-model:**
    - the prompt fences and strips `<>` from a name containing `</perfumes>`;
    - `acceptReasons` drops an unknown id, a 71-character reason and a newline reason, and keeps valid ones trimmed;
    - the schema has ≤ 16 union params.
- [ ] **Step 2:** Run → FAIL. Implement → PASS.
- [ ] **Step 3:** Build the page, the components and Settings. Typecheck and build. Make one real call to `modelReasons` through a throwaway script in `apps/web/scripts/tmp/` (git-ignored) to check the latency and wording, and record both in the ledger.
- [ ] **Step 4:** Playwright:
  - set postcode SW1A 1AA in Settings;
  - Today shows weather and 3 picks; "Something lighter" changes the URL and the picks or headline;
  - Wear on a pick → "Worn ✓" plus stars; the Diary shows it;
  - Clear location → the prompt line appears.
- [ ] **Step 5: Commit** `feat(today): weather-aware picks with reasons, nudges and wear; location setting`.

### Task 6: Stats

**Files:**
- Create: `packages/core/src/stats/{stats.ts,index.ts}`, `apps/web/lib/stats/load.ts`, `apps/web/components/stats/{stat-tiles.tsx,breakdown.tsx}`
- Modify: `apps/web/app/(app)/stats/page.tsx`, `packages/core/src/index.ts`
- Test: `packages/core/test/stats.test.ts`

**Interfaces:**
- Produces:
  - `type StatItem = { perfumeId; house; name; family|null; seasons: string[]; format; status; sizeMl|null; price|null; typicalPerMl|null }`.
  - `collectionStats(items: StatItem[], wears: WearLite[], setCount: number, today: string): { bottles; samples; sets; value: { total: number; unpriced: number }; byFamily; bySeason; byHouse; byFormat: { key: string; count: number }[]; neglected: number; mostWorn: { perfumeId; house; name; count }|null; topRated: { perfumeId; house; name; avg }|null }`.
  - `formatGbp(n): string` (`£0`, `£840`, `£3.2k`).
- Page (load the `dataviz` skill before building the bars):
  - tiles for bottles, samples, sets and est. value (footnote "N without a price");
  - horizontal bar breakdowns by family (family colour), season, house and format;
  - "Worn vs neglected": "12 not worn in 3 months · see them", plus most worn and highest rated;
  - empty state: "Stats appear once your shelf has something on it."

- [ ] **Step 1: Write failing tests:** counts; value uses the price when set, else typical × size, else unpriced; gone and wishlist are excluded; byHouse caps at 8 plus Other; neglected includes never worn; topRated needs 2 rated wears; empty input gives zeros and nulls; `formatGbp` bands.
- [ ] **Step 2:** Run → FAIL. Implement → PASS.
- [ ] **Step 3:** Loader and page. Typecheck, build, then Playwright at 390×844 (tiles, bars, the neglected link opening the filtered collection).
- [ ] **Step 4: Commit** `feat(stats): totals, value, breakdowns, neglected and favourites`.

### Task 7: Ship

- [ ] Run the full unit and integration suites, typecheck and build → green.
- [ ] Do the final whole-branch review (most capable model), then a fix pass for anything Critical or Important.
- [ ] Add a "Phase 2 deployed" section to `docs/decisions.md` (rulings, real model-reason latency).
- [ ] Merge into `main`, push, `vercel deploy --prod --yes`. Smoke test: `/today`, `/diary` and `/stats` redirect to login when signed out, and `POST /api/settings/location` returns 401.
- [ ] Delete the branch and the plan workspace.
