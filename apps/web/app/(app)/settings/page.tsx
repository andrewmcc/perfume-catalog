import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return (
    <>
      <h1 className="font-display text-2xl italic">Settings</h1>
      <p className="mt-2 text-muted">Collection members and preferences are coming.</p>
      <form action="/auth/signout" method="post" className="mt-8">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </>
  );
}
