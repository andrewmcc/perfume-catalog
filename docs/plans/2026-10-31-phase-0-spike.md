# Phase 0: Capture and Identification Spike, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A passcode-gated page at a Vercel URL, opened on the user's iPhone, with three scan modes:
- **Bottle:** captures a bottle held in the square automatically, with an optional second photo.
- **Samples:** one manual full-resolution photo of many vials.
- **Set:** a manual photo of a discovery-set box, with an optional photo of the insert.

Each capture is uploaded and Claude's identification is shown. The spike answers four questions:
- Does auto-capture work on shiny, curved glass?
- Which thresholds hold up?
- Can Claude read 8–10 tiny vial labels in one photo?
- Does one box photo produce the set and its list of scents?

The captures become eval fixtures.

**Architecture:**
- **Structure:** a minimal pnpm/Turborepo monorepo (`apps/web` with Next 16, plus `packages/core` holding the fixtures). Everything else is throwaway code under `spike` paths.
- **Starting point:** the capture primitives (detector, gate, idle timer, sounds, camera hook) are copied from the Seeds production code. This plan adds a glare metric.
- **Uploads:** photos go **directly from the browser to Supabase Storage via signed upload URLs**. Full-resolution photos exceed Vercel's 4.5 MB request-body limit.
- **Identification:** one extract route calls Claude with structured outputs. There is a different schema for each mode.

**Tech Stack:** pnpm 10, Turborepo 2, Next.js 16 (App Router, `proxy.ts`), React 19, Tailwind 4, TypeScript 5, Vitest, `@supabase/supabase-js`, `@anthropic-ai/sdk` (with `betaZodOutputFormat`), zod 4, `tsx`.

**Spec:** [docs/specs/2026-10-31-design.md](../specs/2026-10-31-design.md). See its sections "Capture", "Identification and details" and "Phasing". Reference app: `~/code/seeds`. Its deleted spike is readable with `git -C ~/code/seeds show e0ccfdb^:<path>`; its lessons are in `~/code/seeds/docs/decisions.md` under "Phase 0 spike findings".

## Global Constraints

