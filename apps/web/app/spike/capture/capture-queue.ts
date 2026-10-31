'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { BottleResult, Mode, SamplesResult, SetResult } from '@/lib/spike/extract-schema';

const BUCKET = 'perfume-spike-captures';

export type CaptureStatus = 'uploading' | 'extracting' | 'done' | 'failed';
export type CaptureResult = BottleResult | SamplesResult | SetResult;

export type QueuedCapture = {
  localId: string;
  mode: Mode;
  /** Kept in memory until the capture is done, so Retry can re-send them. */
  blobs: Blob[];
  thumb: string;
  status: CaptureStatus;
  /** Set once every photo is uploaded; Retry then skips straight to extraction. */
  captureId?: string;
  result?: CaptureResult;
  ms?: number;
  error?: string;
};

const THUMB_EDGE = 240;

/** Small JPEG object URL, so the list never holds a full-size photo just for a thumbnail. */
async function makeThumb(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, THUMB_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const small = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.7));
  return small ? URL.createObjectURL(small) : '';
}

async function errorFrom(res: Response, label: string): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error(body.error ?? `${label} ${res.status}`);
}

export function useCaptureQueue(supabaseUrl: string, supabaseAnonKey: string) {
  const [items, setItems] = useState<QueuedCapture[]>([]);
  const thumbUrls = useRef<string[]>([]);
  useEffect(() => () => thumbUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);

  const patch = (localId: string, p: Partial<QueuedCapture>) =>
    setItems((xs) => xs.map((x) => (x.localId === localId ? { ...x, ...p } : x)));

  /** Runs from the first step that hasn't completed: upload (if no captureId yet), then extract. */
  const run = useCallback(
    async (item: QueuedCapture) => {
      const id = item.localId;
      let captureId = item.captureId;
      try {
        if (!captureId) {
          patch(id, { status: 'uploading', error: undefined });
          const res = await fetch('/api/spike/upload-url', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: item.mode, photos: item.blobs.length }),
          });
          if (!res.ok) throw await errorFrom(res, 'upload-url');
          const body = (await res.json()) as { captureId: string; uploads: { path: string; token: string }[] };
          for (const [i, u] of body.uploads.entries()) {
            const { error } = await supabase.storage
              .from(BUCKET)
              .uploadToSignedUrl(u.path, u.token, item.blobs[i], { contentType: 'image/jpeg' });
            if (error) throw new Error(`upload: ${error.message}`);
          }
          captureId = body.captureId;
          patch(id, { captureId });
        }
        patch(id, { status: 'extracting', error: undefined });
        const res = await fetch('/api/spike/extract', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ captureId }),
        });
        if (!res.ok) throw await errorFrom(res, 'extract');
        const body = (await res.json()) as { result: CaptureResult; ms: number };
        patch(id, { status: 'done', result: body.result, ms: body.ms, blobs: [] });
      } catch (e) {
        patch(id, { status: 'failed', error: e instanceof Error ? e.message : String(e) });
      }
    },
    [supabase],
  );

  const enqueue = useCallback(
    (mode: Mode, blobs: Blob[]) => {
      const item: QueuedCapture = {
        localId: crypto.randomUUID(),
        mode,
        blobs,
        thumb: '',
        status: 'uploading',
      };
      setItems((xs) => [item, ...xs]);
      void run(item);
      makeThumb(blobs[0])
        .then((url) => {
          thumbUrls.current.push(url);
          patch(item.localId, { thumb: url });
        })
        .catch(() => {});
    },
    [run],
  );

  const retry = useCallback((item: QueuedCapture) => void run(item), [run]);

  return { items, enqueue, retry };
}
