'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_GATE, createCaptureGate, type GateConfig, type GateState } from '@/lib/spike/capture-gate';
import { edgeRatio, frameDiff, glareFraction, sharpness, toGray, type FrameMetrics, type Rect } from '@/lib/spike/detector';
import type { Mode } from '@/lib/spike/extract-schema';
import { playShutter, tryHaptic, unlockAudio } from '@/lib/spike/feedback';
import { createIdleTimer } from '@/lib/spike/idle';
import { useCamera } from '@/lib/spike/use-camera';
import { useCaptureQueue } from './capture-queue';
import { DebugDrawer } from './debug-drawer';
import { RecentList } from './recent-list';

const TICK_MS = 150;
const SQUARE_FRACTION = 0.8;
const DETECT_SIZE = 160;
const DETECT_INNER: Rect = { x: 16, y: 16, w: 128, h: 128 }; // square + 12.5% margin each side
const CAPTURE_LONG_EDGE = 1600;
const JPEG_QUALITY_SQUARE = 0.85; // Bottle
const JPEG_QUALITY_FULL = 0.9; // Samples / Set (full frame)
const IDLE_MS = 20_000;
const CONFIG_KEY = 'perfume-spike-gate-config-v2';

const MODES: { id: Mode; label: string }[] = [
  { id: 'bottle', label: 'Bottle' },
  { id: 'samples', label: 'Samples' },
  { id: 'set', label: 'Set' },
];
// Bottle and Set take one photo, then offer an optional second one; Samples is one full-frame shot.
const SECOND_PHOTO: Partial<Record<Mode, { add: string; done: string; hint: string }>> = {
  bottle: { add: '+ back / box', done: 'Next bottle', hint: 'Press the shutter for the back / box' },
  set: { add: '+ insert card', done: 'Done', hint: 'Press the shutter for the insert card' },
};
const EMPTY_METRICS: FrameMetrics = { sharpness: 0, diff: 0, edgeRatio: 0, sinceFire: 0, glare: 0 };

type Pending = { mode: Mode; blobs: Blob[] };

function loadConfig(): GateConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_GATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_GATE };
}

function saveConfig(cfg: GateConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {}
}

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
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality),
  );
}

