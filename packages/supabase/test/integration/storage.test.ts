import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  admin, createTestCollection, createTestUser, deleteTestCollection, deleteTestUser, hasCredentials, removeStoragePrefix, type Client,
} from './helpers';

// Minimal valid JPEG (SOI + EOI); content is irrelevant to the bucket policies.
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

describe.skipIf(!hasCredentials)('photos bucket', () => {
  let A: { id: string; client: Client }, B: typeof A, C: typeof A;
  let CA: string, CB: string;
  let path: string;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()]);
    CA = await createTestCollection([A.id, C.id]);
    CB = await createTestCollection([B.id]);
    path = `${CA}/${crypto.randomUUID()}/photo-1.jpg`;
    const up = await A.client.storage.from('photos').upload(path, jpeg(), { contentType: 'image/jpeg' });
    expect(up.error).toBeNull();
  });

  afterAll(async () => {
    for (const c of [CA, CB]) if (c) await removeStoragePrefix(c);
    if (CA) await deleteTestCollection(CA);
    if (CB) await deleteTestCollection(CB);
    await Promise.all([A, B, C].filter(Boolean).map((u) => deleteTestUser(u.id)));
  });

  it("B cannot download A's object", async () => {
    const r = await B.client.storage.from('photos').download(path);
    expect(r.error).not.toBeNull();
    expect(r.data).toBeNull();
  });

  it("B listing CA's prefix returns nothing", async () => {
    const dir = path.split('/').slice(0, 2).join('/');
    const top = await B.client.storage.from('photos').list(CA);
    expect(top.data ?? []).toEqual([]);
    const sub = await B.client.storage.from('photos').list(dir);
    expect(sub.data ?? []).toEqual([]);
  });

  it("B cannot upload into CA's prefix", async () => {
    const r = await B.client.storage.from('photos').upload(`${CA}/${crypto.randomUUID()}/evil.jpg`, jpeg(), { contentType: 'image/jpeg' });
    expect(r.error).not.toBeNull();
  });

  it('C (other member of CA) can download it', async () => {
    const r = await C.client.storage.from('photos').download(path);
    expect(r.error).toBeNull();
    expect(r.data).not.toBeNull();
  });

  it("uploading a text/plain object to the user's own collection prefix is rejected", async () => {
    const r = await A.client.storage
      .from('photos')
      .upload(`${CA}/${crypto.randomUUID()}/note.txt`, new Blob(['hi'], { type: 'text/plain' }), { contentType: 'text/plain' });
    expect(r.error).not.toBeNull();
  });

  it('bucket is private with size and mime limits', async () => {
    const { data } = await admin().storage.getBucket('photos');
    expect(data?.public).toBe(false);
    expect(data?.file_size_limit).toBe(10485760);
    expect(data?.allowed_mime_types).toEqual(['image/jpeg', 'image/webp']);
  });
});
