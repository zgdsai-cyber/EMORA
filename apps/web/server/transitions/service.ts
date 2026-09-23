import {
  auditLogs,
  db,
  emotionalEvents,
  emotionalProfiles,
  emotionalStates,
  modelVersions,
} from '@emora/database';
import {
  DeterministicEmotionalDynamicsProvider,
  emotionNames,
} from '@emora/emotional-core';
import type { EmotionalState, ModelVersion } from '@emora/emotional-core';
import { and, desc, eq } from 'drizzle-orm';

import { hashCanonical } from './canonicalize';
import {
  INITIALIZATION_MARKER,
  PARAMETER_IDENTITY,
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from './disclosure';
import {
  stateToJson,
  toDomainEvent,
  toDomainModelVersion,
  toDomainState,
  toInitialComputationalState,
} from './domain-mapping';
import { TransitionError } from './errors';
import { toPersonalityProfile } from './personality-profile';
import type { AcceptedTransitionRequest } from './validation';

/** Seeded runtime model identity (see migration 0006). */
export const DETERMINISTIC_MODEL_NAME = 'emora-deterministic-dynamics';
export const DETERMINISTIC_MODEL_VERSION = '1.0.0';

/** Future-clock tolerance for a supplied event timestamp. */
export const FUTURE_SKEW_MS = 5 * 60 * 1000;

const provider = new DeterministicEmotionalDynamicsProvider();

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TransitionServiceInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly profileId: string;
  readonly idempotencyKey: string;
  readonly request: AcceptedTransitionRequest;
  readonly requestId: string;
  readonly now: Date;
}

export interface TransitionResponseBody {
  readonly requestId: string;
  readonly duplicate: boolean;
  readonly projectId: string;
  readonly profileId: string;
  readonly eventId: string;
  readonly stateId: string;
  readonly timestamp: string;
  readonly emotionVector: Record<string, number>;
  readonly dimensions: {
    readonly valence: number;
    readonly arousal: number;
    readonly intensity: number;
  };
  readonly modelIdentity: {
    readonly modelVersionId: string;
    readonly name: string;
    readonly version: string;
    readonly providerIdentifier: string;
    readonly providerVersion: string;
  };
  readonly parameterIdentity: string;
  readonly initialized: boolean;
  readonly disclosure: string;
  readonly disclosureText: string;
}

export interface TransitionServiceResult {
  readonly status: 200 | 201;
  readonly body: TransitionResponseBody;
  readonly eventId: string;
  readonly stateId: string;
}

/** Canonical digest of the accepted request (idempotency payload identity). */
export function requestDigest(request: AcceptedTransitionRequest): string {
  return hashCanonical({
    valence: request.valence,
    intensity: request.intensity,
    relevance: request.relevance,
    surprise: request.surprise,
    uncertainty: request.uncertainty,
    context: request.context ?? null,
    timestamp: request.timestamp ?? null,
  });
}

function buildResponse(input: {
  requestId: string;
  duplicate: boolean;
  projectId: string;
  profileId: string;
  eventId: string;
  stateId: string;
  state: EmotionalState;
  modelRow: { id: string; name: string; version: string };
}): TransitionResponseBody {
  const emotionVector: Record<string, number> = {};
  for (const emotion of emotionNames) {
    emotionVector[emotion] = input.state.emotionVector[emotion];
  }
  return {
    requestId: input.requestId,
    duplicate: input.duplicate,
    projectId: input.projectId,
    profileId: input.profileId,
    eventId: input.eventId,
    stateId: input.stateId,
    timestamp: input.state.timestamp,
    emotionVector,
    dimensions: {
      valence: input.state.dimensions.valence,
      arousal: input.state.dimensions.arousal,
      intensity: input.state.dimensions.intensity,
    },
    modelIdentity: {
      modelVersionId: input.modelRow.id,
      name: input.modelRow.name,
      version: input.modelRow.version,
      providerIdentifier: provider.identifier,
      providerVersion: provider.modelVersion?.version ?? 'unknown',
    },
    parameterIdentity: PARAMETER_IDENTITY,
    initialized: input.state.metadata?.initialization === INITIALIZATION_MARKER,
    disclosure: SCIENTIFIC_DISCLOSURE_CODE,
    disclosureText: SCIENTIFIC_DISCLOSURE_TEXT,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '23505'
  );
}

