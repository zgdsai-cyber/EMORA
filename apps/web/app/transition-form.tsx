'use client';

import { FormEvent, useState } from 'react';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../server/transitions/disclosure';

interface TransitionResponse {
  readonly requestId: string;
  readonly duplicate: boolean;
  readonly projectId: string;
  readonly profileId: string;
  readonly eventId: string;
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

const EVENT_FIELDS = [
  { name: 'valence', label: 'Valence (-1 to 1)', min: -1, max: 1 },
  { name: 'intensity', label: 'Intensity (0 to 1)', min: 0, max: 1 },
  { name: 'relevance', label: 'Relevance (0 to 1)', min: 0, max: 1 },
  { name: 'surprise', label: 'Surprise (0 to 1)', min: 0, max: 1 },
  { name: 'uncertainty', label: 'Uncertainty (0 to 1)', min: 0, max: 1 },
] as const;

export function TransitionForm({
  projectId,
  profileId,
}: {
  projectId: string;
  profileId: string;
}) {
  const [result, setResult] = useState<TransitionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const formData = new FormData(event.currentTarget);
      const payload: Record<string, unknown> = {};
      for (const field of EVENT_FIELDS) {
        payload[field.name] = Number(formData.get(field.name) ?? '');
      }
      const contextText = String(formData.get('context') ?? '').trim();
      if (contextText.length > 0) {
        try {
          payload.context = JSON.parse(contextText);
        } catch {
          setError('Context must be valid JSON.');
          return;
        }
      }

      const response = await fetch(
        `/api/v1/projects/${projectId}/profiles/${profileId}/transitions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            // A fresh key per user submission; duplicates are never sent here.
            'idempotency-key': crypto.randomUUID(),
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as
        TransitionResponse | { error?: { message?: string } };

      if (!response.ok) {
        setResult(null);
        setError(
          (body as { error?: { message?: string } }).error?.message ??
            'The transition could not be completed.',
        );
        return;
      }
      setResult(body as TransitionResponse);
    } catch {
      setError('The transition could not be completed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2>Submit a structured event</h2>
      <form onSubmit={submit}>
        {EVENT_FIELDS.map((field) => (
          <label key={field.name}>
            {field.label}
            <input
              name={field.name}
              type="number"
              step="0.01"
              min={field.min}
              max={field.max}
              defaultValue="0"
              required
            />
          </label>
        ))}
        <label>
          Context (optional JSON)
          <textarea name="context" rows={3} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Computing...' : 'Run deterministic transition'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      {result && (
        <div>
          <h2>Computational model-estimated state</h2>
          {result.duplicate && (
            <p role="status">Previously persisted result.</p>
          )}
          <p>
            <strong>Emotion vector</strong>
          </p>
          <ul>
            {EMOTION_LABELS.map((emotion) => (
              <li key={emotion}>
                {emotion}: {result.emotionVector[emotion]?.toFixed(4)}
              </li>
            ))}
          </ul>
          <p>
            <strong>Dimensions</strong>
          </p>
          <ul>
            <li>valence: {result.dimensions.valence.toFixed(4)}</li>
            <li>arousal: {result.dimensions.arousal.toFixed(4)}</li>
            <li>intensity: {result.dimensions.intensity.toFixed(4)}</li>
          </ul>
          <p>
            <strong>Model identity</strong>
          </p>
          <ul>
            <li>name: {result.modelIdentity.name}</li>
            <li>version: {result.modelIdentity.version}</li>
            <li>
              provider: {result.modelIdentity.providerIdentifier} (
              {result.modelIdentity.providerVersion})
            </li>
          </ul>
          <p>
            <strong>Parameter identity</strong>: {result.parameterIdentity}
          </p>
          <p>
            event {result.eventId} · state {result.stateId} · {result.timestamp}
          </p>
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
