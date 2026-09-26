import { requireAuth } from '@emora/auth';
import { headers } from 'next/headers';

import { LatestStatePanel } from '../latest-state-panel';
import { LogoutButton } from '../logout-button';
import { TransitionForm } from '../transition-form';
import {
  discoverAuthorizedProfiles,
  discoverAuthorizedProjects,
} from '../../server/discovery';
import {
  ensureControlledFixture,
  grantControlledMembership,
} from '../../server/transitions/fixture';

export const dynamic = 'force-dynamic';

/**
 * Slice 3 G2-C2 profile identity disclosure (frozen semantic meaning): shown
 * wherever profile identity is displayed or selected. A profile is a
 * model-configuration record used for computation — never a measured
 * personality and never an assessment of a person.
 */
const PROFILE_IDENTITY_DISCLOSURE =
  'This profile is a model-configuration record used for computation; it is not a psychological assessment of a person.' as const;

export default async function ProtectedAppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth(await headers());

  // Production workspace discovery: membership-scoped, server-derived.
  let projects = await discoverAuthorizedProjects(session.user.id);

  // Controlled development/demo fixture only. Development environments only:
  // test, production, staging, and preview never provision, and nothing is
  // provisioned when a workspace already exists.
  if (projects.length === 0 && process.env.NODE_ENV === 'development') {
    const fixture = await ensureControlledFixture();
    await grantControlledMembership(fixture, session.user.id);
    projects = await discoverAuthorizedProjects(session.user.id);
  }

  const query = await searchParams;
  const requestedProjectId =
    typeof query.projectId === 'string' ? query.projectId : undefined;
  const requestedProfileId =
    typeof query.profileId === 'string' ? query.profileId : undefined;

  const project =
    projects.find((candidate) => candidate.projectId === requestedProjectId) ??
    projects[0];

  const profiles = project
    ? await discoverAuthorizedProfiles(session.user.id, project.projectId)
    : [];

  const profile =
    profiles.find((candidate) => candidate.profileId === requestedProfileId) ??
    profiles[0];

  return (
    <main>
      <h1>HYBRID EMOTIONAL ENGINE</h1>
      <p>Signed in as {session.user.email}.</p>
      <LogoutButton />

      {projects.length === 0 ? (
        <section>
          <h2>No authorized project is available</h2>
          <p>
            This workspace has no project that your account may use. Any
            organization, project, or profile provisioning is intentionally
            outside this slice; the development fixture is provisioned
            automatically outside production builds.
          </p>
        </section>
      ) : (
        <>
          <section>
            <h2>Projects</h2>
            <ul>
              {projects.map((candidate) => (
                <li key={candidate.projectId}>
                  <a
                    href={`?projectId=${candidate.projectId}`}
                    aria-current={
                      candidate.projectId === project?.projectId
                        ? 'true'
                        : undefined
                    }
                  >
                    {candidate.name} ({candidate.projectId})
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Profiles</h2>
            {profiles.length === 0 ? (
              <p>
                No profile record is available in this project yet. Profiles
                are created through the profile creation API and are
                model-configuration records used for computation.
              </p>
            ) : (
              <ul>
                {profiles.map((candidate) => (
                  <li key={candidate.profileId}>
                    <a
                      href={`?projectId=${project?.projectId}&profileId=${candidate.profileId}`}
                      aria-current={
                        candidate.profileId === profile?.profileId
                          ? 'true'
                          : undefined
                      }
                    >
                      external reference {candidate.externalReference} (
                      {candidate.profileId})
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {/* Slice 3 G2-C2 profile identity disclosure. */}
            <aside role="note" aria-label="Profile identity disclosure">
              <p>{PROFILE_IDENTITY_DISCLOSURE}</p>
            </aside>
          </section>

          {profile && project ? (
            <>
              <p>
                Project {project.projectId} · profile {profile.profileId}
              </p>
              <LatestStatePanel
                projectId={project.projectId}
                profileId={profile.profileId}
              />
              <TransitionForm
                projectId={project.projectId}
                profileId={profile.profileId}
              />
            </>
          ) : (
            <section>
              <h2>No profile is selected</h2>
              <p>
                Select a profile above to compute and read computational states
                for it.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
