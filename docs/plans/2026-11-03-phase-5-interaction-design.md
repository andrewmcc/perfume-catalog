# Phase 5: Interaction design round, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the app always answers a tap: an animated flacon while pages load (as Seeds' swaying strawberry), instant feedback on every control that waits on the server, and sheets and buttons that move like physical things.

**Architecture:**
- **`LoadingFlacon`** (SVG + CSS keyframes in globals.css): a bottle whose liquid laps behind the glass while three puffs of mist rise from the atomiser in turn. `role="status"` + a label. Under `prefers-reduced-motion` it holds still (the label carries the meaning).
- **Every Suspense page fallback** becomes `LoadingFlacon` with page-specific copy. Navigations between tabs therefore show it straight away.
- **Today nudges and occasion:** the cause of the wait is that a navigation is a transition, so React keeps the old screen until even the already-revealed Claude reason boundaries are ready (up to 8 s). Fixes: (1) a `PendingProvider` shares `useTransition`'s `isPending`; Nudges push inside `startTransition`; the picks dim, show a small inline flacon and `aria-busy`; the chosen chip/select updates immediately (optimistic local state). (2) Pick reasons' Suspense boundaries are keyed by the context, so new picks show the rule reasons at once and Claude's lines stream in after.
- **Nav:** `useLinkStatus` per tab: the tapped tab shows its diamond pulsing until the page arrives.
- **Touch feel:** `active:` press state on Button/ButtonLink/chips (scale 0.97, 100 ms); `-webkit-tap-highlight-color: transparent`.
- **Sheets:** one `Sheet` component (backdrop fade, panel slide up 200 ms ease-out, Escape closes, focus moves into the panel, background scroll locked) used by Log a wear, Add, Filters and the review editor.

**Spec:** docs/specs/2026-10-31-design.md "Design direction" (Apothecary label). User request 2026-11-03: loading screens like Seeds, feedback on the occasion dropdown, a round on interaction design.

## Global Constraints
- Palette tokens only (oxblood, gold, gold-deep, ink, line, card, paper). No new fonts.
- All motion ≤ 300 ms except the loader loop; every animation off under `prefers-reduced-motion: reduce`.
- 390×844, 44 px targets, no layout shift when pending states appear (dim, don't collapse).
- Deploy: merge to `main`, push, `vercel deploy --prod --yes` from repo root.

## Review Focus
1. Reduced motion: loader and sheets static, still announced.
2. Rapid taps on nudges: last choice wins, no stale screen left dimmed.
3. Sheet Escape/backdrop while busy (saving) doesn't lose work silently.
4. Focus: opening a sheet moves focus in; closing returns it to the trigger.
5. Screen readers: one status announcement per load, not repeated by every streamed boundary.

### Task 1: LoadingFlacon + fallbacks
- [ ] Component + keyframes + reduced-motion; render test (role=status, label, `aria-hidden` svg).
- [ ] Replace page fallbacks: Today "Choosing today’s picks…", Collection "Opening your shelf…", perfume "Uncorking…", set "Opening the set…", Diary "Turning the pages…", Stats "Counting bottles…", Review "Fetching your scans…", Settings location "Finding your weather…". Scan keeps its full-screen paper fallback plus the flacon.
- [ ] Browser check with throttled network: screenshot the loader.

### Task 2: Today pending feedback
- [ ] Test (RED): `nextNudgeHref` pure helper (toggle and occasion), already in nudges — move to `lib/today/href.ts`.
- [ ] PendingProvider + PendingRegion; Nudges use buttons + `startTransition`; optimistic selected state.
- [ ] Key pick reason Suspense on `${date}|${daypart}|${nudge}|${occasion}`.
- [ ] Browser check: change occasion → picks dim within one frame, new picks shown with rule reasons < 1 s, Claude lines follow.

### Task 3: Nav pending + press states
- [ ] Tab link status pulse (`useLinkStatus`), press states on Button/ButtonLink/chips, tap highlight off.

### Task 4: Sheet component
- [ ] `components/ui/sheet.tsx`; migrate the four sheets; Escape, focus in/out, scroll lock, slide/fade, reduced motion.
- [ ] Browser check each sheet opens, closes on Escape and backdrop, focus returns.

### Task 5: Review, deploy
- [ ] Suites, build, final review (opus), fix pass, decisions.md, merge, deploy.

## Unresolved questions
- None; the loader motif (flacon with mist) is my call — say if you'd rather the monogram or the pyramid.
