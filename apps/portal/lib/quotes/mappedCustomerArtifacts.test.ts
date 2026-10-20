// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Estimate } from '@/lib/types/estimate';
import type { QuoteVersionDetail } from './types';
import { assertQuoteEstimateMappingReady, buildQuoteLineItemsFromEstimate } from './mapping';
import { DEFAULT_QUOTE_INTRO, DEFAULT_QUOTE_TERMS } from './defaults';
import { applyPaymentScheduleToTerms, buildDefaultQuotePaymentSchedule, paymentScheduleCompatibilityDepositPercent } from './paymentSchedule';
import { totalsFromLineItems } from './utils';
import { generateQuotePdfBytesWithLayout } from './pdf';
import { buildQuotePreviewBasePayload, renderQuotePreviewFromBasePayload } from './renderArtifacts';

/** Synthetic costing snapshot, composed through the same mapping/payment/render owners as draft creation. */
function estimate(): Estimate {
  return {
    id: 'est-workflow-synthetic', projectId: 'proj-workflow-synthetic', createdAt: '2026-10-20T00:00:00Z', status: 'draft',
    inputs: {
      schemaVersion: 'v2', projectName: 'Example courtyard', quoteRef: '', access: 'normal', height: 'single_storey',
      travelExGst: '0', extrasAllowanceExGst: '0', quoteDiscountPct: '7.5',
      pergolas: [{ id: 'pergola-1', label: 'Courtyard pergola' }],
      modules: [{
        pergolaId: 'pergola-1', pergolaStyle: 'pitched', roofMaterial: 'acrylic', extrusionColour: 'Black',
        powdercoatStandardColour: '', powdercoatIsCustom: false, powdercoatCustomColour: '', roofPitchDeg: '',
        postCount: '4', lengthM: '6', projectionM: '3', hipCornerLengthBM: '0', hipCornerProjectionBM: '0',
        houseConnectionType: 'soffit', postConnectionType: 'deck_bracket',
      }],
      blinds: { items: [{ id: 'blind-1', label: 'Courtyard blind', system: 'ZIPTRAK', widthMm: '2000', coverLengthMm: '2400', fabric: 'MESH', motorised: 'NONE', rollCover: 'NONE' }] },
    },
    derived: {},
    outputs: {
      materials: { lines: [], totals: { materials_ex_gst: 0 } },
      install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
      totals: { cost_ex_gst: 0, cost_inc_gst: 0, warnings: [], notes_and_warnings: [] }, warnings: [],
      pricing_policy: { customer_price_uplift_pct: 21 },
      pergolas: [{ id: 'pergola-1', totals: { cost_ex_gst: 1234.57 } }],
      additional_aluminium: { item_count: 2, totals: { cost_ex_gst: 78.93 } },
    },
    configVersions: { pricebook: 'synthetic', installActions: 'synthetic', overheads: 'synthetic', rules: 'synthetic', manifest: 'synthetic' },
  } as unknown as Estimate;
}

