import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readProjectCorrespondenceIdentity } from './projectCorrespondenceIdentity';

const project = '11111111-1111-4111-8111-111111111111';
const customer = '22222222-2222-4222-8222-222222222222';
function database(data: unknown, error: unknown = null) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}
describe('minimal correspondence identity', () => {
  it('preserves canonical identity hashing inputs without loading unrelated owner/work data', async () => {
    const db = database({ id: project, contact_id: customer, contact: [{ email: ' person@example.test ' }] });
    expect(await readProjectCorrespondenceIdentity(`proj_${project}`, db.client)).toEqual({
      project: { id: `proj_${project}`, contactId: `ct_${customer}`, contactEmail: 'person@example.test' },
    });
    expect(db.query.select).toHaveBeenCalledWith('id,contact_id,contact:contacts(email)');
    expect(db.query.eq).toHaveBeenCalledWith('id', project);
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it('does not cache access or identity between reads', async () => {
    const db = database({ id: project, contact_id: customer, contact: { email: 'one@example.test' } });
    await readProjectCorrespondenceIdentity(project, db.client);
    db.query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await readProjectCorrespondenceIdentity(project, db.client)).toBeNull();
    expect(db.query.maybeSingle).toHaveBeenCalledTimes(2);
  });
  it('fails closed for database errors and mismatched project rows', async () => {
    await expect(readProjectCorrespondenceIdentity(project, database(null, { message: 'denied' }).client)).rejects.toThrow();
    await expect(readProjectCorrespondenceIdentity(project, database({ id: customer, contact_id: null, contact: null }).client)).rejects.toThrow();
  });
  it('keeps missing contact/email as missing evidence', async () => {
    expect(await readProjectCorrespondenceIdentity(project, database({ id: project, contact_id: null, contact: null }).client))
      .toEqual({ project: { id: `proj_${project}`, contactId: null, contactEmail: null } });
  });
});
