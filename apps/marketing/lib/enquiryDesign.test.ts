import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCustomerBrief } from './enquiryDesign';
import { customerDesignUrl } from './enquiryDesignLink';
import { DEFAULT_PREVIEW_DRAFT, parsePreviewDraft } from '../components/configurator-prototype/previewDraft';
import { parsePreviewDesign } from '../components/configurator-prototype/previewShare';
import { selectEnquiryEmailTemplate } from './enquiryEmailPolicy';
import { enquiryExperienceFixtures } from './enquiryExperienceFixtures';
import { renderWebsiteAutoresponder } from './websiteAutoresponder';
import { buildContactDesignBrief } from '../app/contact/contactDesignBrief';

afterEach(() => vi.unstubAllEnvs());
describe('submitted design boundary', () => {
  it.each(['mono', 'gable', 'box'] as const)('keeps freestanding %s summaries consistent with the saved and reopened design', family => {
    const design = parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, roof: { family, orientation: 'parallel', infills: false, attachmentIntent: 'freestanding' } })!;
    const brief = buildCustomerBrief('residential', design);
    expect(brief.summary).toContain('Freestanding, no house connection');
    expect(brief.summary).not.toMatch(/Facade|Fascia|Soffit|parallel to house/);
    expect(brief.design).toEqual(design);
    expect(parsePreviewDesign(brief.reopenPath!.split('#design=')[1])).toEqual(design);
    const contact = buildContactDesignBrief({ ...design, result: null });
    expect(contact.description).toContain('Freestanding, no house connection');
    if (family === 'gable') expect(brief.summary).toContain('Ridge across width');
  });
  it('describes a freestanding ridge along projection without an invented house attachment', () => {
    const design = parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, roof: { family: 'gable', orientation: 'away', infills: false, attachmentIntent: 'freestanding' } })!;
    const brief = buildCustomerBrief('residential', design);
    expect(brief.summary).toContain('Ridge along projection');
    expect(brief.summary).not.toMatch(/Dutch-gable|fascia attachment|away from house/);
  });
  it('retains uncertainty instead of reporting the fallback attachment as the customer choice', () => {
    const design = parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, roof: { ...DEFAULT_PREVIEW_DRAFT.roof, attachmentIntent: 'unsure' } })!;
    expect(buildCustomerBrief('residential', design).summary).toContain('House connection not sure');
    expect(buildCustomerBrief('residential', design).summary).not.toContain('Facade attachment');
    expect(buildCustomerBrief('residential', DEFAULT_PREVIEW_DRAFT).summary).toContain('Facade attachment');
  });
  it('renders the corrected saved summary in customer HTML and plain text', async () => {
    const fixture = enquiryExperienceFixtures()[0];
    const design = parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, roof: { family: 'gable', orientation: 'parallel', infills: false, attachmentIntent: 'freestanding' } })!;
    const customerBrief = buildCustomerBrief('residential', design);
    const rendered = await renderWebsiteAutoresponder('EMAIL_WEBSITE_ENQUIRY_configured_V2', { ...fixture.variables, customerBrief });
    expect(rendered.html).toContain('Freestanding, no house connection');
    expect(rendered.text).toContain('Ridge across width');
    expect(rendered.text).not.toContain('Facade attachment');
    if (process.env.ENQUIRY_RENDER_ARTIFACTS === 'true') {
      const { writeFileSync } = await import('node:fs');
      writeFileSync('artifacts/configurator-preview/freestanding-summary.html', rendered.html);
    }
  });
  it('keeps help separate from bespoke and preserves a started bespoke design', () => {
    expect(buildCustomerBrief('residential', undefined, 'help').designStatus).toBe('help');
    const bespoke = buildCustomerBrief('residential', DEFAULT_PREVIEW_DRAFT, 'bespoke');
    expect(bespoke.designStatus).toBe('bespoke');
    expect(bespoke.design).toEqual(DEFAULT_PREVIEW_DRAFT);
    expect(bespoke.reopenPath).toContain('#design=');
    expect(buildCustomerBrief('residential', DEFAULT_PREVIEW_DRAFT, 'arbitrary').designStatus).toBe('configured');
  });
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
    expect(customerDesignUrl({ ...brief, reopenPath: 'https://evil.test' })).toBeUndefined();
    expect(customerDesignUrl(brief)).toMatch(/^https:\/\/www.sanctuarypergolas.co.nz\/configurator-preview/);
  });
  it('keeps production on existing emails until explicitly activated', () => {
    vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('WEBSITE_ENQUIRY_EXPERIENCE_V2', '');
    const brief = buildCustomerBrief('residential', DEFAULT_PREVIEW_DRAFT);
    expect(selectEnquiryEmailTemplate('residential', brief)).toBe('EMAIL_WEBSITE_AUTORESPONDER_RES_V1');
    vi.stubEnv('WEBSITE_ENQUIRY_EXPERIENCE_V2', 'true');
    expect(selectEnquiryEmailTemplate('residential', brief)).toBe('EMAIL_WEBSITE_ENQUIRY_configured_V2');
  });
});

it('renders all five journeys with distinct subjects, separated notes and no invented estimate', async () => {
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
  expect(subjects.size).toBe(5);
});
