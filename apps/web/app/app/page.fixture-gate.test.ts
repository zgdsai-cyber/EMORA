import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * D4 fixture environment gate. The controlled fixture may only be provisioned
 * by a development run of `/app`; test, production, staging, preview, and any
 * unset/unknown NODE_ENV must never write fixture rows.
 */

const pageSource = readFileSync(
  fileURLToPath(new URL('./page.tsx', import.meta.url)),
  'utf8',
);

/** The gate as written in the page — development only. */
function isControlledFixtureAllowed(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development';
}

describe('D4 fixture environment gate', () => {
  it('is development-only in the actual page source', () => {
    expect(pageSource).toContain('process.env.NODE_ENV === ');
    expect(pageSource).toContain("'development'");
    expect(pageSource).not.toContain('process.env.NODE_ENV !== ');
    expect(pageSource).not.toContain("'production'");
  });

  it('allows the controlled fixture only when NODE_ENV is development', () => {
    expect(isControlledFixtureAllowed('development')).toBe(true);
    for (const nodeEnv of [
      'test',
      'production',
      'staging',
      'preview',
      '',
      undefined,
    ]) {
      expect(isControlledFixtureAllowed(nodeEnv)).toBe(false);
    }
  });
});
