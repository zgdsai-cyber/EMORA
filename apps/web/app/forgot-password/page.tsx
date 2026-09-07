import Link from 'next/link';

import { AuthForm } from '../auth-form';

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthForm mode="forgot-password" />
      <p><Link href="/login">Back to login</Link></p>
    </>
  );
}
