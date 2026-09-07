'use client';

import { FormEvent, useState } from 'react';

import { authClient } from '@emora/auth/client';

type AuthMode = 'login' | 'register' | 'forgot-password';

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');

    try {
      if (mode === 'forgot-password') {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: '/login',
        });
        if (result.error) setError(result.error.message ?? 'Unable to send reset email.');
        else setMessage('If the account exists, reset instructions have been sent.');
        return;
      }

      const password = String(formData.get('password') ?? '');
      const result = mode === 'login'
        ? await authClient.signIn.email({ email, password, callbackURL: '/app' })
        : await authClient.signUp.email({
            email,
            password,
            name: String(formData.get('name') ?? ''),
            callbackURL: '/app',
          });

      if (result.error) setError(result.error.message ?? 'Authentication failed.');
      else window.location.assign('/app');
    } finally {
      setPending(false);
    }
  }

  const title = mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password';

  return (
    <main>
      <h1>{title}</h1>
      <form onSubmit={submit}>
        {mode === 'register' && <label>Name<input name="name" required autoComplete="name" /></label>}
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        {mode !== 'forgot-password' && <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>}
        <button type="submit" disabled={pending}>{pending ? 'Working...' : title}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
