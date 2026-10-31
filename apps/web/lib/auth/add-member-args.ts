const USAGE = 'usage: add-member <email> [--collection <id>] [--name <name>]';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAddMemberArgs(argv: string[]): { email: string; collectionId?: string; collectionName: string } {
  let email: string | undefined;
  let collectionId: string | undefined;
  let collectionName = 'Our collection';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--collection') collectionId = argv[++i];
    else if (a === '--name') collectionName = argv[++i] ?? collectionName;
    else if (!a.startsWith('--') && email === undefined) email = a;
  }
  if (!email || !EMAIL.test(email)) throw new Error(USAGE);
  return { email, collectionId, collectionName };
}
