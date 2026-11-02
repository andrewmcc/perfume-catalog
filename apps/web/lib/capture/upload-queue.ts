import type { Mode } from '@perfume/core';

/** One capture moving through upload → register (scans insert) → extract. The scan id is fixed at capture time, so Retry never duplicates. */
export type QueueItem = {
  scanId: string;
  mode: Mode;
  blobs: Blob[];
  uploaded: boolean[];
  registered: boolean;
  stage: 'uploading' | 'registering' | 'extracting' | 'done' | 'failed';
  error?: string;
};

export type Step = { kind: 'upload'; index: number } | { kind: 'register' } | { kind: 'extract' } | { kind: 'none' };

/** Resumes from the first incomplete step. */
export function nextStep(item: QueueItem): Step {
  if (item.stage === 'done') return { kind: 'none' };
  const index = item.uploaded.findIndex((u) => !u);
  if (index !== -1) return { kind: 'upload', index };
  if (!item.registered) return { kind: 'register' };
  return { kind: 'extract' };
}
