import Link from 'next/link';

import { AuthForm } from '../auth-form';

export default function RegisterPage() {
  return (
    <>
      <AuthForm mode="register" />
      <p><Link href="/login">Already have an account?</Link></p>
    </>
  );
}
