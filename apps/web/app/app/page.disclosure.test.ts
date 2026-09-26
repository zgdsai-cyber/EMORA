import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Slice 3 G2-C2 scientific boundary scan: wherever profile identity is
 * displayed or selected, the page must disclose that a profile is a
 * model-configuration record used for computation — never a measured
 * psychological profile, personality, diagnosis, or assessment of a person.
 * (G2-C3 is N/A for this surface: the page renders no new computational
 * output; the reused panels carry the canonical output disclosure.)
 */

const pageSource = readFileSync(
  fileURLToPath(new URL('./page.tsx', import.meta.url)),
  'utf8',
);

describe('Slice 3 profile identity disclosure (G2-C2)', () => {
  it('renders the frozen profile identity disclosure on the workspace surface', () => {
    expect(pageSource).toContain(
      'This profile is a model-configuration record used for computation',
    );
    expect(pageSource).toContain(
      'it is not a psychological assessment of a person.',
    );
    expect(pageSource).toContain('role="note"');
    expect(pageSource).toContain('aria-label="Profile identity disclosure"');
  });

  it('contains no measured-personality or assessment wording', () => {
    for (const forbidden of [
      'true emotion',
      'measured anxiety',
      'measured trust',
      'personality assessment',
      'psychological profile',
      'diagnos',
      'clinically',
      'test result',
      'EMORA detects',
      'EMORA knows',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  it('labels externalReference neutrally and never as a person name', () => {
    expect(pageSource).toContain('external reference ');
    expect(pageSource).not.toContain('Person ');
    expect(pageSource).not.toContain('Personality of');
  });
});
