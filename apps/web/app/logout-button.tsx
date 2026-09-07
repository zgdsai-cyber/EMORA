'use client';

import { authClient } from '@emora/auth/client';

export function LogoutButton() {
  async function logout() {
    await authClient.signOut();
    window.location.assign('/login');
  }

  return <button type="button" onClick={logout}>Log out</button>;
}
