import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/seo-landing/SeoLandingPage', () => ({ default: () => null }));
import Page, { metadata } from './page';
import { commercialPergolasConfig as config } from './content';

describe('Commercial guide canonical enquiry handoff', () => {
  it('retains the commercial URL, shared form and complete optional brief', async () => {
    const page = await Page({});
    expect(page.props.config).toBe(config);
    expect(page.props.enquiryContext).toEqual({ enquiryType: 'commercial', sourcePath: config.route, sourceComponent: 'embedded_form' });
    expect(metadata.alternates?.canonical).toBe(config.route);
    expect(config.form.briefFields.map(field => field.name)).toEqual(['siteAddress', 'projectStage', 'professionalInvolvement', 'operatingConstraints']);
    expect(page.props.presentation.hero).toBeTruthy();
    expect(page.props.presentation.content).toBeTruthy();
  });

  it.each(['residential', 'commercial', 'professional'])('retains validated %s source context', async audience => {
    const page = await Page({ searchParams: Promise.resolve({ enquiry_type: audience, source_path: '/projects/goodhome-commercial-terrace', source_component: 'project_cta', source_project: 'goodhome-commercial-terrace' }) });
    expect(page.props.enquiryContext).toEqual({ enquiryType: audience, sourcePath: '/projects/goodhome-commercial-terrace', sourceComponent: 'project_cta', sourceProject: 'goodhome-commercial-terrace' });
  });

  it('preserves the guided commercial result and its attribution precedence', async () => {
    const page = await Page({ searchParams: Promise.resolve({ sector: 'workplace', role: 'collaborate', enquiry_type: 'professional', source_path: '/projects/goodhome-commercial-terrace' }) });
    expect(page.props.guidedContext).toMatchObject({ resultId: 'commercial', focusId: 'collaborate' });
    expect(page.props.enquiryContext).toBe(page.props.guidedContext?.enquiryContext);
    expect(page.props.enquiryContext).toMatchObject({ enquiryType: 'commercial', sourceExperience: 'guided-home-v1' });
  });

  it('rejects invalid source references and off-site paths', async () => {
    const page = await Page({ searchParams: Promise.resolve({ enquiry_type: 'unknown', source_path: 'https://example.invalid/private', source_project: 'unknown', source_product: 'unknown', source_component: 'unknown' }) });
    expect(page.props.enquiryContext).toEqual({ enquiryType: 'commercial', sourcePath: config.route, sourceComponent: 'embedded_form' });
  });
});
