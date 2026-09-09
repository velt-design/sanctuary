import assert from 'node:assert/strict';

// Called only with clients for a harness-owned disposable database.
export async function verifyEnquiryIdentitySnapshot(admin, reader) {
  await admin`
    insert into public.enquiry_requests(id,submission_id,enquiry_type,add_ons,files,source,utm,raw_payload,created_at,updated_at)
    values('99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000002','residential','{}','[]','website','{}','{}','2020-01-01T12:00:00Z',now())
  `;
  await admin`select public.marketing_enquiry_email_begin('99000000-0000-4000-8000-000000000003','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000002',repeat('a',64))`;
  const read = (sql) => sql`select receipt_state, outcome from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-01-02T00:00:00Z','{}')`;
  await reader.begin('read only isolation level repeatable read', async (transaction) => {
    const before = await read(transaction);
    assert.deepEqual(before.map((row) => [row.receipt_state, row.outcome]), [['missing', 'unknown']]);
    await admin`select public.marketing_enquiry_email_record('99000000-0000-4000-8000-000000000003',repeat('a',64),'accepted','synthetic-concurrent-api-id','RESEND_ACCEPTED')`;
    const sameSnapshot = await read(transaction);
    assert.deepEqual(sameSnapshot, before);
  });
  const nextSnapshot = await read(reader);
  assert.deepEqual(nextSnapshot.map((row) => [row.receipt_state, row.outcome]), [['recorded', 'accepted']]);
  await reader`set default_transaction_read_only=off`;
  for (const table of ['public.enquiry_requests', 'private.marketing_enquiry_email_intents', 'private.marketing_enquiry_email_receipts']) {
    await assert.rejects(reader.unsafe(`select * from ${table}`), (error) => error.code === '42501');
  }
  const grants = await reader`select has_table_privilege(current_user,'praxis_reporting.enquiry_identities_v1','INSERT,UPDATE,DELETE,TRUNCATE') as writable`;
  assert.equal(grants[0].writable, false);
  await assert.rejects(reader`delete from praxis_reporting.enquiry_identities_v1`, (error) => ['42501', '55000'].includes(error.code));
}
