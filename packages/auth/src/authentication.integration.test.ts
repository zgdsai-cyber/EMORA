import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from '@emora/database/schema';

const databaseUrl = process.env.DATABASE_URL;
const integration = process.env.CI ? describe : describe.skipIf(!databaseUrl);
const client = databaseUrl ? postgres(databaseUrl, { max: 1 }) : null;
const database = client ? drizzle(client, { schema }) : null;
const createdEmails: string[] = [];

function cookieHeader(response: Response) {
  const cookie = response.headers.get('set-cookie');
  return cookie?.split(';', 1)[0] ?? '';
}

integration('Better Auth authentication', () => {
  afterAll(async () => {
    if (database) {
      for (const email of createdEmails) {
        await database
          .delete(schema.users)
          .where(eq(schema.users.email, email));
      }
    }
    await client?.end({ timeout: 5 });
  });

  it('registers, retrieves a session, logs out, and logs in', async () => {
    process.env.AUTH_SECRET ??= 'integration-only-secret';
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    const { auth } = await import('./auth');
    const email = `auth-test-${crypto.randomUUID()}@example.test`;
    const password = 'secure-password-123';
    createdEmails.push(email);
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();

    const registerResponse = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'Auth Test User' }),
      }),
    );
    expect(registerResponse.status).toBe(200);
    const registeredCookie = cookieHeader(registerResponse);
    expect(registeredCookie).toContain('emora.session_token=');

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: registeredCookie }),
    });
    expect(session?.user.email).toBe(email);

    const logoutResponse = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-out', {
        method: 'POST',
        headers: { cookie: registeredCookie },
      }),
    );
    expect(logoutResponse.status).toBe(200);
    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: registeredCookie }),
      }),
    ).toBeNull();

    const loginResponse = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(loginResponse.status).toBe(200);
    expect(cookieHeader(loginResponse)).toContain('emora.session_token=');
  });
});
