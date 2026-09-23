import { requireAuth } from '@emora/auth';
import { headers } from 'next/headers';

import { LogoutButton } from '../logout-button';
import { TransitionForm } from '../transition-form';
import {
  ensureControlledFixture,
  grantControlledMembership,
  resolveAuthorizedWorkspace,
} from '../../server/transitions/fixture';

export const dynamic = 'force-dynamic';

export default async function ProtectedAppPage() {
  const session = await requireAuth(await headers());

  // Read-only resolution of a workspace this user may use.
  let workspace = await resolveAuthorizedWorkspace(session.user.id);

  // Controlled development/demo fixture only. Development environments only:
  // test, production, staging, and preview never provision, and nothing is
  // provisioned when a workspace already exists.
  if (!workspace && process.env.NODE_ENV === 'development') {
    const fixture = await ensureControlledFixture();
    await grantControlledMembership(fixture, session.user.id);
    workspace = fixture;
  }

  return (
    <main>
      <h1>HYBRID EMOTIONAL ENGINE</h1>
      <p>Signed in as {session.user.email}.</p>
      <LogoutButton />

      {workspace ? (
        <>
          <p>
            Project {workspace.projectId} · profile {workspace.profileId}
          </p>
          <TransitionForm
            projectId={workspace.projectId}
            profileId={workspace.profileId}
          />
        </>
      ) : (
        <section>
          <h2>No authorized project or profile is available</h2>
          <p>
            This controlled workspace has no project/profile that your account
            may use. Organization, project, and profile provisioning is
            intentionally outside this slice; the development fixture is
            provisioned automatically outside production builds.
          </p>
        </section>
      )}
    </main>
  );
}
