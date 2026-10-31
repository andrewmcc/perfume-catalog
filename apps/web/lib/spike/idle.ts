/** Tracks time since the last capture or tap; auto-capture pauses once idle. */
export function createIdleTimer(timeoutMs: number) {
  let last = 0;
  return {
    touch(now: number) {
      last = now;
    },
    isIdle(now: number) {
      return now - last >= timeoutMs;
    },
  };
}
