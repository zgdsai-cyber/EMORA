import Link from 'next/link';

import { AuthForm } from '../auth-form';

export default function LoginPage() {
  return (
    <>
      <AuthForm mode="login" />
      <nav>
        <Link href="/register">Create an account</Link>{' '}
        <Link href="/forgot-password">Forgot password?</Link>
      </nav>
    </>
  );
}
