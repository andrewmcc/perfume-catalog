# Decisions

Running log of decisions for the perfume catalogue. Tags: **[user]** = user decided; **[my call]** = Claude's call, open to revisit; **[user agreed]** = Claude proposed, user confirmed; **[seeds]** = carried over from a Seeds decision.

## 2026-10-31 — Initial planning
- Goals: get everything in fast; decide what to wear today; diary of wears with notes and ratings. [user]
- Also: searchable catalogue, stats, gaps, wishlist, "smells like", layering. [user]
- Three capture modes: Bottle (auto-capture), Samples (one photo of many vials), Set (box photo creates set + samples). [user]
- Claude identifies each perfume and fills in details, each field labelled by source. [user]
- Collection switches: Owned, Sets, Wishlist. [user]
- Today: three picks with reasons, a "wear" button, nudges. [user]
- Diary: several wears per day, 1-5 stars, notes; month view now. [user]
- Multi-tenant from day one: private collections, shared perfume facts. [user]
- Launch: one collection, two logins, no per-person features. [user]
- No public sign-up; membership set up manually, no invite UI. [my call]
- No running-low alerts ("too much maintenance"). [user]
- No tracking of how full a bottle is. [my call]
- Scanning is a header icon, not a big button. [user]
- Infra copies Seeds. [user]
- Design direction set by the user (see spec). [user]
- Name still open; "Flacon" is a placeholder; infra named `perfume-catalog`. [my call]
- Data model: `collections` + `collection_members`; every private table belongs to a collection. [my call]
- Item status: owned / wishlist / gone; "gone" is a one-tap action. [my call]
- `wears` copy the perfume from the item, so notes survive item deletion. [my call]
- Items of the same perfume group into one expandable row. [my call]
- Add without a photo by typing house and name; private to the collection until a label photo confirms. [user; privacy rule my call]
- Scan mode switch at top: Bottle / Samples / Set. [user modes; switch my call]
- Auto-capture on sharp, steady frame using Seeds' detector heuristics, soft pop and flash. [user, seeds]
- One photo per bottle by default; "+ back / box" adds a second. [my call]
- Samples: manual shutter at full resolution, each vial its own review result. [user; manual + full-res my call]
- Set: house, set name and scents create a set + linked sample items. [user]
- Untick vials not owned in review. [my call]
- Enrichment fills empty perfume fields, labelled "AI-suggested"; names fenced in prompt. [user, seeds]
- Samples and set photos reviewed as a group, whole photo, no crops. [my call]
- Switch Owned / Sets / Wishlist. [user + my call]
- Smells like and Layer with: owned items only, one-line reason each. [my call]
- Estimated value uses purchase price, else typical retail price x size, labelled an estimate. [my call]
- Today picks chosen per the brainstorm design. [my call]
- Stack: Next.js 16, React 19, Tailwind 4, pnpm + Turborepo, Supabase, Vercel. [user, seeds]
- Auth: email + password and Google, as in Seeds. [seeds]
- PWA, online only, service worker for the offline fallback page only. [seeds]
- AI: Claude vision, structured outputs, server-side via `after()`; start with `claude-sonnet-5-5`. [seeds]
- Weather: Open-Meteo, approximate location only. [my call]
- Git author email must be the Vercel-linked one. [seeds]
- Phasing: spike first, then phased build. [my call]

## 2026-10-31 — Phase 0 infra and build rulings
- Supabase project lives on a new, dedicated Supabase account, project in Paris (eu-west-3), not London: the account exists only for this app, CLI create was forbidden, and the latency difference is negligible. Migrate later if wanted; spike data is throwaway. [my call, user supplied the account]
- Not Seeds' Supabase project, and not the Vercel Marketplace integration: the existing org is at the free-project limit, so a new account avoids pausing anything and leaves Seeds untouched. [my call, user agreed]
- Storage bucket is `perfume-spike-captures` (private); deleted at spike end. [my call]
- `SUPABASE_ANON_KEY` is a 5th server-side env var, read in the capture page and passed as a prop; no `NEXT_PUBLIC_*` vars. The anon key is non-secret and supabase-js needs a key even for signed uploads. [my call]
- Spike access uses Seeds' cookie + unlock form (`/spike/unlock`), not `?key=`; the plan's `?key=` text is superseded. Cost: type the passcode once per device. [my call]
- Security review (automated) flagged unlock brute force and a non-expiring HMAC session token. Ruling: no change. The passcode is 96-bit random so brute force is infeasible; revoke by rotating `SPIKE_PASSCODE`; the spike is throwaway and the gated data is bottle photos, deleted before Phase 1. Phase 1 uses real Supabase Auth. [my call]
- Thumbnail object URLs are revoked/downscaled in fix round 1, since the long iPhone session with full-res samples risks Safari memory pressure. [my call]

## Phase 0 spike findings

_Pending iPhone session._
