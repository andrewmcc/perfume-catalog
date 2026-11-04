'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@perfume/supabase';
import type { ExtractionResult, Mode } from '@perfume/core';
import { nextStep, type QueueItem } from '@/lib/capture/upload-queue';
import { VARIANT_EDGE } from '@/lib/photos/variants';

export type ScanItem = QueueItem & {
  thumb: string;
  /** Server status once registered: uploaded | processing | extracted | failed | discarded. */
  serverStatus?: string;
  result?: ExtractionResult;
};

const POLL_MS = 3000;
const SETTLED = new Set(['extracted', 'failed', 'discarded', 'reviewed']);

/** A smaller JPEG (q 0.8) of a photo, long edge at most `edge`. JPEG because iOS Safari's canvas can't encode WebP. */
export async function toThumb(blob: Blob, edge: number = VARIANT_EDGE.thumb): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const small = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
  if (!small) throw new Error('thumbnail failed');
  return small;
}

/** Small JPEG object URL, so the list never holds a full-size photo just for a thumbnail. */
async function makeThumb(blob: Blob): Promise<string> {
  return URL.createObjectURL(await toThumb(blob));
}

/**
 * This visit's captures: upload each photo to photos/{collection}/{scan}/photo-n.jpg, insert the scans row,
 * then ask the server to extract. Every step is resumable; Retry reuses the same scan id.
 */
export function useScanQueue(collectionId: string, userId: string) {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [items, setItems] = useState<ScanItem[]>([]);
  const itemsRef = useRef<ScanItem[]>([]);
  itemsRef.current = items;
  const thumbUrls = useRef<string[]>([]);
  useEffect(() => () => thumbUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const patch = useCallback((scanId: string, p: Partial<ScanItem>) => {
    setItems((xs) => xs.map((x) => (x.scanId === scanId ? { ...x, ...p } : x)));
  }, []);

  const run = useCallback(
    async (start: ScanItem) => {
      const item: ScanItem = { ...start, error: undefined };
      const path = (n: number) => `${collectionId}/${item.scanId}/photo-${n + 1}.jpg`;
      try {
        for (let step = nextStep(item); step.kind !== 'none'; step = nextStep(item)) {
          if (step.kind === 'upload') {
            patch(item.scanId, { stage: 'uploading', error: undefined });
            const { error } = await supabase.storage
              .from('photos')
              .upload(path(step.index), item.blobs[step.index]!, { contentType: 'image/jpeg' });
            // "Already exists": a previous attempt's upload landed but its response was lost. No update policy, so no upsert.
            if (error && !/already exists/i.test(error.message)) throw new Error(`Upload failed: ${error.message}`);
            // Thumbnail (lists) and preview (Review, perfume page): best effort, never fail the capture.
            const n = step.index + 1;
            const blob = item.blobs[step.index]!;
            await Promise.all(
              (['thumb', 'preview'] as const).map((v) =>
                toThumb(blob, VARIANT_EDGE[v])
                  .then((t) => supabase.storage.from('photos').upload(`${collectionId}/${item.scanId}/${v}-${n}.jpg`, t, { contentType: 'image/jpeg' }))
                  .catch(() => {}),
              ),
            );
            item.uploaded = item.uploaded.map((u, i) => u || i === step.index);
            patch(item.scanId, { uploaded: item.uploaded });
          } else if (step.kind === 'register') {
            patch(item.scanId, { stage: 'registering' });
            const { error } = await supabase.from('scans').insert({
              id: item.scanId,
              collection_id: collectionId,
              created_by: userId,
              mode: item.mode,
              photo_paths: item.blobs.map((_, i) => path(i)),
            });
            // 23505: a previous attempt's insert landed but its response was lost.
            if (error && error.code !== '23505') throw new Error(`Couldn't save the scan: ${error.message}`);
            item.registered = true;
            patch(item.scanId, { registered: true });
          } else {
            patch(item.scanId, { stage: 'extracting' });
            const res = await fetch(`/api/scans/${item.scanId}/extract`, { method: 'POST' });
            if (!res.ok) throw new Error(`Couldn't start reading (${res.status})`);
            item.stage = 'done';
            // Photos are on the server now; drop them from memory. Polling fills in the result.
            patch(item.scanId, { stage: 'done', blobs: [], serverStatus: 'processing' });
          }
        }
      } catch (e) {
        patch(item.scanId, { stage: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    },
    [collectionId, userId, patch, supabase],
  );

  const enqueue = useCallback(
    (mode: Mode, blobs: Blob[]): string => {
      const item: ScanItem = {
        scanId: crypto.randomUUID(),
        mode,
        blobs,
        uploaded: blobs.map(() => false),
        registered: false,
        stage: 'uploading',
        thumb: '',
      };
      setItems((xs) => [item, ...xs]);
      void run(item);
      makeThumb(blobs[0]!)
        .then((url) => {
          thumbUrls.current.push(url);
          patch(item.scanId, { thumb: url });
        })
        .catch(() => {});
      return item.scanId;
    },
    [run, patch],
  );

  /** Failed locally: resume the queue. Failed on the server: ask it to extract again. */
  const retry = useCallback(
    (item: ScanItem) => {
      if (item.stage === 'failed') return void run(item);
      patch(item.scanId, { stage: 'extracting', serverStatus: 'processing', error: undefined });
      void run({ ...item, stage: 'extracting' });
    },
    [run, patch],
  );

  // Poll this visit's registered scans every 3 s while any are still being read.
  const waiting = items.filter((i) => i.stage === 'done' && !SETTLED.has(i.serverStatus ?? '')).map((i) => i.scanId);
  const waitingKey = waiting.join(',');
  useEffect(() => {
    if (!waitingKey) return;
    const ids = waitingKey.split(',');
    const id = setInterval(async () => {
      const { data } = await supabase.from('scans').select('id, status, extraction, error').in('id', ids);
      for (const row of data ?? []) {
        if (!SETTLED.has(row.status)) continue;
        patch(row.id, {
          serverStatus: row.status,
          result: (row.extraction ?? undefined) as ExtractionResult | undefined,
          error: row.status === 'failed' ? (row.error ?? 'Reading failed') : undefined,
        });
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waitingKey, supabase, patch]);

  return { items, enqueue, retry };
}
