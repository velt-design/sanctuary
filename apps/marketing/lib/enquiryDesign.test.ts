import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCustomerBrief, customerDesignUrl } from './enquiryDesign';
import { DEFAULT_PREVIEW_DRAFT, parsePreviewDraft } from '../components/configurator-prototype/previewDraft';
import { parsePreviewDesign } from '../components/configurator-prototype/previewShare';
import { selectEnquiryEmailTemplate } from './enquiryEmailPolicy';
import { enquiryExperienceFixtures } from './enquiryExperienceFixtures';
import { renderWebsiteAutoresponder } from './websiteAutoresponder';

afterEach(() => vi.unstubAllEnvs());
describe('submitted design boundary', () => {
  it('freezes a reopenable design independently of audience and later editing', () => {
    const source = structuredClone(DEFAULT_PREVIEW_DRAFT);
    const brief = buildCustomerBrief('commercial', source);
    source.input.widthMm = 9000;
    expect(brief.audience).toBe('commercial');
    expect(brief.designStatus).toBe('configured');
    expect(parsePreviewDesign(brief.reopenPath!.split('#design=')[1])).toEqual(brief.design);
    expect(brief.design?.input.widthMm).not.toBe(9000);
  });
  it.each([
    { ...DEFAULT_PREVIEW_DRAFT, price: 1 },
    { ...DEFAULT_PREVIEW_DRAFT, version: 2 },
    { ...DEFAULT_PREVIEW_DRAFT, input: { ...DEFAULT_PREVIEW_DRAFT.input, projectionMm: 999999 } },
    { ...DEFAULT_PREVIEW_DRAFT, unexpected: 'x'.repeat(12001) },
  ])('rejects invalid, unrecognised or oversized selections', value => {
    expect(() => buildCustomerBrief('residential', value)).toThrow();
  });
  it('accepts normalised complex roof selections and excludes untrusted link destinations', () => {
    const design = parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, roof: { family: 'gable', orientation: 'parallel', infills: true, finish: { material: 'combination', layout: 'central', acrylicBays: 2, profile: 'tray', trayWidth: 400 } } });
    expect(design).not.toBeNull();
    const brief = buildCustomerBrief('professional', JSON.parse(JSON.stringify(design)));
    expect(customerDesignUrl({ ...brief, reopenPath: 'https://evil.test' })).toMatch(/^https:\/\/www.sanctuarypergolas.co.nz\/configurator-preview/);
  });
  it('keeps production on existing emails until explicitly activated', () => {
    vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('WEBSITE_ENQUIRY_EXPERIENCE_V2', '');
    const brief = buildCustomerBrief('residential', DEFAULT_PREVIEW_DRAFT);
    expect(selectEnquiryEmailTemplate('residential', brief)).toBe('EMAIL_WEBSITE_AUTORESPONDER_RES_V1');
    vi.stubEnv('WEBSITE_ENQUIRY_EXPERIENCE_V2', 'true');
    expect(selectEnquiryEmailTemplate('residential', brief)).toBe('EMAIL_WEBSITE_ENQUIRY_configured_V2');
  });
});

it('renders all four journeys with distinct subjects, separated notes and no invented estimate', async () => {
  const subjects = new Set<string>();
  for (const fixture of enquiryExperienceFixtures()) {
    const rendered = await renderWebsiteAutoresponder(fixture.templateId, { ...fixture.variables });
    subjects.add(rendered.subject);
    expect(rendered.text).toContain(fixture.variables.message);
    expect(rendered.text).not.toContain('$0');
    expect(rendered.text.match(new RegExp(fixture.variables.message!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    if (fixture.variables.customerBrief?.design) expect(rendered.html).toContain('View your submitted pergola');
    if (process.env.ENQUIRY_RENDER_ARTIFACTS === 'true') {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`artifacts/configurator-preview/${fixture.fileBaseName}.html`, rendered.html);
    }
  }
  expect(subjects.size).toBe(4);
});
