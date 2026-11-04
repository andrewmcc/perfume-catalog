import type { createServerClient } from '@perfume/supabase';

type Client = Pick<ReturnType<typeof createServerClient>, 'storage'>;
export type Variant = 'preview' | 'thumb';

/** Long edges of the sizes uploaded beside each scan photo. */
export const VARIANT_EDGE: Record<Variant, number> = { preview: 1024, thumb: 240 };
const TTL_S = 3600;

/** `{c}/{scan}/photo-n.jpg` → `{c}/{scan}/preview-n.jpg` (or thumb-n). Null for anything else. */
export function variantPath(path: string, variant: Variant): string | null {
  return /\/photo-\d+\.jpg$/.test(path) ? path.replace(/\/photo-(\d+)\.jpg$/, `/${variant}-$1.jpg`) : null;
}

async function sign(supabase: Client, paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const { data, error } = await supabase.storage.from('photos').createSignedUrls(paths, TTL_S);
  if (error) throw error;
  return new Map(data.flatMap((d) => (d.signedUrl && d.path && !d.error ? [[d.path, d.signedUrl] as const] : [])));
}

/**
 * Signed URLs for showing photos at a smaller size: original path → URL of its variant,
 * or of the original itself when no variant was stored (older scans, a failed best-effort upload).
 */
export async function signDisplay(supabase: Client, paths: (string | null | undefined)[], variant: Variant): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const wanted = new Map(
    unique.flatMap((p) => {
      const v = variantPath(p, variant);
      return v ? [[p, v] as const] : [];
    }),
  );
  const small = await sign(supabase, [...wanted.values()]);
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const p of unique) {
    const url = small.get(wanted.get(p) ?? '');
    if (url) out.set(p, url);
    else missing.push(p);
  }
  for (const [p, url] of await sign(supabase, missing)) out.set(p, url);
  return out;
}
