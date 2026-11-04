export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

export type CameraDeps = {
  getUserMedia: () => Promise<MediaStream>;
  /** Put the stream on the video element (null clears it) and play. */
  attach: (stream: MediaStream | null) => Promise<void>;
  onStatus: (status: CameraStatus, error?: string) => void;
  onTorch: (supported: boolean) => void;
  now: () => number;
};

const REOPEN_WINDOW_MS = 5000;

/**
 * The camera's lifecycle. iOS stops or blanks the camera when the app goes to the background and
 * doesn't give it back on return, so we let go of it on hide and open a fresh stream on show.
 * Every start bumps a generation; a stream that arrives for an older generation is stopped unseen.
 */
export function createCameraSession(deps: CameraDeps) {
  let stream: MediaStream | null = null;
  let wanted = false;
  let suspended = false;
  let gen = 0;
  let lastReopen = -Infinity;

  const release = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void deps.attach(null);
  };

  async function start(): Promise<void> {
    wanted = true;
    suspended = false;
    const mine = ++gen;
    release();
    deps.onStatus('starting');
    let s: MediaStream;
    try {
      s = await deps.getUserMedia();
    } catch (e) {
      if (mine !== gen) return;
      const err = e as DOMException;
      const status = err.name === 'NotAllowedError' ? 'denied' : err.name === 'NotFoundError' || err.name === 'OverconstrainedError' ? 'unavailable' : 'error';
      deps.onStatus(status, `${err.name}: ${err.message}`);
      return;
    }
    if (mine !== gen) {
      s.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = s;
    const track = s.getVideoTracks()[0];
    track?.addEventListener('ended', () => {
      // Ours (suspend/stop/restart) bump gen first; only a system-ended current track gets here.
      if (mine !== gen || !wanted) return;
      const now = deps.now();
      if (now - lastReopen < REOPEN_WINDOW_MS) {
        deps.onStatus('error', 'The camera stopped. Tap Try again.');
        return;
      }
      lastReopen = now;
      void start();
    });
    try {
      await deps.attach(s);
    } catch {
      // play() can reject if interrupted by a newer attach; the newer one wins.
    }
    if (mine !== gen) return;
    const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
    deps.onTorch(Boolean(caps.torch));
    deps.onStatus('live');
  }

  return {
    start,
    /** Page hidden: let go of the camera (keeps the wish to have it). */
    suspend() {
      if (!wanted || suspended) return;
      suspended = true;
      gen++;
      release();
      deps.onStatus('starting');
    },
    /** Page shown again: reopen if the camera was let go on hide (visibilitychange and pageshow both call this). */
    async resume() {
      if (wanted && suspended) await start();
    },
    /** Leaving the scanner. */
    stop() {
      wanted = false;
      gen++;
      release();
    },
    track: () => stream?.getVideoTracks()[0] ?? null,
  };
}