- **Throwaway code:** spike code lives only under `apps/web/app/spike/**`, `apps/web/app/api/spike/**`, `apps/web/lib/spike/**` and `apps/web/scripts/spike-*`, so it can be deleted in one go.
- **Minimal tests:** detector maths, the gate, the idle timer, passcode access and the extraction schemas only.
- **Mirror Seeds:** copy the root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.npmrc` and `.vercelignore`, and the `packages/core` package.json and tsconfig shape. Use the scope `@perfume/*` instead of `@seeds/*`, and keep only the env vars this plan lists.
- **Versions:** match Seeds' installed versions or newer (Next 16.4.x, React 19.3, Tailwind 4, zod 4, `@anthropic-ai/sdk` ^1.3).
- **Supabase project:**
  - name: `perfume-catalog`
  - org: `alfzryvpkcsfudhgrhga`
  - region: `eu-west-2`
- **Vercel project:**
  - name: `perfume-catalog`, in the team `andrewmccs-projects`
  - root directory: `apps/web`
  - git author email: `andrew.mccafferty@gmail.com` (the Vercel-linked email; deploys are blocked otherwise).
- **Storage:** private bucket `spike-captures`. Objects go at `{captureId}/photo-1.jpg`, an optional `{captureId}/photo-2.jpg`, `{captureId}/meta.json` and `{captureId}/extraction.json`. `captureId` = `crypto.randomUUID()`.
- **Server env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (a **new** key named `perfume-catalog`), `SPIKE_PASSCODE`. No `NEXT_PUBLIC_*` secrets.
- **Model:** `claude-sonnet-5-5`, with `betas: ['server-side-fallback-2026-07-01']` and `fallbacks: 'default'`, exactly as in `~/code/seeds/packages/core/src/extraction/claude.ts`. **Load the `claude-api` skill before writing the extract code.**
- **Structured outputs:** at most 16 nullable/union parameters per schema. Use `""`, `[]` and `0` sentinels for "not present", as in Seeds.
- **Image sizes:**
  - Bottle mode: JPEG, long edge **1600 px**, quality 0.85.
  - Samples and Set modes: JPEG, **full camera resolution** (the video track's native frame), quality 0.9.
  - Detector frames: 160×160, taken from the square region plus a margin.
- **Gate defaults:** start from Seeds' tuned `DEFAULT_GATE` (`minSharpness 2500, maxDiff 15, minEdgeRatio 0, stableMs 500, rearmDiff 25`), plus a new `maxGlare: 1` (glare check off by default).
- **Idle pause:** auto-capture pauses after **20 s** without a capture or tap. Tapping resumes it.
- **Feedback:** no vibration on iPhone. Use Seeds' `feedback.ts` soft pop (`playShutter('front')`) for each capture and the chime (`playShutter('pair')`) when a capture is queued, plus a border flash. Call `tryHaptic()` too: it vibrates on Android and does nothing on iPhone.

## Review Focus

1. **A bottle held still after capture:** it must not fire again until the view changes a lot (the next bottle). Covered by the Seeds gate tests copied in Task 2.
2. **The phone left pointing at a shelf or keyboard:** after 20 s with no capture, auto-capture pauses and shows "Paused, tap to resume". Test in Task 2 (idle timer); manual check in Task 4.
3. **Glare covering the label:** the glare fraction is measured and shown, and the gate rejects frames above `maxGlare` when the user lowers it. Test in Task 2.
4. **A samples or set photo with no perfume, or zero readable vials:** the result card says "Nothing recognised", not an error, and the capture is still saved for the fixtures. Test in Task 3 (the schema accepts empty lists); manual check in Task 4.
5. **An upload failing mid-session (full-resolution photos are large):** the capture stays in memory with **Retry**. Nothing is lost silently. Manual check in Task 4.

---

### Task 1: Monorepo skeleton, infra and deploy

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json` (build env: the four server env vars only), `tsconfig.json`, `.npmrc`, `.vercelignore`, `.env.example`. Keep the existing `.gitignore` and add the Seeds entries to it.
- Create: `apps/web/**` with `pnpm create next-app@latest apps/web --ts --tailwind --app --no-src-dir --no-eslint --import-alias "@/*" --use-pnpm --yes`. Rename the package to `@perfume/web`, add `typecheck` (`next typegen && tsc --noEmit`) and `test` (`vitest run`) scripts, and copy `vitest.config.ts` from Seeds.
- Create: `packages/core/{package.json,tsconfig.json,src/index.ts}` and `packages/core/test/fixtures/README.md`, which documents the layout `<mode>/<captureId>/{photo-1.jpg,photo-2.jpg?,expected.json}` with mode `bottle|samples|set`.
- Create: `apps/web/scripts/spike-setup.mts`, which creates the private `spike-captures` bucket if it's missing. Adapt it from `git -C ~/code/seeds show e0ccfdb^:apps/web/scripts/spike-setup.mts`.

**Interfaces:**
- Produces: workspaces `@perfume/web` and `@perfume/core`; root scripts `build`, `dev`, `test`, `typecheck`; env as in Global Constraints.

- [ ] **Step 1:** Write the root files and the `packages/core` skeleton, scaffold `apps/web`, then run `pnpm install`. Expected: success.
- [ ] **Step 2:** Run `pnpm typecheck && pnpm build`. Expected: both pass.
- [ ] **Step 3:** Run `supabase projects create perfume-catalog --org-id alfzryvpkcsfudhgrhga --region eu-west-2 --db-password "$(openssl rand -base64 24)"`.
  - Give the DB password to the user to store. Never write it to the repo.
  - Put the URL and service role key (from `supabase projects api-keys --project-ref <ref>`) into `apps/web/.env.local`.
  - If the org's project limit is hit, stop and tell the user.
- [ ] **Step 4:** Ask the user to create an Anthropic API key named `perfume-catalog` and paste it into `.env.local`. Generate a random `SPIKE_PASSCODE` with `openssl rand -hex 12`.
- [ ] **Step 5:** Run `pnpm --filter @perfume/web exec tsx --env-file=.env.local scripts/spike-setup.mts`. Expected output: `bucket spike-captures ready`.
- [ ] **Step 6:** Deploy to Vercel:
  - From the repo root, run `vercel link --yes --project perfume-catalog`. If it isn't logged in, ask the user to run `! vercel login`.
  - Set the root directory to `apps/web`.
  - Add the four env vars to production with `vercel env add`.
  - Run `vercel deploy --prod`. Expected: the default Next page at the production URL.
- [ ] **Step 7:** Commit with `chore: monorepo skeleton, Supabase + Vercel projects`.
  - If no GitHub remote exists, ask the user whether to create `andrewmcc/perfume-catalog` (private) with `gh repo create`, then push.

### Task 2: Capture primitives (copied from Seeds) plus glare

**Files:**
- Create, copied from `~/code/seeds/apps/web/lib/capture/`: `apps/web/lib/spike/{detector.ts,capture-gate.ts,idle.ts,feedback.ts,use-camera.ts}` and `apps/web/lib/spike/__tests__/{detector.test.ts,capture-gate.test.ts,idle.test.ts,images.ts}`
- Modify: `apps/web/lib/spike/detector.ts`, `apps/web/lib/spike/capture-gate.ts`

**Interfaces:**
- Produces (the same names as in Seeds, plus):
  - `glareFraction(gray: Uint8Array, w: number, h: number, r: Rect, threshold = 250): number`, the fraction (0–1) of pixels in `r` with luma ≥ `threshold`.
  - `FrameMetrics` gains `glare: number`.
  - `GateConfig` gains `maxGlare: number`. `DEFAULT_GATE.maxGlare = 1`.
  - A frame is "good" only when `glare <= maxGlare`, in addition to the existing rules.
- Existing exports used later: `toGray`, `sharpness`, `frameDiff`, `edgeRatio`, `createCaptureGate`, `DEFAULT_GATE`, `createIdleTimer`, `unlockAudio`, `playShutter(kind: 'front'|'pair')`, `tryHaptic`, `useCamera()`.

- [ ] **Step 1:** Copy the files, change import paths, then run `pnpm --filter @perfume/web test`. Expected: the copied tests pass unchanged, apart from `FrameMetrics` literals in the tests, which need `glare: 0` added.
- [ ] **Step 2: Write the failing tests** in `detector.test.ts` and `capture-gate.test.ts`:
  - `glareFraction(flat(128), ...) === 0`
  - `glareFraction(flat(255), ...) === 1`
  - an image that is half 255 and half 100 gives a value within 0.01 of 0.5
  - gate with `maxGlare: 0.05`: good frames with `glare: 0.2` for 2 s give no fire; the same frames with `glare: 0.01` fire at ≥ 500 ms
  - with `DEFAULT_GATE`, `glare: 0.9` still fires (glare check off by default)
- [ ] **Step 3:** Run the tests. Expected: FAIL (`glareFraction` is not exported).
- [ ] **Step 4:** Implement `glareFraction` and the `maxGlare` rule.
- [ ] **Step 5:** Run the tests. Expected: all pass.
- [ ] **Step 6:** Commit with `feat(spike): capture primitives from Seeds + glare metric`.

### Task 3: Passcode gate, signed uploads and extraction

**Files:**
- Create, adapted from Seeds' spike at `e0ccfdb^`: `apps/web/lib/spike/access.ts`, `apps/web/proxy.ts`, `apps/web/app/spike/unlock/page.tsx`, `apps/web/app/spike/unlock/submit/route.ts`, `apps/web/lib/spike/supabase-admin.ts`, `apps/web/lib/spike/__tests__/access.test.ts`
- Create: `apps/web/lib/spike/extract-schema.ts`, `apps/web/lib/spike/extract-prompt.ts`, `apps/web/lib/spike/extract.ts`
- Create: `apps/web/app/api/spike/upload-url/route.ts`, `apps/web/app/api/spike/extract/route.ts`
- Test: `apps/web/lib/spike/__tests__/extract-schema.test.ts`

**Interfaces:**
- **Produces (access):** the same behaviour as Seeds' spike access. Copy its tests, which include "empty secret means deny" (fail closed). `proxy.ts` matches `/spike/:path*` and `/api/spike/:path*`.
- **Produces (`POST /api/spike/upload-url`):**
  - Body: `{ mode: 'bottle'|'samples'|'set', photos: 1|2 }`.
  - It creates `captureId`, writes `meta.json` (`{ mode, photos, createdAt, userAgent }`), and returns `{ captureId, uploads: { path: string; token: string }[] }` from `storage.createSignedUploadUrl` for each `photo-N.jpg`.
  - It returns 400 when `mode` or `photos` is invalid.
  - The client uploads with `supabase.storage.from('spike-captures').uploadToSignedUrl(path, token, blob)`, using a client built from `SUPABASE_URL` passed to the page as a prop, with no key needed for signed uploads. If the SDK requires an anon key, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which are not secrets.
- **Produces (`POST /api/spike/extract`):**
  - Body: `{ captureId }`.
  - It reads `meta.json`, downloads the photos and calls `extractCapture`. It writes `extraction.json` (`{ mode, result, ms }`) and returns the same JSON.
  - It returns 404 for an unknown `captureId`, and 502 with `{ error }` when the Claude call fails.
- **Produces (`extract-schema.ts`), zod schemas and inferred types:**
  - `Mode = z.enum(['bottle','samples','set'])`, used by both routes and the page
  - `FieldStatus = z.enum(['clear','unclear','absent'])`
  - `Concentration = z.enum(['edc','edt','edp','parfum','extrait','cologne','other',''])`
  - `PerfumeRead = { house: string; name: string; concentration: Concentration; flanker_or_edition: string; size_ml: number /* 0 = not printed */; status: { house: FieldStatus; name: FieldStatus; concentration: FieldStatus } }`
  - `BottleResult = { is_perfume: boolean; perfume: PerfumeRead; format: z.enum(['full','travel','decant','sample']); batch_code: string; identified_from: z.enum(['label','shape','both','none']); other_text: string }`
  - `SamplesResult = { is_perfume_photo: boolean; vials: PerfumeRead[]; unreadable_count: number }`
  - `SetResult = { is_discovery_set: boolean; set_house: string; set_name: string; status: { set_name: FieldStatus }; scents: PerfumeRead[] }`
- **Produces (`extract.ts`):**
  - `extractCapture(client: Anthropic, mode: Mode, photos: string[] /* base64 JPEG */): Promise<BottleResult|SamplesResult|SetResult>`
  - It follows the structure of `~/code/seeds/packages/core/src/extraction/claude.ts`: images labelled "Photo 1:"/"Photo 2:", the mode's prompt, `betaZodOutputFormat(schema)`, and it throws on refusal or unparseable output.
- **Prompt content (`extract-prompt.ts`, one prompt per mode, sharing a common preamble):**
  - The common preamble:
    - Perfume houses and names exactly as printed.
    - Concentration only if printed, otherwise `""` with status `absent`.
    - Status `unclear` when the text is printed but hard to read or ambiguous.
    - For a bottle, the bottle and cap shape may identify a well-known perfume when the label is partial; set `identified_from` accordingly.
    - Never guess a name with nothing to go on: use `""` with status `absent`.
  - The samples prompt adds: one entry per vial, left to right then top to bottom; count unreadable vials in `unreadable_count`, not as entries.
  - The set prompt adds: read the scent list from the box or the insert card; `set_house` is the house selling the set; a scent's `house` is `""` unless it differs from `set_house`.

- [ ] **Step 1:** Copy the access tests from Seeds. Write `extract-schema.test.ts`:
  - each schema parses a representative valid object;
  - `SamplesResult` and `SetResult` parse with empty `vials`/`scents` (Review Focus 4);
  - `Concentration` rejects `'EDP'` (lower case only);
  - a helper `countUnionParams(schema)` (in the test file) asserts ≤ 16 for each schema.
- [ ] **Step 2:** Run `pnpm --filter @perfume/web test`. Expected: FAIL (the modules are missing).
- [ ] **Step 3:** Implement access, proxy, unlock, supabase-admin and the schemas.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Load the `claude-api` skill, then implement `extract-prompt.ts`, `extract.ts` and both routes.
- [ ] **Step 6:** Check by hand with `pnpm dev`:
  - `curl -i localhost:3000/api/spike/upload-url -X POST` returns 401 without the cookie.
  - With the cookie: request an upload URL, upload any perfume photo from the web with `uploadToSignedUrl` in a small `tsx` snippet, then call extract. Expected: JSON matching `BottleResult`.
- [ ] **Step 7:** Commit with `feat(spike): passcode gate, signed uploads, per-mode extraction`.

### Task 4: Capture page

**Files:**
- Create: `apps/web/app/spike/capture/page.tsx` (a server wrapper passing the Supabase URL and anon key), `apps/web/app/spike/capture/capture-client.tsx` (`'use client'`), `apps/web/app/manifest.ts` (`name: "Perfume spike"`, `display: "standalone"`, `start_url: "/spike/capture"`, plus a placeholder icon). The page structure starts from `git -C ~/code/seeds show e0ccfdb^:apps/web/app/spike/capture/page.tsx`.

**Interfaces:**
- Consumes: everything from Task 2; `/api/spike/upload-url` and `/api/spike/extract` from Task 3.

**Behaviour:**
- **Start:** a "Start session" tap unlocks audio and starts the rear camera.
- **Layout:** full-screen video with a centred square at 80% of the shorter side. The mode switch at the top reads **Bottle · Samples · Set**.
- **Bottle mode:**
  - Every 150 ms, measure the frame against the gate. On `fire`, grab the square region at a 1600 px long edge, then pop and flash.
  - Then show "+ back / box" and "Next bottle". "+ back / box" takes one more photo with the manual shutter. "Next bottle", or the next auto-fire, queues the capture with 1 or 2 photos and plays the chime.
  - The manual shutter is always visible.
  - The idle timer pauses auto-capture after 20 s, showing "Paused, tap to resume".
- **Samples mode:**
  - No auto-capture. The square overlay is hidden and the shutter takes the **full frame** at native resolution.
  - The photo is queued immediately as a 1-photo capture.
- **Set mode:**
  - The manual shutter takes the box photo. Then show "+ insert card" and "Done", the same as the bottle's second photo.
  - Captures are full frame at native resolution.
- **Queue:**
  - Each capture moves through `uploading → extracting → done | failed`, in memory, with its blobs kept until it's `done`.
  - A failed capture shows **Retry**, which re-runs from the step that failed (Review Focus 5).
  - A "Recent" list shows a thumbnail, the mode, the time taken, and a readable summary:
    - Bottle: "house · name · concentration" plus the statuses.
    - Samples: "N vials read, M unreadable", then one line per vial.
    - Set: "set name", then one line per scent.
    - Raw JSON is behind a toggle.
    - If `is_perfume`/`is_perfume_photo`/`is_discovery_set` is false, or no vials or scents were read, show "Nothing recognised" (Review Focus 4).
- **Debug drawer:**
  - Live metrics including glare, and the gate state.
  - A slider for every `GateConfig` field, `maxGlare` included, saved to `localStorage` inside try/catch.
  - A "Copy config" button.
- **Torch:** a torch toggle when the device supports it.
- **Camera errors:** if camera access is denied or there's no camera, show the `denied`/`unavailable` messages with guidance for iPhone Settings → Safari → Camera.

- [ ] **Step 1:** Implement the page, the client component and the manifest.
- [ ] **Step 2:** Run `pnpm typecheck && pnpm --filter @perfume/web test`. Expected: both pass.
- [ ] **Step 3:** Run `vercel deploy --prod`. In desktop Chrome with a webcam:
  - `/spike/capture` without the key gives 401;
  - with `?key=`, the camera starts and the metrics move;
  - each mode completes one capture through to `done`.
- [ ] **Step 4:** Manual check for Review Focus 5: go offline in DevTools, capture in Samples mode, and confirm it shows `failed` with Retry. Go back online and Retry; it reaches `done`.
- [ ] **Step 5:** Manual check for Review Focus 2: leave the camera on a static scene for 25 s. Expect one capture at most, then "Paused".
- [ ] **Step 6:** Commit with `feat(spike): three-mode capture page + PWA manifest`, then push.

### Task 5: iPhone session, fixtures and findings

**Files:**
- Create: `apps/web/scripts/spike-export-fixtures.mts`
- Create: `packages/core/test/fixtures/<mode>/<captureId>/{photo-1.jpg,photo-2.jpg?,expected.json}`
- Create: `docs/decisions.md`. Use the Seeds format: tags, dated sections. Seed it with the decisions from the spec's tags, then add a "Phase 0 spike findings" section.

**Interfaces:**
- Produces: the fixture layout for the Phase 1 eval. `expected.json` is the extraction `result` with every `status` object removed.

- [ ] **Step 1:** Give the user the URL with `?key=`. Ask them to capture, in Safari and as a home-screen app:
  - **Bottles:** ~25, including clear glass, frosted glass, metallic, and at least 3 with the label only on the back.
  - **Samples:** 3 photos of 8–10 vials.
  - **Sets:** 2 discovery-set boxes, if owned.

  Report back on:
  - Does auto-capture fire reliably on glass?
  - Any false fires or double captures?
  - Does lowering `maxGlare` help or hurt?
  - Seconds per bottle.
  - Is the sound OK?
  - Are vial labels read?
  - Is the set list complete?
- [ ] **Step 2:** Implement `spike-export-fixtures.mts`. It lists `spike-captures`, downloads every capture that has an `extraction.json`, and writes the fixture layout. It also writes `draft.json` (the full extraction) next to `expected.json`.
- [ ] **Step 3:** Run it. Expected output: `exported N captures (b bottle, s samples, t set)`.
- [ ] **Step 4:** The user corrects `expected.json` against the photos. Offer a temporary local HTML viewer (photo next to editable JSON) that isn't committed. Count the corrected fields for each mode.
- [ ] **Step 5:** Write the findings to `docs/decisions.md`:
  - the tuned `GateConfig` (from "Copy config");
  - whether glare gating is worth keeping;
  - seconds per bottle;
  - accuracy per mode (fields corrected ÷ total);
  - vials read ÷ vials present;
  - set list completeness;
  - how often `identified_from` was `shape`, and whether those were right;
  - any schema changes for Phase 1.
- [ ] **Step 6:** Commit with `docs: Phase 0 spike findings + eval fixtures`, then push.

**Exit:** the user decides whether to go ahead with the Phase 1 plan. The spike code is deleted when Phase 1 capture replaces it. The fixtures stay.
