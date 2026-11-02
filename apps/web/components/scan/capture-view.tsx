'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mode } from '@perfume/core';
import { DEFAULT_GATE, createCaptureGate, type GateState } from '@/lib/capture/capture-gate';
import { blockSignature, createBackgrounds, type Signature } from '@/lib/capture/background';
import { edgeRatio, frameDiff, glareFraction, sharpness, toGray, type FrameMetrics, type Rect } from '@/lib/capture/detector';
import { playShutter, tryHaptic, unlockAudio } from '@/lib/capture/feedback';
import { createIdleTimer } from '@/lib/capture/idle';
import { useCamera } from '@/lib/capture/use-camera';
import { ModeSwitch } from './mode-switch';
import { RecentCaptures } from './recent-captures';
import { useScanQueue } from './use-scan-queue';

const TICK_MS = 150;
const SQUARE_FRACTION = 0.8;
const DETECT_SIZE = 160;
const DETECT_INNER: Rect = { x: 16, y: 16, w: 128, h: 128 }; // square + 12.5% margin each side
const CAPTURE_LONG_EDGE = 1600;
const JPEG_QUALITY_SQUARE = 0.85; // Bottle
const JPEG_QUALITY_FULL = 0.9; // Samples / Set (full frame, native resolution)
const IDLE_MS = 20_000;

// Bottle and Set take one photo, then offer an optional second; Samples is one full-frame shot.
const SECOND_PHOTO: Partial<Record<Mode, { add: string; done: string; hint: string }>> = {
  bottle: { add: '+ back / box', done: 'Next bottle', hint: 'Tap the shutter for the back or box' },
  set: { add: '+ insert card', done: 'Done', hint: 'Tap the shutter for the insert card' },
};
const HINTS: Record<Mode, string> = {
  bottle: 'Hold the bottle in the square. It captures when steady.',
  samples: 'Lay the vials out, labels up, and tap the shutter.',
  set: 'Photograph the box, then add the insert card if there is one.',
};

/** `sig` is the detection view at the first photo, learned as background if the server says "not a perfume". */
type Pending = { mode: Mode; blobs: Blob[]; sig: Signature | null };

/** The on-screen square, mapped into the video's intrinsic pixels (video is object-cover, centred). */
function squareInVideo(video: HTMLVideoElement): Rect {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sw = video.clientWidth;
  const sh = video.clientHeight;
  const scale = Math.max(sw / vw, sh / vh);
  const side = (SQUARE_FRACTION * Math.min(sw, sh)) / scale;
  return { x: (vw - side) / 2, y: (vh - side) / 2, w: side, h: side };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality));
}

