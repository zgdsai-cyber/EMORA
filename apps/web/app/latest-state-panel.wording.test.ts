import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SCIENTIFIC_DISCLOSURE_TEXT } from '../server/transitions/disclosure';

/**
 * Slice 2 scientific boundary scan: the panel may describe only a computational
 * / model-estimated state, must reuse the frozen disclosure constant, and must
 * never render confidence or internal metadata.
 */

const panelSource = readFileSync(
  fileURLToPath(new URL('./latest-state-panel.tsx', import.meta.url)),
  'utf8',
);

describe('Slice 2 panel scientific wording boundary', () => {
  it('uses only the allowed UI wording', () => {
    expect(panelSource).toContain('Most recent computational state');
    expect(panelSource).toContain('Computed at ');
    expect(panelSource).toContain(
      'No computational state has been computed for this profile yet.',
    );
  });

  it('contains no prohibited measurement or detection wording', () => {
    for (const forbidden of [
      'How you feel',
      'What you feel',
      "The user's emotional state",
      'EMORA detects',
      'EMORA knows',
      'is emotionally',
      'your emotion',
      'true emotion',
      'diagnos',
      'clinically',
      'measures your',
    ]) {
      expect(panelSource).not.toContain(forbidden);
    }
  });

  it('renders no confidence, adjustment, or internal metadata fields', () => {
    expect(panelSource).not.toContain('confidence');
    expect(panelSource).not.toContain('confidenceAdjustment');
    expect(panelSource).not.toContain('state.metadata');
    expect(panelSource).not.toContain('.metadata');
  });

  it('imports the frozen disclosure constant instead of hardcoding wording', () => {
    expect(panelSource).toContain(
      "from '../server/transitions/disclosure'",
    );
    expect(panelSource).toContain('SCIENTIFIC_DISCLOSURE_CODE');
    expect(panelSource).toContain('SCIENTIFIC_DISCLOSURE_TEXT');
    // The literal disclosure sentence must come from the constant, never a copy.
    expect(panelSource).not.toContain('EMORA output is a computational');
    expect(SCIENTIFIC_DISCLOSURE_TEXT).toContain(
      'computational, model-estimated emotional state',
    );
  });

  it('renders the persistent non-dismissible disclosure markup', () => {
    expect(panelSource).toContain('role="note"');
    expect(panelSource).toContain('data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}');
    expect(panelSource).toContain('aria-label="Scientific disclosure"');
  });
});
