import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseStaffCorrespondence } from './contract';
import { readStaffCorrespondence } from './gateway';
import { correspondenceFixture } from '@/app/qa/project-command-centre-fixture/correspondenceFixture';

// Synthetic wire artifact for Velt's paired test. No network/provider/model call.
const wireFile = process.env.STAFF_CORRESPONDENCE_WIRE_FILE;
const responseFile = process.env.STAFF_CORRESPONDENCE_RESPONSE_FILE;
describe.skipIf(!responseFile)('Velt large-message response proof', () => {
  it('accepts the actual sanitized25-message output through the Portal contract', () => {
    const response = JSON.parse(readFileSync(responseFile!, 'utf8'));
    const context = parseStaffCorrespondence(response, '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333', Date.parse(response.context.observedAt));
    expect(context.messages).toHaveLength(25);
    expect(context.messages?.some(message=>message.truncated)).toBe(true);
  });
});
describe.skipIf(!wireFile)('Portal sender wire proof', () => {
  it('exports exact signed bytes and accepts the request-bound response', async () => {
    const config = { origin: 'https://velt.example.test', secret: 'a'.repeat(64), includeMessageLineage: true, snapshotsEnabled: true };
    const snapshot = { identityHash: 'b'.repeat(64), customerEmail: 'customer@example.test', refresh: false };
    const projectId = '11111111-1111-4111-8111-111111111111';
    const actorId = '22222222-2222-4222-8222-222222222222';
    const requestId = '33333333-3333-4333-8333-333333333333';
    const now = Date.parse(correspondenceFixture.observedAt);
    const fetcher: typeof fetch = async (url, init) => {
      writeFileSync(wireFile!, JSON.stringify({ url: String(url), headers: Object.fromEntries(new Headers(init?.headers)), body: init?.body, now, expected: { projectId, actorId, requestId, includeMessageLineage: true, snapshot } }));
      return Response.json({ schemaVersion: 'sanctuary.staff-correspondence.v1', projectId, requestId, context: correspondenceFixture });
    };
    const result = await readStaffCorrespondence(config, { projectId, actorId, snapshot }, new AbortController().signal,
      { fetcher, now: () => now, nonce: () => requestId });
    expect(result).toEqual(correspondenceFixture);
  });
});
