type Ext = { set_house?: string | null; set_name?: string | null };

const clean = (v: unknown, max: number): string | null | undefined => (typeof v === 'string' ? v.trim().slice(0, max) || null : undefined);

/**
 * The set's house and name for a lookup: what the reviewer typed (body), else what was read
 * from the box. `changed` says the typed values differ from the read and should be saved.
 */
export function setIdentity(ext: Ext, body: unknown): { house: string | null; name: string | null; changed: boolean } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const typedHouse = clean(b.set_house, 80);
  const typedName = clean(b.set_name, 120);
  const house = typedHouse !== undefined ? typedHouse : (ext.set_house?.trim() || null);
  const name = typedName !== undefined ? typedName : (ext.set_name?.trim() || null);
  return { house, name, changed: house !== (ext.set_house?.trim() || null) || name !== (ext.set_name?.trim() || null) };
}
