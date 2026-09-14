import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.query }));
import ProjectEnquiryReceiptPanel from './ProjectEnquiryReceiptPanel';

it('shows the submitted price and preferences without trusting an external reopen URL', () => {
  mocks.query.mockReturnValue({data:{receipts:[{id:'1',submittedAt:'2026-09-14T00:00:00Z',receiptFrozen:true,requestType:'site-measure',customerBrief:{summary:'Original design',reopenPath:'https://evil.test'},preferences:{preferredTiming:'Summer',budgetPreference:'not-sure'},submittedPrice:{includesGst:true,baseRange:{lowIncGst:12000,highIncGst:12000},blindsRange:{lowIncGst:2000,highIncGst:2500}},emailStatus:'SENT',message:'<script>bad</script>'}]}});
  const html = renderToStaticMarkup(<ProjectEnquiryReceiptPanel projectId="1" host="local" />);
  expect(html).toContain('Original design'); expect(html).toContain('$12,000 including GST');
  expect(html).toContain('$2,000–$2,500 including GST'); expect(html).toContain('Summer');
  expect(html).toContain('Not sure yet'); expect(html).not.toContain('evil.test'); expect(html).not.toContain('<script>');
});
it('labels legacy records rather than inventing a submitted price', () => {
  mocks.query.mockReturnValue({data:{receipts:[{id:'1',submittedAt:'2026-09-14T00:00:00Z',receiptFrozen:false,customerBrief:null,preferences:null,submittedPrice:null,emailStatus:null}]}});
  const html = renderToStaticMarkup(<ProjectEnquiryReceiptPanel projectId="1" host="local" />);
  expect(html).toContain('Legacy enquiry'); expect(html).toContain('To be confirmed');
});

it('shows the frozen selling breakdown including accessories', () => {
  mocks.query.mockReturnValue({ data: { receipts: [{ id: '1', submittedAt: '2026-09-14T00:00:00Z', receiptFrozen: true,
    submittedPrice: { includesGst: true, baseRange: { lowIncGst: 15000, highIncGst: 15000 }, breakdown: [
      { label: 'Pergola, roof & ceiling', amountIncGst: 12000 }, { label: 'Front 1 · Ziptrak', amountIncGst: 3000 }] } }] } });
  const html = renderToStaticMarkup(<ProjectEnquiryReceiptPanel projectId="1" host="local" />);
  expect(html).toContain('Submitted price breakdown'); expect(html).toContain('Ziptrak');
  expect(html).toContain('$15,000 including GST'); expect(html).toContain('$3,000 including GST');
});
