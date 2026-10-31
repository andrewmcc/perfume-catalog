const USAGE = 'usage: add-member <email> [--collection <id>] [--name <name>] [--app-url <url>]';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAddMemberArgs(argv: string[]): {
  email: string;
  collectionId?: string;
  collectionName: string;
  appUrl?: string;
} {
  let email: string | undefined;
  let collectionId: string | undefined;
  let appUrl: string | undefined;
  let collectionName = 'Our collection';
  const value = (i: number): string => {
    const v = argv[i];
    if (v === undefined || v.startsWith('--')) throw new Error(USAGE);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--collection') {
      collectionId = value(++i);
      if (!UUID.test(collectionId)) throw new Error(USAGE);
    } else if (a === '--name') collectionName = value(++i);
    else if (a === '--app-url') appUrl = value(++i);
    else if (a.startsWith('--') || email !== undefined) throw new Error(USAGE);
    else email = a;
  }
  if (!email || !EMAIL.test(email)) throw new Error(USAGE);
  return { email, collectionId, collectionName, appUrl };
}
