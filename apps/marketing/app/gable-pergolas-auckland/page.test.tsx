import { describe, expect, it, vi } from 'vitest';
// Inspect the server route's handoff separately from the shared form renderer,
// whose interaction contracts are covered by its own suite and browser journeys.
vi.mock('../../components/seo-landing/SeoLandingPage', () => ({ default: () => null }));
import Page, { metadata } from './page';
import { GABLE_ROUTE, gablePergolasConfig } from './content';

describe('Gable guide enquiry handoff', () => {
  it('keeps the governed guide, default enquiry and indexed URL', async () => {
    const page = await Page({});
    expect(page.props.config).toBe(gablePergolasConfig);
    expect(page.props.enquiryContext).toEqual({ enquiryType: 'residential', sourcePath: GABLE_ROUTE, sourceComponent: 'embedded_form' });
    expect(metadata.alternates?.canonical).toBe(GABLE_ROUTE);
    expect(page.props.presentation.hero).toBeTruthy();
    expect(page.props.presentation.content).toBeTruthy();
  });

  it.each(['residential', 'commercial', 'professional'])('retains a valid %s source and reference without inventing a design', async audience => {
    const page = await Page({ searchParams: Promise.resolve({ enquiry_type: audience, source_path: '/projects/dairy-flat-estate', source_component: 'project_cta', source_project: 'dairy-flat-estate' }) });
    expect(page.props.enquiryContext).toEqual({ enquiryType: audience, sourcePath: '/projects/dairy-flat-estate', sourceComponent: 'project_cta', sourceProject: 'dairy-flat-estate' });
    expect(page.props.customerDesign).toBeUndefined();
  });

  it('carries validated guided attribution without fabricating a guided recommendation', async () => {
    const page = await Page({ searchParams: Promise.resolve({ source_experience: 'guided-home-v1', source_pathway: 'bespoke', source_focus: 'structure', source_path: '/', source_component: 'pathway' }) });
    expect(page.props.enquiryContext).toMatchObject({ sourceExperience: 'guided-home-v1', sourcePathway: 'bespoke', sourceFocus: 'structure' });
    expect(page.props.guidedContext).toBeUndefined();
  });

  it('discards unknown references and unsafe source paths', async () => {
    const page = await Page({ searchParams: Promise.resolve({ enquiry_type: 'unknown', source_path: 'https://example.invalid/private', source_component: 'unknown', source_project: 'not-a-project', source_product: 'not-a-product' }) });
    expect(page.props.enquiryContext).toEqual({ enquiryType: 'residential', sourcePath: GABLE_ROUTE, sourceComponent: 'embedded_form' });
  });
});
