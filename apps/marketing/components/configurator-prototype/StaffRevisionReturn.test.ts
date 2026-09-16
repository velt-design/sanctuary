import { describe, expect, it } from 'vitest';
import { staffRevisionReturnUrl } from './StaffRevisionReturn';
import type { PreviewDraft } from './previewDraft';

const draft: PreviewDraft = {
  version: 1,
  input: { widthMm: 6000, projectionMm: 3000, level: 'ground', connection: 'facade' },
  roof: { family: 'mono', orientation: 'parallel', infills: false },
};
const project = '262f0c9a-1799-4194-a8cc-45600743cede';
const source = '4d96b8fb-c83d-430c-adcc-205ea101162e';
const current = `https://preview.example/configurator-preview?staff_project=${project}&staff_source=${source}&staff_return_origin=https://attacker.example`;

describe('staff revision return destination', () => {
  it('uses only the trusted deployment origin and preserves the revision', () => {
    const result = new URL(staffRevisionReturnUrl(current, draft, false, 'https://staff-preview.example')!);
    expect(result.origin).toBe('https://staff-preview.example');
    expect(result.pathname).toBe(`/staff/projects/${project}/configurator-revision`);
    expect(result.searchParams.get('sourceEstimateId')).toBe(source);
    expect(JSON.parse(new URLSearchParams(result.hash.slice(1)).get('revisionDraft')!)).toEqual(draft);
  });
  it.each([undefined, 'invalid', 'http://staff.example', 'https://user:pass@staff.example', 'https://staff.example/path', 'https://staff.example?x=1'])('rejects an invalid deployment origin: %s', origin => {
    expect(new URL(staffRevisionReturnUrl(current, draft, false, origin)!).origin).toBe('https://portal.sanctuarypergolas.co.nz');
  });
  it('retains local development return support', () => {
    const local = current.replace('https://preview.example', 'http://localhost:3062').replace('https://attacker.example', 'http://localhost:3061');
    expect(new URL(staffRevisionReturnUrl(local, draft, true)!).origin).toBe('http://localhost:3061');
  });
  it('does not expose a revision action without valid project identifiers', () => {
    expect(staffRevisionReturnUrl('https://preview.example', draft, false)).toBeNull();
  });
});
