import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PORTAL_COMPANY_PROFILE } from './profile';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

describe('PORTAL_COMPANY_PROFILE', () => {
  it('references a valid bundled PNG for generated PDFs', async () => {
    expect(PORTAL_COMPANY_PROFILE.logoFilename).toBe('logo-sanctuary.png');

    const logoPath = resolve(process.cwd(), 'apps/portal/public', PORTAL_COMPANY_PROFILE.logoFilename);
    const bytes = await readFile(logoPath);

    expect(Array.from(bytes.subarray(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(bytes.length).toBeGreaterThan(PNG_SIGNATURE.length);
  });
});
