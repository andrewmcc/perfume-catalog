import { describe, expect, it, vi } from 'vitest';
import { loadCollection } from '../load';

const perfume = { id: 'p1', house: 'H', name: 'N', sources: {}, concentration: null, flanker: null, family: null, subfamily: null, accords: [], notes_top: [], notes_heart: [], notes_base: ['vanilla'], longevity: null, sillage: null, seasons: [], times_of_day: [], occasions: [], perfumers: [], release_year: null };
const item = { id: 'i1', perfume_id: 'p1', format: 'full', size_ml: 50, status: 'owned', set_id: null, wish_reason: null, overrides: {}, updated_at: '', created_at: '', perfumes: perfume, sets: null, item_photos: [{ storage_path: 'c/s/photo-1.jpg', thumb_path: 'c/s/thumb-1.jpg', position: 0 }] };

function stub() {
  const result = (data: unknown) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.order = () => q;
    q.then = (res: (v: unknown) => void) => res({ data, error: null });
    return q;
  };
  const tables: Record<string, unknown> = { items: [item], sets: [], wears: [] };
  const createSignedUrls = vi.fn(async () => ({ data: [{ path: 'c/s/thumb-1.jpg', signedUrl: 'https://signed' }], error: null }));
  const client = { from: (t: string) => result(tables[t]), storage: { from: () => ({ createSignedUrls }) } };
  return { client: client as never, createSignedUrls };
}

describe('loadCollection thumbs option', () => {
  it('signs thumbnails by default', async () => {
    const { client, createSignedUrls } = stub();
    const { rows } = await loadCollection(client);
    expect(rows[0]!.thumb).toBe('https://signed');
    expect(createSignedUrls).toHaveBeenCalledOnce();
  });
  it('{ thumbs: false } skips storage entirely', async () => {
    const { client, createSignedUrls } = stub();
    const { rows } = await loadCollection(client, { thumbs: false });
    expect(rows[0]!.thumb).toBeNull();
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});

describe('loadCollection without a recorded thumbnail', () => {
  it('uses the stored thumb-n beside the photo instead of the full-size photo', async () => {
    const noThumb = { ...item, item_photos: [{ storage_path: 'c/s/photo-1.jpg', thumb_path: null, position: 0 }] };
    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((p) => (p === 'c/s/thumb-1.jpg' ? { path: p, signedUrl: 'https://thumb', error: null } : { path: p, signedUrl: null, error: 'Object not found' })),
      error: null,
    }));
    const q = (data: unknown) => {
      const r: Record<string, unknown> = {};
      r.select = () => r;
      r.order = () => r;
      r.then = (res: (v: unknown) => void) => res({ data, error: null });
      return r;
    };
    const tables: Record<string, unknown> = { items: [noThumb], sets: [], wears: [] };
    const client = { from: (t: string) => q(tables[t]), storage: { from: () => ({ createSignedUrls }) } };
    const { rows } = await loadCollection(client as never);
    expect(rows[0]!.thumb).toBe('https://thumb');
  });
});
