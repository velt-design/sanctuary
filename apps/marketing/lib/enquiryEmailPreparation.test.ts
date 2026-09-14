import { expect, it, vi } from 'vitest';
import { prepareEnquiryEmail } from './enquiryEmailPreparation';

function input(): Parameters<typeof prepareEnquiryEmail>[1] {
  return {
    enquiryRow: { id: 'submission-1' }, enquiryType: 'residential', name: 'Taylor',
    email: 'taylor@example.test', phoneRaw: '021 123 4567', suburb: '1 Test Road',
    message: 'Please call', company: '', page: '/contact',
    customerBrief: { version: 1, audience: 'residential', designStatus: 'help' },
    payload: { projectDetails: { projectRole: 'Owner\noccupier' } }, utm: { utm_source: 'search' },
    files: [{ path: 'pending/test/plan.pdf', name: 'plan.pdf', size: 3 }],
    verifiedStoredAttachments: [{ path: 'pending/test/plan.pdf', filename: 'plan.pdf', type: 'application/pdf', size: 3, content: Buffer.from('PDF') }],
    effectiveWidthM: 6, effectiveDepthM: 3, effectiveHeightM: null, effectiveStyle: 'gable',
    effectiveRoofMaterials: ['acrylic', 'timber'], addOns: { lighting: 'yes' },
    budgets: { baseRange: { lowIncGst: 12000, highIncGst: 12000 }, blindsRange: null, budgetBasis: null },
    verifiedSimpleCover: null,
  };
}

it('preserves verified attachments, contact details and installed estimate during preparation', async () => {
  const result = await prepareEnquiryEmail({} as never, input());
  expect(result.emailPayload).toMatchObject({
    leadId: 'submission-1', phone: '021 123 4567', suburb: '1 Test Road', projectRole: 'Owner occupier',
    style: 'Gable', roof: 'Both', addons: ['Lighting'], utmSource: 'search',
    baseRange: { lowIncGst: 12000, highIncGst: 12000 }, filesReceivedCount: 1,
  });
  expect(result.resolvedAttachments.attachments).toEqual([{ filename: 'plan.pdf', content: Buffer.from('PDF').toString('base64') }]);
  expect(typeof result.variables.submittedAt).toBe('string');
});


it.each([8 * 1024 * 1024, 8 * 1024 * 1024 + 1])('handles the inline boundary at %i bytes', async total => {
  const request = input();
  const bytes = Buffer.alloc(total, 42);
  request.files = [{path: 'pending/test/plan.pdf', name: 'plan.pdf', size: total}];
  request.verifiedStoredAttachments = [{path: 'pending/test/plan.pdf', filename: 'plan.pdf', type: 'application/pdf', size: total, content: bytes}];
  const createSignedUrl = vi.fn().mockResolvedValue({data: {signedUrl: 'https://storage.example.test/signed-plan'}, error: null});
  const from = vi.fn().mockReturnValue({createSignedUrl});
  const result = await prepareEnquiryEmail({storage: {from}} as never, request);
  expect(result.emailPayload.filesReceivedCount).toBe(1);
  if (total === 8 * 1024 * 1024) {
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(Buffer.from(result.resolvedAttachments.attachments[0].content, 'base64').equals(bytes)).toBe(true);
    expect(result.resolvedAttachments.attachmentLinks).toEqual([]);
  } else {
    expect(from).toHaveBeenCalledWith('enquiry-attachments');
    expect(createSignedUrl).toHaveBeenCalledWith('pending/test/plan.pdf', 604800);
    expect(result.resolvedAttachments.attachments).toEqual([]);
    expect(result.emailPayload.attachmentLinks).toEqual([{name: 'plan.pdf', url: 'https://storage.example.test/signed-plan'}]);
  }
});

it.each(['error', 'throw'])('retains the enquiry file count when link signing fails: %s', async failure => {
  const request = input();
  request.files = [{path: 'pending/test/large.pdf', name: 'large.pdf', size: 9 * 1024 * 1024}];
  request.verifiedStoredAttachments = [];
  const createSignedUrl = failure === 'throw'
    ? vi.fn().mockRejectedValue(new Error('Storage unavailable'))
    : vi.fn().mockResolvedValue({data: null, error: {message: 'Storage unavailable'}});
  const result = await prepareEnquiryEmail({storage: {from: () => ({createSignedUrl})}} as never, request);
  expect(result.emailPayload.filesReceivedCount).toBe(1);
  expect(result.resolvedAttachments).toEqual({attachments: [], attachmentLinks: []});
  expect(JSON.stringify(result)).not.toContain('Storage unavailable');
});
