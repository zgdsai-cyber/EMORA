/**
 * Minimal structured operational logging: one JSON line per request.
 *
 * The allow-list is enforced by construction — only the fields below can be
 * emitted. Emotion values, dimensions, confidence, event feature values, raw
 * context, request hashes, emails, tokens, and payloads have no path here.
 */
export interface TransitionLogFields {
  readonly level: 'info' | 'error';
  readonly event: 'emotional_transition';
  readonly requestId: string;
  readonly outcome: string;
  readonly latencyMs: number;
  readonly errorCategory?: string;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly projectId?: string;
  readonly profileId?: string;
  readonly eventId?: string;
  readonly stateId?: string;
  readonly modelId?: string;
  readonly modelVersion?: string;
  readonly duplicate?: boolean;
}

export function logTransition(fields: TransitionLogFields): void {
  const line = JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ),
  );
  // Single line, no dependencies, no aggregation platform.
  console.log(line);
}
