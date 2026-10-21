import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/seo-landing/SeoLandingPage', () => ({ default: () => null }));
import Page, { metadata } from './page';
import { PITCHED_ROUTE, pitchedPergolasConfig } from './content';

describe('Pitched guide enquiry handoff', () => {
  it('keeps the indexed guide URL and canonical residential enquiry owner', async () => {
    const page = await Page({});
    expect(page.props.config).toBe(pitchedPergolasConfig);
    expect(page.props.enquiryContext).toEqual({ enquiryType: 'residential', sourcePath: PITCHED_ROUTE, sourceComponent: 'embedded_form' });
    expect(metadata.alternates?.canonical).toBe(PITCHED_ROUTE);
    expect(page.props.presentation.hero).toBeTruthy();
    expect(page.props.presentation.content).toBeTruthy();
  });

  it.each(['residential', 'commercial', 'professional'])('preserves a valid %s project reference and source', async audience => {
    const page = await Page({ searchParams: Promise.resolve({ enquiry_type: audience, source_path: '/projects/tindalls-bay-pavilion', source_component: 'project_cta', source_project: 'tindalls-bay-pavilion' }) });
    expect(page.props.enquiryContext).toEqual({ enquiryType: audience, sourcePath: '/projects/tindalls-bay-pavilion', sourceComponent: 'project_cta', sourceProject: 'tindalls-bay-pavilion' });
    expect(page.props.customerDesign).toBeUndefined();
  });

  it('retains valid guided attribution without inventing a recommendation', async () => {
    const page = await Page({ searchParams: Promise.resolve({ source_experience: 'guided-home-v1', source_pathway: 'bespoke', source_focus: 'structure', source_path: '/', source_component: 'pathway' }) });
    expect(page.props.enquiryContext).toMatchObject({ sourceExperience: 'guided-home-v1', sourcePathway: 'bespoke', sourceFocus: 'structure' });
    expect(page.props.guidedContext).toBeUndefined();
  });

  it('rejects unsafe source paths and unrecognised references', async () => {
    const page = await Page({ searchParams: Promise.resolve({ enquiry_type: 'unknown', source_path: 'https://example.invalid/private', source_component: 'unknown', source_project: 'unknown', source_product: 'unknown' }) });
    expect(page.props.enquiryContext).toEqual({ enquiryType: 'residential', sourcePath: PITCHED_ROUTE, sourceComponent: 'embedded_form' });
  });
});
