// Home-screen web apps on iOS don't share Safari's cookies, so the standalone
// app unlocks here too. POST keeps the passcode out of URLs and logs.
import { Suspense } from 'react';

async function WrongPasscode({ searchParams }: Pick<PageProps<'/spike/unlock'>, 'searchParams'>) {
  const { error } = await searchParams;
  return error ? <p className="text-sm text-red-600">Wrong passcode.</p> : null;
}

export default function UnlockPage({ searchParams }: PageProps<'/spike/unlock'>) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action="/spike/unlock/submit" method="post" className="flex w-full max-w-xs flex-col gap-3">
        <label htmlFor="passcode" className="text-sm font-medium">
          Spike passcode
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          className="rounded border px-3 py-2"
        />
        <Suspense>
          <WrongPasscode searchParams={searchParams} />
        </Suspense>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Unlock
        </button>
      </form>
    </main>
  );
}
