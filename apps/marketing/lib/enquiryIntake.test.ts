import { describe, expect, it, vi } from 'vitest';
import {
  createMarketingEnquiryIntake,
  MarketingEnquiryIntakeError,
} from './enquiryIntake';

const SUBMISSION_ID = '04d64c8e-9816-4a67-b8e4-f748401fc75c';
const ORIGINAL_IDS = {
  contact_id: 'contact-original',
  project_id: 'project-original',
  enquiry_request_id: 'enquiry-original',
};

function callWith(rpc: ReturnType<typeof vi.fn>) {
  return createMarketingEnquiryIntake({ rpc } as any, {
    submissionId: SUBMISSION_ID,
    uploadSessionToken: 'bound-upload-token',
    payload: { name: 'Taylor' },
  });
}

describe('createMarketingEnquiryIntake', () => {
  it('returns the original records on a retry', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ ...ORIGINAL_IDS, already_existed: false }], error: null })
      .mockResolvedValueOnce({ data: [{ ...ORIGINAL_IDS, already_existed: true }], error: null });

    const first = await callWith(rpc);
    const retry = await callWith(rpc);

    expect(first).toMatchObject({ enquiryRequestId: 'enquiry-original', alreadyExisted: false });
    expect(retry).toMatchObject({
      contactId: first.contactId,
      projectId: first.projectId,
      enquiryRequestId: first.enquiryRequestId,
      alreadyExisted: true,
    });
  });

  it('maps concurrent duplicate submissions to one original result', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ ...ORIGINAL_IDS, already_existed: rpc.mock.calls.length > 1 }],
      error: null,
    }));

    const results = await Promise.all([callWith(rpc), callWith(rpc)]);
    expect(new Set(results.map((result) => result.enquiryRequestId))).toEqual(new Set(['enquiry-original']));
    expect(results.filter((result) => result.alreadyExisted)).toHaveLength(1);
  });

  it('turns transactional failures into a stable public-safe domain error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates secret_internal_index' },
    });

    await expect(callWith(rpc)).rejects.toEqual(new MarketingEnquiryIntakeError());
    await expect(callWith(rpc)).rejects.not.toThrow(/secret_internal_index/);
  });
});