describe('fresh customer artifacts from a mapped estimate', () => {
  it('retains exact priced scope while keeping internal aluminium and generated jargon out of customer output', async () => {
    const fetchGuard = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline artifact test must not fetch'));
    try {
      const source = estimate();
      const original = JSON.stringify(source);
      const mapping = buildQuoteLineItemsFromEstimate(source);
      assertQuoteEstimateMappingReady(mapping);
      const items = mapping.items.map((item, index) => ({ ...item, id: `line-${index}`, sortOrder: index }));
      const totals = totalsFromLineItems(items);
      const paymentTerms = buildDefaultQuotePaymentSchedule({
        quoteTotalIncGstCents: totals.totalIncGstCents, approvalRequirement: mapping.approvalRequirement, approvalIncGstCents: mapping.approvalIncGstCents,
      });
      const detail: QuoteVersionDetail = {
        id: 'qv-workflow', quoteId: 'quote-workflow', projectId: source.projectId, quoteRef: 'Q-SYNTHETIC', versionNumber: 1,
        status: 'DRAFT', updatedAt: source.createdAt, createdAt: source.createdAt, createdBy: 'synthetic', commercialRevision: 1,
        isCurrentDraft: true, deliveryPreparedAt: null, pricingSource: 'calculator_live',
        sourceEstimateVersionId: source.id, sourceEstimateVersionLabel: 'Estimate v1', revisedFromQuoteVersionId: null,
        depositPercent: paymentScheduleCompatibilityDepositPercent(paymentTerms, totals.totalIncGstCents), paymentTerms,
        expiresAt: '2026-11-19', reference: 'Example courtyard', customerName: 'Taylor Example',
        introText: DEFAULT_QUOTE_INTRO, termsText: applyPaymentScheduleToTerms(DEFAULT_QUOTE_TERMS, paymentTerms),
        totals, pdfFileId: null, renderHash: null, lineItems: items, sendLogs: [],
        contact: { name: 'Taylor Example', email: 'taylor@example.test', phone: '021 555 0101' },
        project: { name: 'Example courtyard', siteAddress: '12 Example Road, Auckland', region: 'Auckland', quoteRef: null },
      };
      const withoutAluminium = buildQuoteLineItemsFromEstimate({ ...source, outputs: { ...source.outputs, additional_aluminium: undefined } } as Estimate);
      const aluminiumOnly = buildQuoteLineItemsFromEstimate({ ...source, inputs: { ...source.inputs, pergolas: [], modules: [], blinds: { items: [] } }, outputs: { ...source.outputs, pergolas: [] } } as Estimate);
      expect(mapping.coreTotalIncCents).toBe(withoutAluminium.coreTotalIncCents + aluminiumOnly.coreTotalIncCents);
      expect(items).toHaveLength(2);
      expect(items[0].description).toContain('Courtyard pergola');
      expect(items[1].description).toContain('Courtyard blind');
      expect(totals.totalIncGstCents).toBe(items.reduce((sum, item) => sum + item.lineTotalIncGstCents, 0));
      const customerCopy = [detail.introText, detail.termsText, ...items.map((item) => item.description)].join('\n');
      expect(customerCopy).not.toMatch(/—|additional aluminium|stock length|margin|uplift|cost_ex|currently agreed/i);
      const { bytes, layout } = await generateQuotePdfBytesWithLayout(detail);
      expect(layout.pages, JSON.stringify(layout)).toHaveLength(1);
      expect(layout.pages[0].contentBottomY).toBeGreaterThanOrEqual(92);
      expect(layout.pages[0].termLineCount).toBe(3);
      const base = buildQuotePreviewBasePayload({ detail, quoteAcceptUrl: 'https://preview.invalid/quote/synthetic', expiresAtLabel: '19 Nov 2026', logoUrl: 'http://127.0.0.1:3162/email-logo.png' });
      const email = await renderQuotePreviewFromBasePayload(base, { to: ['taylor@example.test'], subject: 'Your Sanctuary quote', personalNote: '', attachmentNames: [] });
      expect(bytes.byteLength).toBeGreaterThan(10_000);
      expect(email.text).not.toMatch(/—|additional aluminium|stock length|margin|uplift/i);
      expect(email.html).not.toMatch(/<(?:b|strong)(?:\s|>)/i);
      expect(JSON.stringify(source)).toBe(original);
      expect(fetchGuard).not.toHaveBeenCalled();
      if (process.env.QUOTE_ARTIFACT_OUTPUT_DIR) {
        const dir = process.env.QUOTE_ARTIFACT_OUTPUT_DIR;
        await mkdir(dir, { recursive: true });
        await Promise.all([
          writeFile(path.join(dir, 'mapped-quote.pdf'), bytes),
          writeFile(path.join(dir, 'mapped-email.html'), email.html),
          writeFile(path.join(dir, 'mapped-email.txt'), email.text ?? ''),
          writeFile(path.join(dir, 'mapped-quote.json'), JSON.stringify(detail, null, 2)),
        ]);
      }
    } finally { fetchGuard.mockRestore(); }
  }, 15_000);
});
