import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { extractCapture } from '@/lib/spike/extract';
import { Mode } from '@/lib/spike/extract-schema';
import { SPIKE_BUCKET, supabaseAdmin } from '@/lib/spike/supabase-admin';

export const maxDuration = 120;

const Meta = z.object({ mode: Mode, photos: z.number().int().min(1).max(2) });

export async function POST(request: Request) {
  const { captureId } = (await request.json().catch(() => ({}))) as { captureId?: string };
  if (!captureId || !/^[0-9a-f-]{36}$/.test(captureId)) return Response.json({ error: 'captureId required' }, { status: 400 });

  const storage = supabaseAdmin().storage.from(SPIKE_BUCKET);
  const notFound = () => Response.json({ error: 'unknown captureId' }, { status: 404 });

  const metaFile = await storage.download(`${captureId}/meta.json`);
  if (metaFile.error || !metaFile.data) return notFound();
  const meta = Meta.safeParse(JSON.parse(await metaFile.data.text()));
  if (!meta.success) return Response.json({ error: 'bad meta.json' }, { status: 502 });
  const { mode, photos: count } = meta.data;

  const photos: string[] = [];
  for (let n = 1; n <= count; n++) {
    const { data, error } = await storage.download(`${captureId}/photo-${n}.jpg`);
    if (error || !data) return Response.json({ error: `photo-${n}.jpg not uploaded` }, { status: 404 });
    photos.push(Buffer.from(await data.arrayBuffer()).toString('base64'));
  }

  const started = Date.now();
  let result;
  try {
    result = await extractCapture(new Anthropic(), mode, photos);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
  const body = { mode, result, ms: Date.now() - started };

  const { error: saveError } = await storage.upload(`${captureId}/extraction.json`, JSON.stringify(body, null, 2), {
    contentType: 'application/json',
    upsert: true,
  });
  if (saveError) return Response.json({ error: `save extraction: ${saveError.message}` }, { status: 502 });

  return Response.json(body);
}
