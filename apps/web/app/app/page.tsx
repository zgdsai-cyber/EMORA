import { requireAuth } from '@emora/auth';
import { headers } from 'next/headers';

import { LogoutButton } from '../logout-button';

export default async function ProtectedAppPage() {
  const session = await requireAuth(await headers());

  return (
    <main>
      <h1>HYBRID EMOTIONAL ENGINE</h1>
      <p>Signed in as {session.user.email}.</p>
      <LogoutButton />
    </main>
  );
}