export default function CaptureClient({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const { videoRef, status, error, start, torch } = useCamera();
  const { items, enqueue, retry } = useCaptureQueue(supabaseUrl, supabaseAnonKey);

  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<Mode>('bottle');
  const [gateState, setGateState] = useState<GateState>('armed');
  const [metrics, setMetrics] = useState<FrameMetrics>(EMPTY_METRICS);
  const [flash, setFlash] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [config, setConfig] = useState<GateConfig>(DEFAULT_GATE);
  // A first photo is held here until it's queued as a 1- or 2-photo capture.
  const [pendingCount, setPendingCount] = useState(0);
  const [wantSecond, setWantSecond] = useState(false);

  const configRef = useRef<GateConfig>({ ...DEFAULT_GATE });
  const gateRef = useRef(createCaptureGate(configRef.current));
  const idleRef = useRef(createIdleTimer(IDLE_MS));
  const modeRef = useRef<Mode>('bottle');
  const pendingRef = useRef<Pending | null>(null);
  const wantSecondRef = useRef(false);
  const pausedRef = useRef(false);
  const prevFrameRef = useRef<Uint8Array | null>(null);
  const firedFrameRef = useRef<Uint8Array | null>(null);
  const detectCanvas = useRef<HTMLCanvasElement | null>(null);
  const captureCanvas = useRef<HTMLCanvasElement | null>(null);
  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    const loaded = loadConfig();
    Object.assign(configRef.current, loaded);
    setConfig(loaded);
  }, []);

  const updateConfig = (key: keyof GateConfig, value: number) => {
    configRef.current[key] = value; // the gate reads this object on every push
    const next = { ...configRef.current };
    setConfig(next);
    saveConfig(next);
  };

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
    enqueue(p.mode, p.blobs);
    playShutter('pair');
  }, [enqueue]);

  /** Bottle/Set: square crop at 1600 px. Samples/Set: full frame at native resolution. */
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
    pendingRef.current = { mode: m, blobs: [blob] };
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
    const m: FrameMetrics = {
      sharpness: sharpness(gray, DETECT_SIZE, DETECT_SIZE, DETECT_INNER),
      diff: prev ? frameDiff(gray, prev) : 255,
      edgeRatio: edgeRatio(gray, DETECT_SIZE, DETECT_SIZE, DETECT_INNER),
      sinceFire: fired ? frameDiff(gray, fired) : 255,
      glare: glareFraction(gray, DETECT_SIZE, DETECT_SIZE, DETECT_INNER),
    };
    prevFrameRef.current = gray;
    setMetrics(m);

    // Auto-capture is Bottle-only, pauses when idle, and stands down while waiting for a manual second photo.
    const now = performance.now();
    const idle = modeRef.current === 'bottle' && idleRef.current.isIdle(now);
    if (idle !== pausedRef.current) {
      pausedRef.current = idle;
      setPaused(idle);
      if (!idle) gateRef.current.reset();
    }
    if (modeRef.current !== 'bottle' || idle || wantSecondRef.current) return;
    const result = gateRef.current.push(m, now);
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

  const onShutter = () => {
    unlockAudio();
    void onCapture();
  };

  const changeMode = (next: Mode) => {
    if (next === modeRef.current) return;
    commitPending();
    modeRef.current = next;
    setMode(next);
    idleRef.current.touch(performance.now());
    gateRef.current.reset();
  };

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(configRef.current, null, 2));
    } catch {}
  };

  const second = SECOND_PHOTO[mode];
  const counts = {
    done: items.filter((i) => i.status === 'done').length,
    failed: items.filter((i) => i.status === 'failed').length,
  };

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-black text-white"
      onPointerDown={() => idleRef.current.touch(performance.now())}
    >
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
      <canvas ref={detectCanvas} width={DETECT_SIZE} height={DETECT_SIZE} className="hidden" />
      <canvas ref={captureCanvas} className="hidden" />

      {!started && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center">
          <h1 className="text-2xl font-semibold">Perfume spike</h1>
          <p className="max-w-xs text-sm text-neutral-300">
            Bottle auto-captures when steady inside the square. Samples and Set use the shutter and take the full frame.
          </p>
          <button onClick={onStart} className="rounded-full bg-white px-6 py-3 font-semibold text-black">
            Start session
          </button>
        </div>
      )}

      {started && status !== 'live' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black p-6 text-center">
          {status === 'starting' && <p>Starting camera…</p>}
          {status === 'denied' && (
            <>
              <p className="font-semibold">Camera access was blocked.</p>
              <p className="text-sm text-neutral-300">
                On iPhone: Settings → Safari → Camera → Allow (or tap “aA” in the address bar → Website Settings → Camera).
                Then reload.
              </p>
            </>
          )}
          {status === 'unavailable' && (
            <>
              <p className="font-semibold">No usable rear camera found.</p>
              <p className="text-sm text-neutral-300">
                Check Settings → Safari → Camera isn’t set to Deny, and that the page is on HTTPS. {error}
              </p>
            </>
          )}
          {status === 'error' && <p>Camera error: {error}</p>}
          {status !== 'starting' && (
            <button onClick={() => void start()} className="rounded-full bg-white px-5 py-2 text-black">
              Try again
            </button>
          )}
        </div>
      )}

      {/* Square overlay: Bottle only, since the other modes take the full frame. */}
      {mode === 'bottle' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`aspect-square border-4 transition-colors ${
              flash ? 'border-green-400 bg-green-400/30' : gateState === 'steadying' ? 'border-amber-300' : 'border-white/80'
            }`}
            style={{ width: `${SQUARE_FRACTION * 100}vmin`, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.45)' }}
          />
        </div>
      )}
      {mode !== 'bottle' && flash && <div className="pointer-events-none absolute inset-0 bg-green-400/30" />}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex overflow-hidden rounded-full bg-black/60 text-sm">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => changeMode(m.id)}
                className={`px-4 py-1.5 ${mode === m.id ? 'bg-white font-semibold text-black' : ''}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {torch && (
              <button
                onClick={() => {
                  const on = !torchOn;
                  setTorchOn(on);
                  void torch(on);
                }}
                className="rounded bg-black/60 px-3 py-1 text-sm"
              >
                Torch {torchOn ? 'on' : 'off'}
              </button>
            )}
            <button onClick={() => setShowDebug((v) => !v)} className="rounded bg-black/60 px-3 py-1 text-sm">
              Debug
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-300">
          {items.length} captured · {counts.done} done · {counts.failed} failed
        </p>
        {paused && <p className="mt-1 text-sm font-semibold text-amber-300">Paused, tap to resume</p>}
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {second && pendingCount > 0 && (
          <div className="mb-4 flex items-center justify-center gap-3">
            {wantSecond ? (
              <p className="rounded bg-black/70 px-3 py-2 text-sm">{second.hint}</p>
            ) : (
              <button onClick={() => setSecond(true)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
                {second.add}
              </button>
            )}
            <button onClick={commitPending} className="rounded-full bg-black/70 px-4 py-2 text-sm">
              {second.done}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button onClick={() => setShowRecent((v) => !v)} className="rounded bg-black/60 px-3 py-2 text-sm">
            Recent ({items.length})
          </button>
          <button
            onClick={onShutter}
            aria-label="Shutter"
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/60"
          />
          <span className="w-[5.5rem]" />
        </div>
      </div>

      {showDebug && (
        <DebugDrawer metrics={metrics} gateState={gateState} config={config} onChange={updateConfig} onCopy={copyConfig} />
      )}
      {showRecent && <RecentList items={items} onRetry={retry} />}
    </main>
  );
}
