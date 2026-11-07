import { describe, expect, it } from 'vitest';
import { setIdentity } from '../set-identity';

describe('setIdentity', () => {
  it('the reviewer’s corrected house and name win over the box read', () => {
    expect(setIdentity({ set_house: 'Houbigant', set_name: 'Icons Collection No. 2' }, { set_house: ' Perfumer H ', set_name: '' })).toEqual({ house: 'Perfumer H', name: null, changed: true });
  });
  it('falls back to the box read when nothing is sent', () => {
    expect(setIdentity({ set_house: 'Amouage', set_name: 'Odyssey' }, null)).toEqual({ house: 'Amouage', name: 'Odyssey', changed: false });
  });
  it('unchanged values are not a change; non-strings are ignored; long values are cut', () => {
    expect(setIdentity({ set_house: 'Amouage', set_name: 'Odyssey' }, { set_house: 'Amouage', set_name: 'Odyssey' }).changed).toBe(false);
    expect(setIdentity({ set_house: 'A', set_name: null }, { set_house: 7, set_name: ['x'] })).toEqual({ house: 'A', name: null, changed: false });
    expect(setIdentity({}, { set_house: 'x'.repeat(200) }).house).toHaveLength(80);
  });
  it('no house anywhere gives null', () => {
    expect(setIdentity({ set_house: null }, { set_house: '  ' }).house).toBeNull();
  });
});
