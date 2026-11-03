# Phase 4: Loose ends and speed, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** close the spec's remaining gaps (log a wear of something never added; delete account; the five Phase 3 minors) and make the signed-in pages measurably faster.

**Architecture:**
- **Speed, measured first.** A throwaway member on production; median server response (TTFB) of 5 loads each for `/today`, `/collection`, `/collection/[id]`, `/stats`, `/diary`. Same script after each speed change; the numbers go in decisions.md.
- **Region:** functions run in `iad1` (Washington); Supabase is in Paris (eu-west-3), so every query crosses the Atlantic. Pin functions to `cdg1` (Paris) with a root `vercel.json`.
- **Fewer round trips:** the current collection id is looked up with `auth.getUser()` (a network call to Supabase Auth) plus a members query, on top of the proxy's own `getUser()`. Use `getClaims()` (local JWT check with the project's signing keys) where only the user id is needed after the proxy has refreshed the session; memoise the collection id per request with React `cache()`.
- **Less work:** pair and gap loaders don't need signed photo URLs; `loadCollection(supabase, { thumbs: false })` skips signing.
- **Shared AI cache:** model answers (`today reasons`, `pair reasons`, `gap suggestions`) move to `'use cache: remote'` so a cold instance doesn't re-ask Claude (and re-spend quota).

**Tech Stack:** as Phase 3.

**Spec:** [docs/specs/2026-10-31-design.md](../specs/2026-10-31-design.md) §1 (add without a photo → log a wear), §5 Diary logging, §7 Settings (account, delete account). Phase 3 final-review minors in decisions.md.

## Global Constraints

- **Supabase CLI:** `SUPABASE_ACCESS_TOKEN="$(cat .superpowers/secrets/supabase-token.txt)"`; `db push --yes` authorised. Never echo secrets.
- **Auth safety:** `getClaims()` only where the proxy has already validated/refreshed the session on the same request; API routes that spend money or write keep a verified identity (getClaims verifies the JWT signature, so it qualifies; never `getSession()`).
- **Delete account:** confirm by typing `delete`. Deletes the auth user (service role). If they were the last member, their collection and everything in it (items, wears, sets, scans, photos in storage, private perfumes) go too; shared perfumes stay. Then signed out → `/login`. Irreversible; copy says so.
- **Region:** `cdg1` only.
- **Deploy:** merge to `main`, push, `vercel deploy --prod --yes` from repo root. No PR.

## Review Focus

1. Delete account with another member left: the collection and their data must stay.
2. Storage cleanup on last-member delete: no orphaned photos; another collection's photos untouched.
3. `getClaims()` on an expired token mid-request: no crash; the proxy redirects.
4. Remote cache keys still carry no per-request data (no signed URLs, cookies).
5. Logging a wear for a newly added perfume: the item exists before the wear insert (trigger requires it).

---

### Task 1: Baseline timings
- [ ] `scripts/timing.local.mts` (gitignored): seeds a throwaway member (reuse e2e-seed), signs in via Supabase password grant, sets the `sb-` auth cookie, fetches each page 6× (first discarded), prints median TTFB. Run against production. Ledger the numbers.

### Task 2: Region to Paris
- [ ] Root `vercel.json` `{ "regions": ["cdg1"] }`; deploy; `vercel inspect` shows `[cdg1]`; re-run timings.

### Task 3: Fewer auth round trips
- [ ] Test (RED): `getCurrentCollectionId` returns the same id and calls the members query once per request when called twice (React `cache`), and uses claims `sub`.
- [ ] Implement with `supabase.auth.getClaims()`; wrap in `cache()`. Leave the proxy's `getUser()` (it refreshes the session). Routes that call `getUser()` only for the id switch to the cached helper.
- [ ] Re-run timings (preview or prod).

### Task 4: Less work per page
- [ ] Test (RED): `loadCollection(..., { thumbs: false })` makes no storage call (stub client) and returns `thumb: null`.
- [ ] Pairs and Stats/gaps use `{ thumbs: false }`. Stats: one `loadCollection` instead of stats + collection where the data overlaps (or leave if loadStats needs more columns — ruling).
- [ ] AI caches → `'use cache: remote'`.

### Task 5: Log a wear of something not yet added
- [ ] `AddSheet` gains `onAdded?(added: { perfumeId; itemId; house; name })` (no redirect when given). `LogWearSheet`: when the search has no match (or always, under the list), "Not on your shelf? Add it by name" opens the add flow with status owned, then goes straight to the wear form for the new item.
- [ ] Browser check: Diary → Log a wear → add "Hermès Terre d'Hermès" → log → appears on the day.

### Task 6: Delete account
- [ ] Migration 00020: `private.delete_member(p_user uuid)` security definer, service role only: removes the membership; if the collection has no members left, returns its id for cleanup and deletes the collection (cascades) and its private perfumes.
- [ ] `POST /api/account/delete {confirm:'delete'}`: auth; storage objects under `<collectionId>/` removed when the collection goes; `auth.admin.deleteUser`; signs out.
- [ ] Integration tests (RED first): last member → collection, items, wears, private perfumes, storage files gone; shared perfume stays; second member left → collection intact; anon/authenticated can't call the function.
- [ ] Settings "Account" section: email shown, Sign out, Delete account (type `delete`).

### Task 7: Phase 3 minors
- [ ] Gaps route 404s for a gap that isn't current (test).
- [ ] Identify: `find_perfume`/items errors after the Claude call return the proposal without the match instead of a 500; `onShelf` scoped to the current collection.
- [ ] Year arrows hidden at 2000 / 2100.

### Task 8: Docs, review, deploy
- [ ] decisions.md "Phase 4" with before/after timings.
- [ ] Full suites, build, final review (opus), fix pass, merge, deploy, smoke, clean up the timing member.

## Unresolved questions
- None blocking. Delete account removes the whole collection only when no member is left (the developer login stays a member otherwise) — my call.
