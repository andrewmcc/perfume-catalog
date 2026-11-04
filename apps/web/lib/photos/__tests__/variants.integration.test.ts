import { afterAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { signDisplay } from '../variants';

// Hosted storage: a preview that was never uploaded must fall back to the full photo, not throw or vanish.
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const dir = `00000000-0000-0000-0000-000000000000/${crypto.randomUUID()}`;
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

afterAll(async () => {
  await admin.storage.from('photos').remove([`${dir}/photo-1.jpg`, `${dir}/photo-2.jpg`, `${dir}/preview-1.jpg`]);
});

describe('signDisplay on real storage', () => {
  it('uses the preview where stored and the original where not', async () => {
    for (const n of ['photo-1', 'photo-2', 'preview-1']) {
      const { error } = await admin.storage.from('photos').upload(`${dir}/${n}.jpg`, jpeg());
      expect(error).toBeNull();
    }
    const urls = await signDisplay(admin as never, [`${dir}/photo-1.jpg`, `${dir}/photo-2.jpg`], 'preview');
    expect(urls.get(`${dir}/photo-1.jpg`)).toContain('preview-1.jpg');
    expect(urls.get(`${dir}/photo-2.jpg`)).toContain('photo-2.jpg');
  });
});
