'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../server/transitions/disclosure';

/**
 * Slice 2 panel: the most recently persisted computational state for the
 * authorized profile. Displays model-output fields only — never internal
 * computation quantities or raw persisted structures. The scientific
 * disclosure is rendered persistently, exactly as the transition form does.
 */
interface LatestStateResponse {
  readonly stateId: string;
  readonly timestamp: string;
  readonly emotionVector: Readonly<Record<string, number>>;
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

const EMOTION_LABELS = [
  'love',
  'fear',
  'nostalgia',
  'jealousy',
  'trust',
  'anger',
  'joy',
] as const;

type PanelState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly data: LatestStateResponse };

export function LatestStatePanel({
  projectId,
  profileId,
}: {
  projectId: string;
  profileId: string;
}) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/profiles/${profileId}/states/latest`,
      );
      if (response.status === 404) {
        setState({ kind: 'empty' });
        return;
      }
      if (!response.ok) {
        setState({ kind: 'error' });
        return;
      }
      const body = (await response.json()) as LatestStateResponse;
      setState({ kind: 'ready', data: body });
    } catch {
      setState({ kind: 'error' });
    }
  }, [projectId, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <h2>Most recent computational state</h2>
      <button
        type="button"
        onClick={() => void load()}
        disabled={state.kind === 'loading'}
      >
        {state.kind === 'loading' ? 'Reading...' : 'Refresh state'}
      </button>

      {state.kind === 'empty' && (
        <p>No computational state has been computed for this profile yet.</p>
      )}

      {state.kind === 'error' && (
        <p role="alert">The latest state could not be read.</p>
      )}

      {state.kind === 'ready' && (
        <div>
          <p>
            <strong>Emotion vector</strong>
          </p>
          <ul>
            {EMOTION_LABELS.map((emotion) => (
              <li key={emotion}>
                {emotion}: {state.data.emotionVector[emotion]?.toFixed(4)}
              </li>
            ))}
          </ul>
          <p>
            <strong>Dimensions</strong>
          </p>
          <ul>
            <li>valence: {state.data.dimensions.valence.toFixed(4)}</li>
            <li>arousal: {state.data.dimensions.arousal.toFixed(4)}</li>
            <li>intensity: {state.data.dimensions.intensity.toFixed(4)}</li>
          </ul>
          <p>
            <strong>Model identity</strong>
          </p>
          <ul>
            <li>name: {state.data.modelIdentity.name}</li>
            <li>version: {state.data.modelIdentity.version}</li>
            <li>
              provider: {state.data.modelIdentity.providerIdentifier} (
              {state.data.modelIdentity.providerVersion})
            </li>
          </ul>
          <p>
            <strong>Parameter identity</strong>:{' '}
            {state.data.parameterIdentity}
          </p>
          <p>Computed at {state.data.timestamp}</p>
        </div>
      )}

      {/* Persistent, non-dismissible scientific disclosure. */}
      <aside
        role="note"
        data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}
        aria-label="Scientific disclosure"
      >
        <p>{SCIENTIFIC_DISCLOSURE_TEXT}</p>
      </aside>
    </section>
  );
}
