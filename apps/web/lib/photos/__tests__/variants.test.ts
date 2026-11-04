import { describe, expect, it } from 'vitest';
import { signDisplay, variantPath } from '../variants';

describe('variantPath', () => {
  it('maps a scan photo to its preview and thumbnail', () => {
    expect(variantPath('c/s/photo-2.jpg', 'preview')).toBe('c/s/preview-2.jpg');
    expect(variantPath('c/s/photo-1.jpg', 'thumb')).toBe('c/s/thumb-1.jpg');
  });

  it('returns null for paths that are not scan photos', () => {
    expect(variantPath('c/s/thumb-1.jpg', 'preview')).toBe(null);
    expect(variantPath('c/s/other.jpg', 'preview')).toBe(null);
  });
});

describe('signDisplay', () => {
  /** Stub storage: only the listed paths exist; records each createSignedUrls call. */
  function stub(existing: string[]) {
    const calls: string[][] = [];
    const client = {
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => {
            calls.push(paths);
            return {
              data: paths.map((p) => (existing.includes(p) ? { path: p, signedUrl: `https://x/${p}`, error: null } : { path: p, signedUrl: null, error: 'Object not found' })),
              error: null,
            };
          },
        }),
      },
    };
    return { client: client as unknown as Parameters<typeof signDisplay>[0], calls };
  }

  it('signs the preview where it exists and falls back to the full photo where it does not', async () => {
    const { client, calls } = stub(['c/a/preview-1.jpg', 'c/b/photo-1.jpg']);
    const urls = await signDisplay(client, ['c/a/photo-1.jpg', 'c/b/photo-1.jpg'], 'preview');
    expect(urls.get('c/a/photo-1.jpg')).toBe('https://x/c/a/preview-1.jpg');
    expect(urls.get('c/b/photo-1.jpg')).toBe('https://x/c/b/photo-1.jpg');
    expect(calls).toEqual([['c/a/preview-1.jpg', 'c/b/preview-1.jpg'], ['c/b/photo-1.jpg']]);
  });

  it('makes one call when every preview exists', async () => {
    const { client, calls } = stub(['c/a/preview-1.jpg']);
    await signDisplay(client, ['c/a/photo-1.jpg'], 'preview');
    expect(calls).toHaveLength(1);
  });
});
