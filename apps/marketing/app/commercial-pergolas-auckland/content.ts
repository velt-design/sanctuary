import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

export const commercialPergolasConfig = {
  marker: 'commercial-pergolas-auckland',
  route: '/commercial-pergolas-auckland',
  showGuideNavigation: false,
  enquiryType: 'commercial',
  description:
    'Sanctuary designs and builds commercial pergolas in Auckland, coordinating engineering, consent and trades where required from venue brief to installation.',
  schemaName: 'Commercial Pergolas Auckland',
  serviceName: 'Commercial pergola design and build in Auckland',
  serviceType: 'Commercial pergola design and build',
  hero: {
    image: '/images/project-goodhome-06.jpg',
    imageAlt: 'Interior of The Good Home Takanini hospitality courtyard beneath twin acrylic gables',
    objectPosition: '50% 48%',
    eyebrow: 'Commercial pergolas in Auckland',
    title: 'Make more of your outdoor space.',
    intro:
      'Covered courtyards for hospitality. Pergola design, roofing, suitable screens and installation, with the coordination your venue needs.',
    primaryCta: 'Discuss your venue',
    secondaryCta: 'See completed work',
    secondaryHref: '#commercial-projects',
    proof: [],
  },
  blocks: [],
  form: {
    ariaLabel: 'Commercial pergola project enquiry form',
    eyebrow: 'Commercial brief',
    heading: 'Tell us about your venue.',
    intro: 'Share the site, intended use and known constraints.',
    submitLabel: 'Send project brief',
    messageLabel: 'What should the space achieve?',
    messagePlaceholder:
      'Describe the site, intended use and anything that must keep working.',
    directContact: {
      intro: 'Prefer a direct conversation?',
      phoneLabel: 'Call 022 854 5633',
      phoneHref: 'tel:+64228545633',
      emailLabel: 'Email Sanctuary',
      emailHref: 'mailto:info@sanctuarypergolas.co.nz',
    },
    briefFields: [
      {
        name: 'siteAddress',
        label: 'Site address',
        type: 'text',
        placeholder: 'Street address',
        wide: true,
      },
      {
        name: 'projectStage',
        label: 'Project stage',
        type: 'select',
        options: [
          'Initial idea',
          'Site or landlord review',
          'Concept design',
          'Consent or consultant coordination',
          'Ready for a detailed proposal',
        ],
      },
      {
        name: 'professionalInvolvement',
        label: 'Existing project team or property contacts',
        type: 'text',
        placeholder: 'Landlord, architect, engineer, builder or other consultants',
      },
      {
        name: 'operatingConstraints',
        label: 'Operating, access and staging constraints',
        type: 'textarea',
        placeholder: 'Include opening hours, public routes, shutdown limits, delivery access and other trades.',
        wide: true,
      },
    ],
    roofPreference: {
      detailKey: 'roofPreference',
      options: [
        { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] },
        { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] },
        { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] },
        { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
      ],
    },
  },
} satisfies SeoLandingPageConfig;