async function loadModelVersion(
  tx: Transaction,
): Promise<{ id: string; name: string; version: string }> {
  const [row] = await tx
    .select({
      id: modelVersions.id,
      name: modelVersions.name,
      version: modelVersions.version,
    })
    .from(modelVersions)
    .where(
      and(
        eq(modelVersions.name, DETERMINISTIC_MODEL_NAME),
        eq(modelVersions.version, DETERMINISTIC_MODEL_VERSION),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TransitionError('internal_error', 'model_version_integrity');
  }
  return row;
}
async function loadReplay(
  tx: Transaction,
  input: TransitionServiceInput,
  event: { id: string },
  modelVersion: ModelVersion,
  modelRow: { id: string; name: string; version: string },
): Promise<TransitionServiceResult> {
  const [stateRow] = await tx
    .select()
    .from(emotionalStates)
    .where(eq(emotionalStates.eventId, event.id))
    .limit(1);
  if (!stateRow) {
    throw new TransitionError('internal_error', 'idempotency_state_missing');
  }
  const state = toDomainState(
    {
      state: stateRow.state,
      timestamp: stateRow.timestamp,
      modelVersionId: stateRow.modelVersionId,
    },
    modelVersion,
  );
  return {
    status: 200,
    eventId: event.id,
    stateId: stateRow.id,
    body: buildResponse({
      requestId: input.requestId,
      duplicate: true,
      projectId: input.projectId,
      profileId: input.profileId,
      eventId: event.id,
      stateId: stateRow.id,
      state,
      modelRow,
    }),
  };
}

export async function runProjectScopedTransition(
  input: TransitionServiceInput,
): Promise<TransitionServiceResult> {
  const requestHash = requestDigest(input.request);
  const effectiveTimestamp = input.request.timestamp ?? input.now.toISOString();

  try {
    return await db.transaction(async (tx) => {
      // 1. Lock the profile row (serializes transitions for this profile).
      const [profile] = await tx
        .select({
          id: emotionalProfiles.id,
          projectId: emotionalProfiles.projectId,
          profileData: emotionalProfiles.profileData,
        })
        .from(emotionalProfiles)
        .where(
          and(
            eq(emotionalProfiles.id, input.profileId),
            eq(emotionalProfiles.projectId, input.projectId),
          ),
        )
        .for('update');
      if (!profile) throw new TransitionError('profile_not_found');

      // 2. Latest persisted state (deterministic total order).
      const [latestStateRow] = await tx
        .select()
        .from(emotionalStates)
        .where(
          and(
            eq(emotionalStates.projectId, input.projectId),
            eq(emotionalStates.profileId, input.profileId),
          ),
        )
        .orderBy(
          desc(emotionalStates.timestamp),
          desc(emotionalStates.createdAt),
          desc(emotionalStates.id),
        )
        .limit(1);

      // 3. Idempotency resolution (before any expensive work).
      const [existingEvent] = await tx
        .select({
          id: emotionalEvents.id,
          requestHash: emotionalEvents.requestHash,
        })
        .from(emotionalEvents)
        .where(
          and(
            eq(emotionalEvents.projectId, input.projectId),
            eq(emotionalEvents.profileId, input.profileId),
            eq(emotionalEvents.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      const modelRow = await loadModelVersion(tx);
      const modelVersion = toDomainModelVersion(modelRow);
      if (existingEvent) {
        if (existingEvent.requestHash !== requestHash) {
          throw new TransitionError('idempotency_conflict');
        }
        return loadReplay(tx, input, existingEvent, modelVersion, modelRow);
      }

      // 4. Timestamp rules (persistence ordering only, never psychological time).
      const effectiveMs = Date.parse(effectiveTimestamp);
      if (effectiveMs > input.now.getTime() + FUTURE_SKEW_MS) {
        throw new TransitionError('invalid_input');
      }
      if (latestStateRow && effectiveMs < latestStateRow.timestamp.getTime()) {
        throw new TransitionError('temporal_conflict');
      }
      // 5. Persisted profile data (fail closed; no defaults, no clamping).
      const personalityProfile = toPersonalityProfile(
        profile.id,
        profile.profileData,
      );

      // 6. Current state: persisted state, or computational initialization.
      const initialized = latestStateRow === undefined;
      const currentState = latestStateRow
        ? toDomainState(
            {
              state: latestStateRow.state,
              timestamp: latestStateRow.timestamp,
              modelVersionId: latestStateRow.modelVersionId,
            },
            modelVersion,
          )
        : toInitialComputationalState(effectiveTimestamp, modelVersion);

      // 7. Deterministic transition: unchanged mathematics, no memories,
      //    default runtime parameters.
      const eventId = crypto.randomUUID();
      const event = toDomainEvent(eventId, input.request, effectiveTimestamp);
      const nextState = provider.transition({
        currentState,
        event,
        personalityProfile,
        memories: [],
        modelParameters: undefined,
      }).nextState;

      // 8. Persist event.
      const [eventRow] = await tx
        .insert(emotionalEvents)
        .values({
          id: eventId,
          projectId: input.projectId,
          profileId: input.profileId,
          timestamp: new Date(effectiveTimestamp),
          source: event.source,
          valence: event.valence,
          intensity: event.intensity,
          relevance: event.relevance,
          surprise: event.surprise,
          uncertainty: event.uncertainty,
          context: event.context ?? null,
          idempotencyKey: input.idempotencyKey,
          requestHash,
        })
        .returning({ id: emotionalEvents.id });

      // 9. Persist resulting state.
      const [stateRow] = await tx
        .insert(emotionalStates)
        .values({
          projectId: input.projectId,
          profileId: input.profileId,
          timestamp: new Date(nextState.timestamp),
          state: stateToJson(nextState),
          valence: nextState.dimensions.valence,
          arousal: nextState.dimensions.arousal,
          intensity: nextState.dimensions.intensity,
          confidence: nextState.dimensions.confidence,
          modelVersionId: modelRow.id,
          eventId: eventRow.id,
        })
        .returning({ id: emotionalStates.id });

      // 10. Transition audit. In-transaction: an audit failure rolls back the
      //     event and state (never swallowed).
      await tx.insert(auditLogs).values({
        organizationId: input.organizationId,
        userId: input.userId,
        action: 'emotional_transition.created',
        resourceType: 'emotional_transition',
        resourceId: stateRow.id,
        metadata: {
          projectId: input.projectId,
          profileId: input.profileId,
          eventId: eventRow.id,
          stateId: stateRow.id,
          providerIdentifier: provider.identifier,
          providerVersion: provider.modelVersion?.version ?? 'unknown',
          modelVersionId: modelRow.id,
          requestId: input.requestId,
          idempotencyStatus: 'applied',
          outcome: 'succeeded',
        },
      });

      // 11. Initialization audit, first transition only.
      if (initialized) {
        await tx.insert(auditLogs).values({
          organizationId: input.organizationId,
          userId: input.userId,
          action: 'emotional_profile_initialized',
          resourceType: 'emotional_profile',
          resourceId: profile.id,
          metadata: {
            projectId: input.projectId,
            profileId: input.profileId,
            stateId: stateRow.id,
            initialization: INITIALIZATION_MARKER,
            requestId: input.requestId,
            outcome: 'succeeded',
          },
        });
      }

      return {
        status: 201 as const,
        eventId: eventRow.id,
        stateId: stateRow.id,
        body: buildResponse({
          requestId: input.requestId,
          duplicate: false,
          projectId: input.projectId,
          profileId: input.profileId,
          eventId: eventRow.id,
          stateId: stateRow.id,
          state: nextState,
          modelRow,
        }),
      };
    });
  } catch (error) {
    if (error instanceof TransitionError) throw error;
    if (isUniqueViolation(error)) {
      throw new TransitionError('concurrency_conflict');
    }
    throw new TransitionError('internal_error');
  }
}
