import { describe, expect, it } from 'vitest';
import { createCameraSession, type CameraStatus } from '../camera-session';

/** A fake track/stream pair that records stop() and lets the test fire 'ended'. */
function fakeStream(id: number) {
  const listeners: Record<string, (() => void)[]> = {};
  const track = {
    id,
    readyState: 'live' as 'live' | 'ended',
    stopped: false,
    stop() {
      this.stopped = true;
      this.readyState = 'ended';
    },
    addEventListener(type: string, fn: () => void) {
      (listeners[type] ??= []).push(fn);
    },
    getCapabilities: () => ({}),
    fire(type: string) {
      for (const fn of listeners[type] ?? []) fn();
    },
  };
  const stream = { id, getTracks: () => [track], getVideoTracks: () => [track] };
  return { stream: stream as unknown as MediaStream, track };
}

function setup() {
  const made: ReturnType<typeof fakeStream>[] = [];
  const attached: (number | null)[] = [];
  const statuses: CameraStatus[] = [];
  let pending: ((s: MediaStream) => void) | null = null;
  let manual = false;
  const session = createCameraSession({
    getUserMedia: () => {
      const s = fakeStream(made.length + 1);
      made.push(s);
      if (manual) return new Promise((r) => (pending = () => r(s.stream)));
      return Promise.resolve(s.stream);
    },
    attach: async (s) => {
      attached.push(s ? (s as unknown as { id: number }).id : null);
    },
    onStatus: (s) => statuses.push(s),
    onTorch: () => {},
    now: () => 0,
  });
  return {
    session,
    made,
    attached,
    statuses,
    holdNext: () => (manual = true),
    release: () => {
      manual = false;
      pending?.(null as never);
    },
  };
}

describe('createCameraSession', () => {
  it('starts: attaches a live stream', async () => {
    const t = setup();
    await t.session.start();
    expect(t.attached.at(-1)).toBe(1);
    expect(t.statuses.at(-1)).toBe('live');
  });

  it('going to the background stops the camera; coming back opens a fresh stream (no black viewfinder)', async () => {
    const t = setup();
    await t.session.start();
    t.session.suspend();
    expect(t.made[0]!.track.stopped).toBe(true);
    expect(t.attached.at(-1)).toBe(null);
    await t.session.resume();
    expect(t.made).toHaveLength(2);
    expect(t.attached.at(-1)).toBe(2);
    expect(t.statuses.at(-1)).toBe('live');
  });

  it('a stream that arrives after the page was hidden is stopped, not shown', async () => {
    const t = setup();
    t.holdNext();
    const starting = t.session.start();
    t.session.suspend();
    t.release();
    await starting;
    expect(t.made[0]!.track.stopped).toBe(true);
    expect(t.attached).not.toContain(1);
  });

  it('resume does nothing before the camera was opened, or after it was closed', async () => {
    const t = setup();
    await t.session.resume();
    expect(t.made).toHaveLength(0);
    await t.session.start();
    t.session.stop();
    await t.session.resume();
    expect(t.made).toHaveLength(1);
  });

  it('a track the system ends while visible is reopened once', async () => {
    const t = setup();
    await t.session.start();
    t.made[0]!.track.fire('ended');
    await Promise.resolve();
    await Promise.resolve();
    expect(t.made).toHaveLength(2);
    expect(t.attached.at(-1)).toBe(2);
  });

  it('stopping our own track (suspend) does not trigger a reopen', async () => {
    const t = setup();
    await t.session.start();
    t.session.suspend();
    t.made[0]!.track.fire('ended');
    await Promise.resolve();
    expect(t.made).toHaveLength(1);
  });
});

describe('createCameraSession resume', () => {
  it('opens one stream when both visibilitychange and pageshow report the return', async () => {
    const t = setup();
    await t.session.start();
    t.session.suspend();
    await Promise.all([t.session.resume(), t.session.resume()]);
    expect(t.made).toHaveLength(2);
  });

  it('resume without a suspend leaves the live stream alone', async () => {
    const t = setup();
    await t.session.start();
    await t.session.resume();
    expect(t.made).toHaveLength(1);
  });
});
