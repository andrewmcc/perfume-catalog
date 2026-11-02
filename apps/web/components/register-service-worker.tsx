'use client';

import { useEffect } from 'react';

/** Registers /sw.js (offline fallback only) in production; dev servers would fight with a worker. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((e) => {
      console.warn('service worker registration failed', e);
    });
  }, []);
  return null;
}
