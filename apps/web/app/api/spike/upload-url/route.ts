import { z } from 'zod';
import { Mode } from '@/lib/spike/extract-schema';
import { SPIKE_BUCKET, supabaseAdmin } from '@/lib/spike/supabase-admin';

const Body = z.object({ mode: Mode, photos: z.union([z.literal(1), z.literal(2)]) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'mode (bottle|samples|set) and photos (1|2) required' }, { status: 400 });
  const { mode, photos } = parsed.data;

  const storage = supabaseAdmin().storage.from(SPIKE_BUCKET);
  const captureId = crypto.randomUUID();

  const meta = { mode, photos, createdAt: new Date().toISOString(), userAgent: request.headers.get('user-agent') ?? '' };
  const { error: metaError } = await storage.upload(`${captureId}/meta.json`, JSON.stringify(meta, null, 2), {
    contentType: 'application/json',
  });
  if (metaError) return Response.json({ error: `save meta: ${metaError.message}` }, { status: 502 });

  const uploads: { path: string; token: string }[] = [];
  for (let n = 1; n <= photos; n++) {
    const { data, error } = await storage.createSignedUploadUrl(`${captureId}/photo-${n}.jpg`);
    if (error || !data) return Response.json({ error: `signed url: ${error?.message ?? 'missing'}` }, { status: 502 });
    uploads.push({ path: data.path, token: data.token });
  }
  return Response.json({ captureId, uploads });
}
