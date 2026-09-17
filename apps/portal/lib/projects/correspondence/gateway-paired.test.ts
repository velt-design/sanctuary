import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { readStaffCorrespondence } from './gateway';
import { correspondenceFixture } from '@/app/qa/project-command-centre-fixture/correspondenceFixture';

// Synthetic wire artifact for Velt's paired test. No network/provider/model call.
const wireFile = process.env.STAFF_CORRESPONDENCE_WIRE_FILE;
describe.skipIf(!wireFile)('Portal sender wire proof', () => {
  it('exports exact signed bytes and accepts the request-bound response', async () => {
    const config = { origin: 'https://velt.example.test', secret: 'a'.repeat(64), includeMessageLineage: true };
    const projectId = '11111111-1111-4111-8111-111111111111';
    const actorId = '22222222-2222-4222-8222-222222222222';
    const requestId = '33333333-3333-4333-8333-333333333333';
    const now = Date.parse(correspondenceFixture.observedAt);
    const fetcher: typeof fetch = async (url, init) => {
      writeFileSync(wireFile!, JSON.stringify({ url: String(url), headers: Object.fromEntries(new Headers(init?.headers)), body: init?.body, now, expected: { projectId, actorId, requestId, includeMessageLineage: true } }));
      return Response.json({ schemaVersion: 'sanctuary.staff-correspondence.v1', projectId, requestId, context: correspondenceFixture });
    };
    const result = await readStaffCorrespondence(config, { projectId, actorId }, new AbortController().signal,
      { fetcher, now: () => now, nonce: () => requestId });
    expect(result).toEqual(correspondenceFixture);
  });
});
