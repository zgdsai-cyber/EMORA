import { recordAuditEvent } from '@emora/auth';
import { db, emotionalStates, modelVersions } from '@emora/database';
import {
  DeterministicEmotionalDynamicsProvider,
  emotionNames,
} from '@emora/emotional-core';
import type { EmotionalState } from '@emora/emotional-core';
import { and, desc, eq } from 'drizzle-orm';

import {
  INITIALIZATION_MARKER,
  PARAMETER_IDENTITY,
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../transitions/disclosure';
import {
  toDomainModelVersion,
  toDomainState,
} from '../transitions/domain-mapping';
import { StateReadError } from './errors';

/**
 * Slice 2 read service — the symmetric read companion to Slice 1's transition
 * write.
 *
 * Read-only for product state: no transaction, no lock, no writes except the
 * single successful-read audit row, which is created only AFTER the persisted
 * state has passed domain validation. Therefore a 200 response implies exactly
 * one `emotional_state.read` audit row, and every failure path
 * (state_not_found, state_data_invalid, audit failure) creates none.
 *
 * The successful-read audit uses the existing `recordAuditEvent` mechanism and
 * an explicit operational-identifier metadata allow-list only: no emotion
 * values, dimensions, confidence, raw JSONB, context, memories, embeddings,
 * payload, or secrets.
 */

const provider = new DeterministicEmotionalDynamicsProvider();

export interface StateReadServiceInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly profileId: string;
  readonly requestId: string;
}

/** Frozen Slice 2 response contract — Slice 1's envelope minus POST-only fields. */
export interface StateReadResponseBody {
  readonly requestId: string;
  readonly projectId: string;
  readonly profileId: string;
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
  readonly disclosure: typeof SCIENTIFIC_DISCLOSURE_CODE;
  readonly disclosureText: typeof SCIENTIFIC_DISCLOSURE_TEXT;
}

export interface StateReadServiceResult {
  readonly status: 200;
  readonly body: StateReadResponseBody;
  readonly stateId: string;
}

function buildResponse(input: {
  readonly requestId: string;
  readonly projectId: string;
  readonly profileId: string;
  readonly stateId: string;
  readonly state: EmotionalState;
  readonly modelRow: { id: string; name: string; version: string };
}): StateReadResponseBody {
  const emotionVector: Record<string, number> = {};
  for (const emotion of emotionNames) {
    emotionVector[emotion] = input.state.emotionVector[emotion];
  }
  return {
    requestId: input.requestId,
    projectId: input.projectId,
    profileId: input.profileId,
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
    initialized:
      input.state.metadata?.initialization === INITIALIZATION_MARKER,
    disclosure: SCIENTIFIC_DISCLOSURE_CODE,
    disclosureText: SCIENTIFIC_DISCLOSURE_TEXT,
  };
}

export async function readLatestState(
  input: StateReadServiceInput,
): Promise<StateReadServiceResult> {
  // 1. Latest persisted state for exactly this (projectId, profileId) pair —
  //    the same deterministic total order Slice 1 uses to chain transitions.
  //    A profile belonging to another project matches nothing here and is
  //    indistinguishable from "no state yet".
  const [stateRow] = await db
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

  if (!stateRow) {
    throw new StateReadError('state_not_found');
  }

  // 2. Model identity resolved through the state's foreign key (never from a
  //    request). The FK guarantees the row exists; this is defense in depth.
  const [modelRow] = await db
    .select({
      id: modelVersions.id,
      name: modelVersions.name,
      version: modelVersions.version,
    })
    .from(modelVersions)
    .where(eq(modelVersions.id, stateRow.modelVersionId))
    .limit(1);
  if (!modelRow) {
    throw new StateReadError('internal_error', 'model_version_integrity');
  }

  // 3. Domain validation of the persisted JSONB (fail-closed). Corrupt state
  //    never reaches serialization and raw contents never leave this layer.
  let state: EmotionalState;
  try {
    state = toDomainState(
      {
        state: stateRow.state,
        timestamp: stateRow.timestamp,
        modelVersionId: stateRow.modelVersionId,
      },
      toDomainModelVersion(modelRow),
    );
  } catch {
    throw new StateReadError('state_data_invalid', 'state_integrity');
  }

  // 4. Successful-read audit: the existing recordAuditEvent mechanism with an
  //    explicit operational-identifier allow-list. Fail-closed — if the audit
  //    row cannot be written, the read fails instead of returning unaudited.
  const stateId = stateRow.id;
  try {
    await recordAuditEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      action: 'emotional_state.read',
      resourceType: 'emotional_state',
      resourceId: stateId,
      metadata: {
        projectId: input.projectId,
        profileId: input.profileId,
        stateId,
        requestId: input.requestId,
        outcome: 'succeeded',
      },
    });
  } catch {
    throw new StateReadError('internal_error', 'read_audit_failed');
  }

  return {
    status: 200,
    stateId,
    body: buildResponse({
      requestId: input.requestId,
      projectId: input.projectId,
      profileId: input.profileId,
      stateId,
      state,
      modelRow,
    }),
  };
}