/** Back to Today. Over the camera it sits on a dark disc; on the paper screens it's a plain muted icon. */
function CloseLink({ onPaper = false }: { onPaper?: boolean }) {
  return (
    <Link
      href="/today"
      aria-label="Close scanner"
      className={`flex h-11 w-11 items-center justify-center rounded-full ${onPaper ? 'text-muted' : 'bg-black/55 text-paper backdrop-blur'}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </Link>
  );
}

const pill = 'min-h-11 rounded-full px-4 text-sm font-medium';

export function CaptureView({ collectionId, userId }: { collectionId: string; userId: string }) {
  const { videoRef, status, error, start, torch } = useCamera();
  const { items, enqueue, retry } = useScanQueue(collectionId, userId);

  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<Mode>('bottle');
  const [gateState, setGateState] = useState<GateState>('armed');
  const [flash, setFlash] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  // A first photo is held here until it's queued as a 1- or 2-photo capture.
  const [pendingCount, setPendingCount] = useState(0);
  const [wantSecond, setWantSecond] = useState(false);

  const gateRef = useRef(createCaptureGate({ ...DEFAULT_GATE }));
  const idleRef = useRef(createIdleTimer(IDLE_MS));
  const modeRef = useRef<Mode>('bottle');
  const pendingRef = useRef<Pending | null>(null);
  const wantSecondRef = useRef(false);
  const pausedRef = useRef(false);
  const prevFrameRef = useRef<Uint8Array | null>(null);
  const firedFrameRef = useRef<Uint8Array | null>(null);
  const sigRef = useRef<Signature | null>(null);
  const backgroundsRef = useRef(createBackgrounds());
  /** Bottle scans whose view may be an empty background, until the server has read them. */
  const sigByScan = useRef(new Map<string, Signature>());
  const detectCanvas = useRef<HTMLCanvasElement | null>(null);
  const captureCanvas = useRef<HTMLCanvasElement | null>(null);
  const tickRef = useRef<() => void>(() => {});

  const setSecond = (v: boolean) => {
    wantSecondRef.current = v;
    setWantSecond(v);
  };

  /** Queue whatever first photo is waiting (1 or 2 photos) and chime. */
  const commitPending = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    setPendingCount(0);
    setSecond(false);
    const scanId = enqueue(p.mode, p.blobs);
    if (p.sig) sigByScan.current.set(scanId, p.sig);
    playShutter('pair');
  }, [enqueue]);

  // A bottle shot the server called "not a perfume" was the empty table: never auto-capture that view again.
  useEffect(() => {
    for (const i of items) {
      const sig = sigByScan.current.get(i.scanId);
      if (!sig || !i.serverStatus || i.serverStatus === 'processing' || i.serverStatus === 'uploaded') continue;
      if (i.serverStatus === 'discarded') backgroundsRef.current.add(sig);
      sigByScan.current.delete(i.scanId);
    }
  }, [items]);

  /** Bottle: square crop at 1600 px. Samples/Set: full frame at native resolution. */
  const grab = useCallback(
    async (m: Mode): Promise<Blob | null> => {
      const video = videoRef.current;
      const canvas = captureCanvas.current;
      if (!video || !canvas || !video.videoWidth) return null;
      if (m === 'bottle') {
        const sq = squareInVideo(video);
        const size = Math.min(CAPTURE_LONG_EDGE, Math.round(sq.w));
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d')!.drawImage(video, sq.x, sq.y, sq.w, sq.h, 0, 0, size, size);
      } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);
      }
      return canvasToJpeg(canvas, m === 'bottle' ? JPEG_QUALITY_SQUARE : JPEG_QUALITY_FULL);
    },
    [videoRef],
  );

  const onCapture = useCallback(async () => {
    const m = modeRef.current;
    const blob = await grab(m);
    if (!blob) return;
    idleRef.current.touch(performance.now());
    // Re-arm is judged against this view, so a jolt back to it doesn't re-capture.
    firedFrameRef.current = prevFrameRef.current;
    gateRef.current.lockUntilChange();
    playShutter('front');
    tryHaptic();
    setFlash(true);
    setTimeout(() => setFlash(false), 250);

    if (m === 'samples') {
      enqueue(m, [blob]);
      playShutter('pair');
      return;
    }
    const pending = pendingRef.current;
    if (pending && wantSecondRef.current) {
      pending.blobs.push(blob);
      commitPending();
      return;
    }
    commitPending(); // a new bottle / set: the previous one goes out with 1 photo
    pendingRef.current = { mode: m, blobs: [blob], sig: m === 'bottle' ? sigRef.current : null };
    setPendingCount(1);
  }, [grab, enqueue, commitPending]);

  // Latest-closure ref so the interval never sees stale state.
  tickRef.current = () => {
    const video = videoRef.current;
    const canvas = detectCanvas.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
    const sq = squareInVideo(video);
    const margin = sq.w * (DETECT_INNER.x / DETECT_INNER.w);
    const sx = Math.max(0, sq.x - margin);
    const sy = Math.max(0, sq.y - margin);
    const side = Math.min(sq.w + 2 * margin, video.videoWidth - sx, video.videoHeight - sy);
    const c = canvas.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(video, sx, sy, side, side, 0, 0, DETECT_SIZE, DETECT_SIZE);
    const gray = toGray(c.getImageData(0, 0, DETECT_SIZE, DETECT_SIZE).data, DETECT_SIZE, DETECT_SIZE);
    const prev = prevFrameRef.current;
    const fired = firedFrameRef.current;
    const sig = blockSignature(gray, DETECT_SIZE, DETECT_SIZE, DETECT_INNER);
    const metrics: FrameMetrics = {
      sharpness: sharpness(gray, DETECT_SIZE, DETECT_SIZE, DETECT_INNER),
      diff: prev ? frameDiff(gray, prev) : 255,
      edgeRatio: edgeRatio(gray, DETECT_SIZE, DETECT_SIZE, DETECT_INNER),
      sinceFire: fired ? frameDiff(gray, fired) : 255,
      glare: glareFraction(gray, DETECT_SIZE, DETECT_SIZE, DETECT_INNER),
      sinceBackground: backgroundsRef.current.distance(sig),
    };
    prevFrameRef.current = gray;
    sigRef.current = sig;

    // Auto-capture is Bottle-only, pauses when idle, and stands down while waiting for a manual second photo.
    const now = performance.now();
    const idle = modeRef.current === 'bottle' && idleRef.current.isIdle(now);
    if (idle !== pausedRef.current) {
      pausedRef.current = idle;
      setPaused(idle);
      if (!idle) gateRef.current.reset();
    }
    if (modeRef.current !== 'bottle' || idle || wantSecondRef.current) return;
    const result = gateRef.current.push(metrics, now);
    setGateState(result.state);
    if (result.fire) void onCapture();
  };

  useEffect(() => {
    if (status !== 'live') return;
    const id = setInterval(() => tickRef.current(), TICK_MS);
    return () => clearInterval(id);
  }, [status]);

  const onStart = async () => {
    unlockAudio();
    idleRef.current.touch(performance.now());
    setStarted(true);
    await start();
  };

  const changeMode = (next: Mode) => {
    if (next === modeRef.current) return;
    commitPending();
    modeRef.current = next;
    setMode(next);
    idleRef.current.touch(performance.now());
    gateRef.current.reset();
  };

  const second = SECOND_PHOTO[mode];
  const reading = items.filter((i) => i.stage !== 'failed' && i.serverStatus !== 'extracted' && i.serverStatus !== 'discarded' && i.serverStatus !== 'failed').length;
  const failed = items.filter((i) => i.stage === 'failed' || i.serverStatus === 'failed').length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#140b0b] text-paper" onPointerDown={() => idleRef.current.touch(performance.now())}>
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
      <canvas ref={detectCanvas} width={DETECT_SIZE} height={DETECT_SIZE} className="hidden" />
      <canvas ref={captureCanvas} className="hidden" />

      {!started && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-paper px-6 text-center text-ink">
          <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3">
            <CloseLink onPaper />
          </div>
          <h1 className="font-display text-3xl italic">Scan</h1>
          <p className="max-w-xs text-muted">Bottles capture themselves when steady in the square. Samples and sets use the shutter.</p>
          <button onClick={onStart} className="min-h-11 rounded-[4px] bg-oxblood px-8 text-[15px] font-medium tracking-wide text-paper shadow-[inset_0_0_0_3px_var(--color-oxblood),inset_0_0_0_4px_rgba(232,196,106,0.55)]">
            Open camera
          </button>
        </div>
      )}

      {started && status !== 'live' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-paper px-6 text-center text-ink">
          <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3">
            <CloseLink onPaper />
          </div>
          {status === 'starting' && <p className="text-muted">Opening the camera…</p>}
          {status === 'denied' && (
            <div role="alert" className="label-card max-w-sm px-6 py-6">
              <h2 className="font-display text-xl italic">Camera access is off</h2>
              <p className="mt-2 text-sm text-muted">
                On iPhone: Settings → Safari → Camera → Allow, or tap “aA” in the address bar → Website Settings → Camera. Then try again.
              </p>
            </div>
          )}
          {status === 'unavailable' && (
            <div role="alert" className="label-card max-w-sm px-6 py-6">
              <h2 className="font-display text-xl italic">No camera found</h2>
              <p className="mt-2 text-sm text-muted">This device has no usable rear camera. {error}</p>
            </div>
          )}
          {status === 'error' && (
            <p role="alert" className="text-danger">
              Camera error: {error}
            </p>
          )}
          {status !== 'starting' && (
            <button onClick={() => void start()} className="min-h-11 rounded-[4px] border border-oxblood px-6 text-oxblood">
              Try again
            </button>
          )}
        </div>
      )}

      {/* Square guide: Bottle only, since the other modes take the full frame. */}
      {mode === 'bottle' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`aspect-square rounded-[6px] border-2 transition-colors duration-150 ${
              flash ? 'border-gold bg-gold/25' : gateState === 'steadying' ? 'border-gold' : 'border-paper/80'
            }`}
            style={{ width: `${SQUARE_FRACTION * 100}vmin`, boxShadow: '0 0 0 100vmax rgba(20,11,11,0.5)' }}
          />
        </div>
      )}
      {mode !== 'bottle' && flash && <div className="pointer-events-none absolute inset-0 bg-gold/25" />}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <ModeSwitch mode={mode} onChange={changeMode} />
          <div className="flex items-center gap-2">
            {torch && (
              <button
                onClick={() => {
                  const on = !torchOn;
                  setTorchOn(on);
                  void torch(on);
                }}
                aria-pressed={torchOn}
                className={`${pill} ${torchOn ? 'bg-gold text-ink' : 'bg-black/55 text-paper'} backdrop-blur`}
              >
                Torch
              </button>
            )}
            <CloseLink />
          </div>
        </div>
        <p className="mt-2 px-1 text-sm text-paper/80" aria-live="polite">
          {paused ? <span className="font-medium text-gold">Paused. Tap anywhere to resume.</span> : HINTS[mode]}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {second && pendingCount > 0 && (
          <div className="mb-4 flex items-center justify-center gap-3">
            {wantSecond ? (
              <p className="rounded-full bg-black/60 px-4 py-2.5 text-sm backdrop-blur">{second.hint}</p>
            ) : (
              <button onClick={() => setSecond(true)} className={`${pill} bg-paper text-oxblood`}>
                {second.add}
              </button>
            )}
            <button onClick={commitPending} className={`${pill} bg-black/55 text-paper backdrop-blur`}>
              {second.done}
            </button>
          </div>
        )}
        <div className="grid grid-cols-3 items-center">
          <button onClick={() => setShowRecent((v) => !v)} className={`${pill} justify-self-start bg-black/55 text-paper backdrop-blur`}>
            Recent{items.length ? ` (${items.length})` : ''}
            {failed > 0 && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-danger align-middle" aria-label={`${failed} failed`} />}
          </button>
          <button
            onClick={() => {
              unlockAudio();
              void onCapture();
            }}
            aria-label="Take photo"
            className="h-[72px] w-[72px] justify-self-center rounded-full border-[3px] border-gold bg-paper/15 shadow-[inset_0_0_0_4px_rgba(20,11,11,0.6)] active:bg-paper/50"
          />
          <p className="justify-self-end text-right text-xs text-paper/70" aria-live="polite">
            {reading > 0 ? `Reading ${reading}…` : ''}
          </p>
        </div>
      </div>

      {showRecent && <RecentCaptures items={items} onRetry={retry} onClose={() => setShowRecent(false)} />}
    </div>
  );
}
