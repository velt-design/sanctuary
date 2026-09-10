import type { WebsiteAutoresponderPreviewFixture } from './websiteAutoresponderPreviewFixtures';
import { ENQUIRY_EXPERIENCES, type EnquiryExperience } from './enquiryExperience';
import type { CustomerBrief } from './enquiryDesignContract';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';

export type EnquiryExperienceVariant = `experience-${EnquiryExperience}`;
export function enquiryExperienceFixtures(): WebsiteAutoresponderPreviewFixture[] {
  return (Object.keys(ENQUIRY_EXPERIENCES) as EnquiryExperience[]).map(experience => {
    const audience = experience === 'configured' || experience === 'bespoke' ? 'residential' : experience;
    const design: PreviewDraft | undefined = experience === 'configured' || experience === 'commercial'
      ? { version: 1, input: { widthMm: 5400, projectionMm: 3200, level: 'ground', connection: 'facade' }, roof: { family: 'mono', orientation: 'parallel', infills: false } } : undefined;
    // Static, synthetic fixture: portal email previews must not import the marketing geometry solver.
    const customerBrief: CustomerBrief = {
      version: 1, audience, designStatus: design ? 'configured' : 'bespoke',
      ...(design ? { design, summary: 'Pitched pergola · 5.4 m wide × 3.2 m projection · Acrylic roof · Facade attachment · Ground level', reopenPath: '/configurator-preview?open=1#design=1.mono.5400.3200.ground.facade.parallel.0' } : {}),
    };
    return {
      variant: `experience-${experience}`, label: ENQUIRY_EXPERIENCES[experience].label,
      fileBaseName: `enquiry-${experience}`, templateId: `EMAIL_WEBSITE_ENQUIRY_${experience}_V2`,
      selection: audience === 'professional' ? { customerType: 'professional' } : { customerType: audience, roofForm: 'pitched', blinds: 'without-blinds' },
      variables: {
        leadId: `preview-${experience}`, submittedAt: new Date('2026-09-11T02:00:00Z'),
        enquiryType: audience, name: 'Alex Morgan', email: 'alex@example.test', phone: '021 555 0199', suburb: 'Auckland',
        company: audience === 'commercial' ? 'Harbour Café' : audience === 'professional' ? 'Studio North Architects' : undefined,
        message: experience === 'configured' ? 'We’d like to cover our outdoor dining area. Please check the connection to our house.'
          : experience === 'bespoke' ? 'Our courtyard is an unusual shape. We would like your help choosing a design that keeps the kitchen light.'
          : experience === 'commercial' ? 'We are planning a covered dining area for our café. We’d like to discuss access and the installation programme.'
          : 'We are at developed design and would like to discuss the roof interface and what information you need for a proposal.',
        widthM: 5.4, depthM: 3.2, heightM: 0, style: 'Pitched', roof: 'Acrylic', addons: [], blindsSelected: false,
        customerBrief, filesReceivedCount: audience === 'professional' ? 2 : 0,
      },
    };
  });
}
