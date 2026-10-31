# Phase 1a: Foundation, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a signed-in, installable perfume app that has:
- the Phase 1 database schema, scoped by collection, behind row-level security;
- the shared `perfumes` catalogue;
- the Apothecary design system and an app shell (Today · Collection · Diary · Stats, with a scan icon in the header);

all ready for 1b (capture and extraction) and 1c (review and collection) to build on.

**Architecture:**
- `packages/supabase` owns the typed clients and the generated DB types, as in Seeds.
- The schema lives in numbered SQL migrations pushed to the hosted project.
- RLS gives access by **collection membership**: a private helper `is_member(collection_id)` (security definer).
- Shared perfumes (`collection_id is null`) are read-only to clients. Collection-private perfumes are visible only to members of that collection.
- Auth is Supabase email + password through `@supabase/ssr` in `proxy.ts`. The spike passcode gate stays until 1b deletes the spike.
- There is no sign-up page. Members are added with a script.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`, `cacheComponents` on), React 19, Tailwind 4, `@supabase/ssr`, `@supabase/supabase-js`, Supabase CLI 2.x, Vitest.

**Spec:** [docs/specs/2026-10-31-design.md](../specs/2026-10-31-design.md): Data model, Constraints and stack, Design direction, Settings. Decisions are in [docs/decisions.md](../decisions.md), including the Phase 0 findings. Reference implementation: Seeds at `~/code/seeds`, especially `docs/plans/2026-10-26-phase-1a-foundation.md`, `docs/plans/EXECUTOR_NOTES.md`, `supabase/migrations/`, `apps/web/lib/auth/`, `apps/web/app/(auth)/` and `apps/web/app/auth/`.

## Global Constraints

- **Mirror Seeds:**
  - `packages/supabase/src/client.ts` (`createBrowserClient`, `createServerClient(cookies)`, `createServiceClient`);
  - `apps/web/lib/supabase/{server,proxy}.ts`;
  - `lib/auth/paths.ts`, with `safeRedirect`, `isPublicPath` and `loginRedirect`;
  - `/auth/callback`, `/auth/confirm` (GET renders a Continue page; POST verifies, same-origin only), `/auth/signout`;
  - the forgot-password and reset-password pages, with the token-hash recovery template `supabase/templates/recovery.html`.

  Use the scope `@perfume/*`. Never modify `~/code/seeds`.
- **Supabase project:**
  - ref `hrhxjchoxwcfhfvclnfb`, on the user's dedicated account.
  - Every Supabase CLI call must run with `SUPABASE_ACCESS_TOKEN="$(cat .superpowers/secrets/supabase-token.txt)"` (git-ignored). If the file is missing, ask the controller.
  - Never `supabase login` or `logout`: the global CLI login belongs to another account.
  - There is no Docker, so there is no local Supabase. Push migrations to the hosted project.
  - If `db push` needs a DB password that isn't in `.env.local`, stop and report. The user resets it in the dashboard into `SUPABASE_DB_PASSWORD`.
- **Env:**
  - Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (`https://perfume-catalog-cyan.vercel.app` in prod, `http://localhost:3000` locally).
  - Server-only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_DB_PASSWORD`.
  - Keep the spike vars (`SUPABASE_ANON_KEY`, `SPIKE_PASSCODE`) until 1b.
  - Never print secret values.
- **Auth:** email + password only. There is **no public sign-up** page or route, and `supabase/config.toml` has `[auth] enable_signup = false`. Members are created with `scripts/add-member.mts`.
  - **Ruling:** Google sign-in is deferred. There are only two known users, and the OAuth secret isn't in Seeds' files.
- **Tenancy:** every private table has `collection_id uuid not null references collections on delete cascade`. RLS is `using (private.is_member(collection_id))` with `with check` the same. There are no per-person features: all members have equal rights.
- **Migrations:** `supabase/migrations/00001_*.sql` onwards, one concern per file. Security definer functions use `set search_path = ''` and fully qualified names.
- **Storage:** a private bucket `photos`, with object paths `{collection_id}/{scan_id}/photo-{n}.jpg`. RLS on `storage.objects` grants access when the first path segment is a collection the user belongs to.
- **Spike:** `/spike/*` and `/api/spike/*` keep the passcode gate. Proxy checks run in this order: spike branch first, then auth.
- **Design (spec, "Design direction"):**
  - Apothecary palette: paper `#F5EEE0`, card `#FFFAF0`, oxblood `#6E2A2A` (primary), gold `#E8C46A` (accent), ink `#3A1D1D`, muted `#8A6A55`, line `#D8C8A8`, rose `#C98A8A`.
  - Fonts: Bodoni Moda (display, italic headings) and Figtree (UI). Sentence case.
  - Tabs: **Today · Collection · Diary · Stats**. The header holds the wordmark, a **small scan icon** and a settings icon. There is no central scan button.
  - Light theme only for now [my call].
  - The working name is **"Flacon"**: the display name is still open, and the icon letter follows the name.
- **Tests:**
  - `pnpm test` runs unit tests, always.
  - `pnpm --filter @perfume/supabase test:integration` runs against the hosted project and needs env. It creates throwaway users and collections and deletes them in `afterAll`.

## Review Focus

1. **Open redirect** via `redirectTo` or `next` (`//evil.com`, `https://evil.com`, `/\evil.com`): post-login, callback and confirm redirects stay on-site. Test in Task 3.
2. **Collection isolation:** a member of collection A cannot read, write, list or guess-path anything in collection B. That covers tables, the private perfumes of B and storage objects under B's prefix. Tests in Task 2.
3. **Shared catalogue tampering:** an authenticated user cannot insert, update or delete a shared perfume (`collection_id is null`), and cannot insert a perfume into a collection they're not a member of. Test in Task 2.
4. **Installed PWA fetching manifest or icons while signed out:** the proxy must not redirect `/manifest.webmanifest`, `/icon*`, `/apple-icon*`, `/favicon.ico` or `/_next/*`. Test in Task 3.
5. **Sign-up attempt** through the Supabase API with the anon key: rejected (`enable_signup = false`). Test in Task 3 (integration).

---

### Task 1: `@perfume/supabase` package and project link

**Files:**
- Create: `packages/supabase/{package.json,tsconfig.json,src/index.ts,src/client.ts,src/database.types.ts}`. The types file starts as a placeholder `export type Database = any`.
- Create: `supabase/config.toml` (`supabase init`), then `supabase link --project-ref hrhxjchoxwcfhfvclnfb`.
- Create: `packages/supabase/test/client.test.ts`.
- Modify: `apps/web/package.json` (add `@perfume/supabase: workspace:*` and `@supabase/ssr`), `.env.example`, `apps/web/.env.local` (add the public vars, from `supabase projects api-keys`), and `turbo.json` build env.

**Interfaces:**
- Produces (`@perfume/supabase`), the same signatures as Seeds' `@seeds/supabase`:
  - `createBrowserClient()`
  - `createServerClient(cookies: CookieMethodsServer)`
  - `createServiceClient()`, which throws `Error('SUPABASE_SERVICE_ROLE_KEY is required')`
  - `type Database`
- Package scripts: `build|typecheck|test|test:integration|gen:types`. `gen:types` runs `supabase gen types typescript --project-id hrhxjchoxwcfhfvclnfb --schema public > src/database.types.ts`, with the access-token env set by the caller.

- [ ] **Step 1:** Write the failing test `createServiceClient throws without a service role key`.
- [ ] **Step 2:** Run `pnpm --filter @perfume/supabase test`. Expected: FAIL.
- [ ] **Step 3:** Implement the package by copying the shape of Seeds' `packages/supabase`.
- [ ] **Step 4:** Run the tests again. Expected: PASS. Then `pnpm typecheck && pnpm build`. Expected: green.
- [ ] **Step 5:** Run `supabase init` and `supabase link`. Add the anon key and `NEXT_PUBLIC_*` values to `.env.local`.
- [ ] **Step 6:** Commit `feat(supabase): typed client package + project link`.

### Task 2: Schema, RLS and storage, with hosted integration tests

**Files:**
- Create migrations:
  - `00001_collections.sql`: `collections`, `collection_members`, schema `private`, function `private.is_member(cid uuid) returns boolean` (stable, security definer)
  - `00002_normalise.sql`: `public.normalise_name(text) returns text`. Copy the latest definition from Seeds' migrations (search `function public.normalise_name`).
  - `00003_perfumes.sql`
  - `00004_collection_tables.sql`: `sets`, `items`, `item_photos`, `scans`, `scan_results`, and an `updated_at` trigger on `items` and `scans`
  - `00005_rls.sql`
  - `00006_storage.sql`
- Create: `packages/supabase/test/integration/{helpers.ts,rls.test.ts,storage.test.ts}` and `packages/supabase/vitest.integration.config.ts`.
- Modify: `packages/supabase/src/database.types.ts` (generated).

**Interfaces (tables).** Every table has `id uuid pk default gen_random_uuid()` and `created_at timestamptz not null default now()`.

- **`collections`:** `name text not null`.
- **`collection_members`:** `collection_id → collections on delete cascade`, `user_id → auth.users on delete cascade`, `role text not null default 'member' check in ('owner','member')`, primary key `(collection_id, user_id)`. RLS: members can select rows of their own collections. There are no client insert, update or delete policies: membership is managed with the service role.
- **`perfumes`:**
  - **Identity:** `collection_id uuid null references collections on delete cascade` (null means shared), `house text not null`, `name text not null`, `concentration text check in ('edc','edt','edp','parfum','extrait','cologne','other')`, `flanker text`, `perfumers text[] not null default '{}'`, `release_year smallint`, `house_type text check in ('designer','niche','indie','celebrity','other')`.
  - **Scent:** `family text`, `subfamily text`, `accords text[] not null default '{}'`, `notes_top text[] not null default '{}'`, `notes_heart text[] not null default '{}'`, `notes_base text[] not null default '{}'`.
  - **Wear and performance:** `longevity text check in ('short','moderate','long','very_long')`, `sillage text check in ('intimate','moderate','strong','enormous')`, `seasons text[] not null default '{}'`, `times_of_day text[] not null default '{}'`, `occasions text[] not null default '{}'`, `gender_marketing text check in ('feminine','masculine','unisex')`.
  - **Status and price:** `discontinued boolean`, `reformulated boolean`, `typical_price_per_ml numeric`.
  - **Provenance:** `sources jsonb not null default '{}'` (field → `'label'|'ai'|'text'`).
  - **Matching:** `match_key text generated always as (public.normalise_name(house) || '|' || public.normalise_name(name) || '|' || coalesce(concentration,'')) stored`.
  - **Uniqueness:** unique on `match_key` where `collection_id is null`, and unique on `(collection_id, match_key)` where it isn't null.
  - **RLS:** select `using (collection_id is null or private.is_member(collection_id))`. Insert, update and delete are allowed **only** where `collection_id is not null and private.is_member(collection_id)`. Shared rows are written only by the service role.
- **`sets`:** `collection_id`, `house text`, `name text`, `notes text`.
- **`items`:**
  - **Links:** `collection_id`, `perfume_id uuid not null references perfumes`, `set_id uuid references sets on delete set null`.
  - **Format and status:** `format text not null default 'full' check in ('full','travel','decant','sample')`, `size_ml numeric`, `status text not null default 'owned' check in ('owned','wishlist','gone')`.
  - **Purchase:** `purchase_price numeric`, `purchase_currency text not null default 'GBP'`, `purchased_on date`, `purchase_source text`.
  - **Other:** `batch_code text`, `notes text`, `overrides jsonb not null default '{}'`, `updated_at`.
- **`item_photos`:** `item_id → items on delete cascade`, `collection_id`, `storage_path text not null`, `thumb_path text`, `width int`, `height int`, `position smallint not null default 0`.
- **`scans`:**
  - **Identity:** `id uuid pk` (client-generated allowed), `collection_id`, `created_by uuid references auth.users on delete set null`.
  - **Capture:** `mode text not null check in ('bottle','samples','set')`, `photo_paths text[] not null`.
  - **Processing:** `status text not null default 'uploaded' check in ('uploaded','processing','extracted','failed','reviewed')`, `extraction jsonb`, `model text`, `error text`, `attempts smallint not null default 0`, `updated_at`.
  - **RLS:** clients may insert (members only) and select. Status changes are made only by the service role, as in Seeds. Column privileges: clients can only insert `id, collection_id, created_by, mode, photo_paths`.
- **`scan_results`:** one row per perfume read from a scan.
  - **Identity:** `scan_id → scans on delete cascade`, `collection_id`, `position smallint not null`.
  - **Content:** `kind text not null check in ('bottle','vial','set_scent')`, `read jsonb not null`.
  - **Review:** `status text not null default 'pending' check in ('pending','approved','discarded')`, `created_item_id uuid references items on delete set null`.
  - **RLS:** members select. Writes come from the service role.
- **Storage:** private bucket `photos`. Policies on `storage.objects` for `bucket_id = 'photos'`: select, insert and delete when `private.is_member(((storage.foldername(name))[1])::uuid)`.

**Test helpers (`helpers.ts`):**
- `admin` (a service-role client)
- `createTestUser(): Promise<{ id: string; client: SupabaseClient<Database> }>` (admin create, then password sign-in on an anon client)
- `deleteTestUser(id)`
- `createTestCollection(memberIds: string[]): Promise<string>`
- `deleteTestCollection(id)`

The integration config skips the suite with a clear message when `SUPABASE_SERVICE_ROLE_KEY` is unset. Shared perfumes created in tests use the house prefix `zz-test-`, and `afterAll` deletes them with `like`.

- [ ] **Step 1: Write the failing `rls.test.ts`.** Users A and B start in collections CA and CB respectively. Test names and expectations:
  - `member can insert and read own collection's set, item, scan` (it creates a private perfume in CA for the item).
  - `B sees zero rows of CA's sets, items, item_photos, scans, scan_results, collection_members` (each select returns `[]`). Review Focus 2.
  - `B cannot update or delete A's item` (0 rows affected; A's row is unchanged, checked via admin).
  - `B cannot insert an item with collection_id = CA` (error code `42501`).
  - `shared perfume is readable by A and B; insert/update/delete of a shared perfume by A is rejected or affects 0 rows`. Review Focus 3.
  - `A's private perfume (collection_id = CA) is invisible to B; B cannot insert a perfume with collection_id = CA`. Review Focus 2 and 3.
  - `anon client reads no perfumes`.
  - `client cannot update scans.status` (0 rows affected or a permission error).
  - `second member of CA (user C) sees A's items` (shared collection; no per-person split).
  - `duplicate shared perfume with same normalised house/name/concentration is rejected` (unique on `match_key`, inserted via admin).
- [ ] **Step 2: Write the failing `storage.test.ts`.** A uploads `CA/<uuid>/photo-1.jpg`. B cannot download it, list CA's prefix (returns `[]`) or upload into CA's prefix (error). C, the other member of CA, can download it. Review Focus 2.
- [ ] **Step 3:** Run `pnpm --filter @perfume/supabase test:integration`. Expected: FAIL.
- [ ] **Step 4:** Write migrations 00001 to 00006, then `supabase db push`. Expected: 6 migrations applied.
- [ ] **Step 5:** Run `gen:types`, then `pnpm --filter @perfume/supabase build && pnpm typecheck`. Expected: green.
- [ ] **Step 6:** Run the integration tests. Expected: all PASS.
- [ ] **Step 7:** Commit `feat(db): collection-scoped schema, RLS, shared perfumes, photos bucket`.

### Task 3: Auth (proxy, login, recovery, confirm, sign-out) and the add-member script

**Files:**
- Create, adapted from Seeds:
  - `apps/web/lib/auth/paths.ts` and `apps/web/lib/auth/__tests__/paths.test.ts`
  - `apps/web/lib/supabase/{server,proxy}.ts`
  - `apps/web/app/(auth)/{login,forgot-password,reset-password}/page.tsx`
  - `apps/web/app/auth/{callback,confirm,signout}/route.ts` and the confirm "Continue" page
  - `supabase/templates/recovery.html` and `supabase/templates/invite.html` (the invite template links to `/auth/confirm?token_hash=…&type=invite&next=/reset-password`)
- Create: `apps/web/scripts/add-member.mts` and `apps/web/lib/auth/__tests__/add-member-args.test.ts`. Put the argument parsing in `apps/web/lib/auth/add-member-args.ts`.
- Create: `packages/supabase/test/integration/signup.test.ts`.
- Modify: `apps/web/proxy.ts` (spike branch first, then auth), `supabase/config.toml` (`[auth] enable_signup = false`, `site_url`, `additional_redirect_urls` for localhost and prod `/auth/callback` and `/auth/confirm`, and both email templates), `turbo.json`.

**Interfaces:**
- `isPublicPath(pathname)`: true for `/login`, `/forgot-password`, `/reset-password`, `/auth/*`, `/manifest.webmanifest`, `/favicon.ico`, `/icon*`, `/apple-icon*`, `/_next/*`, `/spike/*`, `/api/spike/*`, `/offline`.
- `safeRedirect(path, fallback = '/today')`. `loginRedirect(pathname, search)`.
- `/auth/confirm` accepts the types `recovery`, `invite` and `email`. Recovery and invite always land on `/reset-password`.
- `parseAddMemberArgs(argv: string[]): { email: string; collectionId?: string; collectionName: string }` (default name `'Our collection'`). It throws `Error('usage: add-member <email> [--collection <id>] [--name <name>]')` on a missing or invalid email.
- `add-member.mts`:
  1. Calls `auth.admin.inviteUserByEmail(email, { redirectTo: NEXT_PUBLIC_APP_URL + '/auth/confirm' })`, or finds the user if one already exists.
  2. Creates the collection if `--collection` isn't given.
  3. Upserts the `collection_members` row (role `owner` when it created the collection, otherwise `member`).
  4. Prints `member <email> → collection <id>`.
- Run it with: `cd apps/web && pnpm exec tsx --conditions=react-server --env-file=.env.local scripts/add-member.mts …`.

- [ ] **Step 1: Write the failing tests.**
  - `paths.test.ts`, the `safeRedirect` table: `'/collection'→'/collection'`, `'/collection?q=x'` kept, `'//evil.com'`, `'/\\evil.com'`, `'https://evil.com'`, `''` and `null` → `'/today'`. Review Focus 1.
  - `paths.test.ts`, `isPublicPath`: true for `/login`, `/forgot-password`, `/auth/confirm`, `/manifest.webmanifest`, `/icon.png`, `/apple-icon.png`, `/favicon.ico`, `/spike/capture`, `/api/spike/extract`; false for `/`, `/today`, `/collection`, `/scan`, `/review`, `/api/scans`. Review Focus 4.
  - `paths.test.ts`, `loginRedirect('/review','')` → `'/login?redirectTo=%2Freview'`.
  - `add-member-args.test.ts`: a valid email with flags parses; a missing email throws the usage error; `'not-an-email'` throws.
  - `signup.test.ts` (integration): `anon signUp is rejected` (error returned, no user created). Review Focus 5.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `paths.ts` and `add-member-args.ts`. Unit tests: PASS.
- [ ] **Step 4:** Implement the Supabase helpers, `proxy.ts`, the auth pages and routes (copied from Seeds and adapted; no signup page, no Google button), and `add-member.mts`. Read the Next 16 docs in `node_modules/next/dist/docs` for `proxy.ts` and `cookies()` first.
- [ ] **Step 5:** Run `supabase config push` (with the token env) to apply `enable_signup = false`, the redirect URLs and the templates. Then run the integration signup test. Expected: PASS.
- [ ] **Step 6:** Verify locally with `pnpm dev`:
  - `curl -I localhost:3000/collection` returns 307 to `/login?redirectTo=%2Fcollection`.
  - `/manifest.webmanifest` returns 200.
  - `/spike/capture` still returns 307 to `/spike/unlock`.
  - Run `add-member.mts` for a throwaway `zz-test+<rand>@example.com`, then delete that user and collection.
- [ ] **Step 7:** Run `pnpm typecheck && pnpm test && pnpm build`. Expected: green. Commit `feat(auth): email sign-in, recovery, invite-only members`.

### Task 4: Design system, app shell and PWA

**Files:**
- Modify:
  - `apps/web/app/globals.css` (tokens)
  - `apps/web/app/layout.tsx` (Bodoni Moda and Figtree via `next/font/google`, metadata, theme-color `#6E2A2A`)
  - `apps/web/app/manifest.ts`: name `Flacon`, `id` and `start_url` `/today`, `display: 'standalone'`, `background_color` `#F5EEE0`, `theme_color` `#6E2A2A`, PNG icons
- Create:
  - `apps/web/app/(app)/layout.tsx`, the shell. The header holds the wordmark "Flacon" in Bodoni, a scan icon linking to `/scan` (a viewfinder-with-bottle line icon) and a settings icon linking to `/settings`. The bottom tab bar has Today, Collection, Diary and Stats, with safe-area padding.
  - `apps/web/app/(app)/{today,collection,diary,stats,scan,settings}/page.tsx` placeholders, each with one line about what's coming. `settings` includes a sign-out button.
  - `apps/web/app/page.tsx`, which redirects to `/today`.
  - `apps/web/components/ui/{button,field}.tsx`.
  - `apps/web/components/brand/pyramid.tsx`, the scent-pyramid motif: `ScentPyramid({ weight }: { weight: 'top'|'heart'|'base'|null; size?: number })`, with the filled tier in gold, oxblood or rose as in the mockups.
  - Icons: `apps/web/app/icon.png` (512) and `apps/web/app/apple-icon.png` (180). These are generated from `docs/brand/app-icon.svg`, which you also create: monogram option C, an upright Bodoni Moda "F" in a gold foil gradient, inside a double gold ring (a fine outer ring and a hairline inner ring), on an oxblood radial vignette, optically centred. The reference mockup is `.superpowers/brainstorm/*/content/monogram-v2.html`, variant C. Convert the text to paths, or render with `sharp`, so the PNGs don't depend on fonts.
  - `apps/web/app/offline/page.tsx` and `apps/web/public/sw.js` (offline fallback only). Copy Seeds' worker, rename its cache prefix to `flacon-`, and keep the kill-switch note.
- Delete: the create-next-app boilerplate (`public/*.svg`, default page content).

**Interfaces:**
- CSS tokens: `--color-paper`, `--color-card`, `--color-ink`, `--color-muted`, `--color-line`, `--color-oxblood`, `--color-gold`, `--color-rose`, `--color-danger`, `--font-display`, `--font-body`. Tailwind utilities such as `bg-paper bg-card text-ink border-line bg-oxblood text-gold font-display`.
- The `(app)` route group layout is where 1b and 1c pages go. The spike pages stay outside it.

- [ ] **Step 1:** Load the `frontend-design` skill. Implement the tokens, fonts, shell, placeholders, primitives, pyramid, icons, manifest and offline page. Restyle login and recovery with the primitives and engraved-label cards: a fine inner rule, as in the mockups `apothecary-v2.html` and `apothecary-v3-extras.html`.
- [ ] **Step 2:** Run `pnpm typecheck && pnpm test && pnpm build`. Expected: green.
- [ ] **Step 3:** Check with Playwright MCP at 390×844 and 1280×800, on `/login` and, signed in as a throwaway member, on `/today`. Read the screenshots: contrast, safe area, no horizontal scroll, header icons reachable. Delete the throwaway member afterwards.
- [ ] **Step 4:** Commit `feat(web): apothecary design system, app shell, PWA`.

### Task 5: Deploy, members and on-device check

**Files:** `docs/decisions.md` (record the outcome).

- [ ] **Step 1:** Add the `NEXT_PUBLIC_*` vars and `SUPABASE_DB_PASSWORD` (if set) to Vercel production, without echoing values. Deploy with `vercel deploy --prod --yes --non-interactive < /dev/null`. Expected: Ready.
- [ ] **Step 2:** Smoke-test production:
  - signed-out `/collection` returns 307 to login;
  - `/manifest.webmanifest` returns 200 with `start_url: "/today"`;
  - `/spike/capture` returns 307 to `/spike/unlock`.
- [ ] **Step 3:** Ask the controller for the two member emails. **Ruling:** the controller asks the user once. Then run `add-member.mts` for the first email (it creates the collection) and for the second with `--collection <id>`.
- [ ] **Step 4:** **User check on iPhone:**
  - accept the invite email and set a password;
  - sign in;
  - Add to Home Screen, reopen from the home screen, and confirm it lands on `/today` still signed in;
  - check that the scan icon and tabs navigate and that sign-out works.
- [ ] **Step 5:** Record the outcome in `docs/decisions.md`. Commit `docs: Phase 1a deployed`. Merge into `main` locally, push and deploy. This follows the project preference: no PR.
