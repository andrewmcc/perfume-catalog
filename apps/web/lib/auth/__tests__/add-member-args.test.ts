import { describe, expect, it } from 'vitest';
import { parseAddMemberArgs } from '../add-member-args';

const USAGE = 'usage: add-member <email> [--collection <id>] [--name <name>]';

describe('parseAddMemberArgs', () => {
  it('parses email with flags', () => {
    expect(parseAddMemberArgs(['a@b.co', '--collection', 'c1', '--name', 'Ours'])).toEqual({
      email: 'a@b.co',
      collectionId: 'c1',
      collectionName: 'Ours',
    });
  });
  it('defaults the collection name', () => {
    expect(parseAddMemberArgs(['a@b.co'])).toEqual({ email: 'a@b.co', collectionId: undefined, collectionName: 'Our collection' });
  });
  it('throws usage on missing email', () => {
    expect(() => parseAddMemberArgs([])).toThrow(USAGE);
    expect(() => parseAddMemberArgs(['--name', 'x'])).toThrow(USAGE);
  });
  it('throws usage on an invalid email', () => {
    expect(() => parseAddMemberArgs(['not-an-email'])).toThrow(USAGE);
  });
});
