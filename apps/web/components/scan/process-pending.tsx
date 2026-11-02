'use client';

import { useEffect } from 'react';

/** Re-queues stuck scans on load (no cron on Hobby). Fire and forget. */
export function ProcessPending() {
  useEffect(() => {
    void fetch('/api/scans/process-pending', { method: 'POST' }).catch(() => {});
  }, []);
  return null;
}
