import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '@emora/database';
import * as schema from '@emora/database/schema';

const authSecret = process.env.AUTH_SECRET;

if (!authSecret) {
  throw new Error('AUTH_SECRET is required to initialize authentication.');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    usePlural: true,
  }),
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async () => {
      // Email delivery is intentionally deferred; the reset flow is enabled.
    },
  },
  emailVerification: {
    sendVerificationEmail: async () => {
      // Email delivery is intentionally deferred; the verification flow is enabled.
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'emora',
  },
});
