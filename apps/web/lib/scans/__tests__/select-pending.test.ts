import { describe, expect, it } from 'vitest';
import { pathsOk, selectPending } from '../pending';

const now = new Date('2026-11-02T12:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

describe('selectPending', () => {
  it('keeps stuck rows only, oldest first', () => {
    const rows = [
      { id: 'fresh-upload', status: 'uploaded', updated_at: ago(1) },
      { id: 'stuck-upload', status: 'uploaded', updated_at: ago(5) },
      { id: 'live-processing', status: 'processing', updated_at: ago(9) },
      { id: 'dead-processing', status: 'processing', updated_at: ago(30) },
      { id: 'failed', status: 'failed', updated_at: ago(60) },
      { id: 'done', status: 'extracted', updated_at: ago(60) },
    ];
    expect(selectPending(rows, now).map((r) => r.id)).toEqual(['dead-processing', 'stuck-upload']);
  });

  it('caps at 20', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i), status: 'uploaded', updated_at: ago(10 + i) }));
    const picked = selectPending(rows, now);
    expect(picked).toHaveLength(20);
    expect(picked[0]!.id).toBe('29');
  });
});

describe('pathsOk', () => {
  const ca = '11111111-1111-4111-8111-111111111111';
  const cb = '22222222-2222-4222-8222-222222222222';
  const sid = '33333333-3333-4333-8333-333333333333';
  it('accepts one or two photos under the scan prefix', () => {
    expect(pathsOk(ca, sid, [`${ca}/${sid}/photo-1.jpg`])).toBe(true);
    expect(pathsOk(ca, sid, [`${ca}/${sid}/photo-1.jpg`, `${ca}/${sid}/photo-2.jpg`])).toBe(true);
  });
  it('refuses another collection', () => {
    expect(pathsOk(ca, sid, [`${cb}/${sid}/photo-1.jpg`])).toBe(false);
  });
  it('refuses traversal', () => {
    expect(pathsOk(ca, sid, [`${ca}/${sid}/../x`])).toBe(false);
    expect(pathsOk(ca, sid, [`${ca}/${sid}/../../${cb}/x/photo-1.jpg`])).toBe(false);
  });
  it('refuses a third element and an empty list', () => {
    expect(pathsOk(ca, sid, [`${ca}/${sid}/photo-1.jpg`, `${ca}/${sid}/photo-2.jpg`, `${ca}/${sid}/photo-1.jpg`])).toBe(false);
    expect(pathsOk(ca, sid, [])).toBe(false);
  });
});
