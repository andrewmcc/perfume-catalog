import { describe, expect, it } from 'vitest';
import { parseAddMemberArgs } from '../add-member-args';

const USAGE = 'usage: add-member <email> [--collection <id>] [--name <name>]';

describe('parseAddMemberArgs', () => {
  it('parses email with flags', () => {
    expect(parseAddMemberArgs(['a@b.co', '--collection', '800ae73d-bec0-4ae9-811b-bcbc97179b13', '--name', 'Ours'])).toEqual({
      email: 'a@b.co',
      collectionId: '800ae73d-bec0-4ae9-811b-bcbc97179b13',
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
  const ID = '800ae73d-bec0-4ae9-811b-bcbc97179b13';
  it('accepts a uuid collection and --app-url', () => {
    expect(parseAddMemberArgs(['a@b.co', '--collection', ID, '--app-url', 'https://x.test'])).toMatchObject({ collectionId: ID, appUrl: 'https://x.test' });
  });
  it('throws usage when --collection lacks a value or is not a uuid', () => {
    expect(() => parseAddMemberArgs(['a@b.co', '--collection'])).toThrow(USAGE);
    expect(() => parseAddMemberArgs(['a@b.co', '--collection', 'c1'])).toThrow(USAGE);
    expect(() => parseAddMemberArgs(['a@b.co', '--collection', '--name', 'x'])).toThrow(USAGE);
  });
  it('throws usage on unknown flags and extra positionals', () => {
    expect(() => parseAddMemberArgs(['a@b.co', '--bogus', 'x'])).toThrow(USAGE);
    expect(() => parseAddMemberArgs(['a@b.co', 'c@d.co'])).toThrow(USAGE);
  });
});
