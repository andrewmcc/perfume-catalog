import { describe, expect, it, vi } from 'vitest';
import { getCurrentCollectionId } from '../current';

function stub(sub: string | null) {
  const getUser = vi.fn();
  const query = { select: () => query, eq: vi.fn(() => query), order: () => query, limit: () => query, maybeSingle: async () => ({ data: { collection_id: 'c1' }, error: null }) };
  const client = {
    auth: { getClaims: async () => ({ data: sub ? { claims: { sub } } : null, error: null }), getUser },
    from: vi.fn(() => query),
  };
  return { client: client as never, getUser, query };
}

describe('getCurrentCollectionId', () => {
  it('reads the user from verified claims, not a getUser round trip', async () => {
    const { client, getUser, query } = stub('u1');
    expect(await getCurrentCollectionId(client)).toBe('c1');
    expect(getUser).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u1');
  });
  it('null when there are no claims', async () => {
    expect(await getCurrentCollectionId(stub(null).client)).toBeNull();
  });
});
