import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What kinds of commercial pergola projects does Sanctuary undertake?',
    answer: [
      'Sanctuary works across hospitality, workplace, recreation and other customer-facing sites where the pergola scope fits the property, intended use and operating requirements.',
    ],
  },
  {
    question: 'Can Sanctuary work within an architect- or consultant-led project?',
    answer: [
      'Yes. Sanctuary can lead the pergola scope or deliver within a developed consultant package. Responsibilities are confirmed before fabrication.',
    ],
  },
  {
    question: 'Can Sanctuary coordinate engineering and building consent?',
    answer: [
      'Sanctuary can coordinate these where included. Requirements and decisions remain project-specific.',
    ],
  },
  {
    question: 'Can the project be planned around an operating venue?',
    answer: [
      'Yes. Opening hours, routes, deliveries, access and shutdowns are agreed for the site.',
    ],
  },
] as const;

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
    image: '/images/project-goodhome-03.jpg',
    imageAlt: 'Completed Good Home Takanini courtyard beneath a transparent gable pergola',
    objectPosition: '50% 46%',
    eyebrow: 'Commercial pergolas in Auckland',
    title: 'Commercial pergolas, designed and installed.',
    intro:
      'Sanctuary designs, coordinates and installs commercial pergolas, or works within your consultant-led project.',
    primaryCta: 'Send commercial brief',
    secondaryCta: 'Review completed work',
    secondaryHref: '#commercial-projects',
    proof: [
      'Design and delivery',
      'Consultant-led work welcome',
      'Installed by Sanctuary',
    ],
  },
  blocks: [
    {
      kind: 'projects',
      id: 'commercial-projects',
      eyebrow: 'Completed commercial work',
      title: 'Three projects. Three delivery roles.',
      items: [
        {
          slug: 'goodhome-commercial-terrace',
          label: 'Hospitality',
          role: 'Sanctuary-led hospitality design and build',
          summary: 'Two gables extend the villa-style facade over the restaurant courtyard.',
          facts: ['67.7 m² covered area', '25 degree gable relationship'],
          image: {
            src: '/images/project-goodhome-02.jpg',
            alt: 'Completed two-zone gable pergola extending The Good Home Takanini courtyard',
            objectPosition: '50% 52%',
          },
        },
        {
          slug: 'lilliput-mini-golf',
          label: 'Recreation',
          role: 'Supply and installation within a consultant-led renovation',
          summary: 'A pitched pergola installed within a consultant-led venue renovation.',
          facts: ['72 m² covered area', 'Existing levels and sightlines retained'],
        },
        {
          slug: 'kiwi-rail-platform',
          label: 'Workplace',
          role: 'Architect-led workplace canopy delivery',
          summary: 'An aluminium and acrylic canopy follows a workplace route.',
          facts: ['115 m² circulation canopy', 'Integrated strip lighting'],
          image: {
            src: '/images/project-kiwi-rail-01.jpg',
            alt: 'Long KiwiRail workplace canopy connecting circulation routes between office buildings',
            objectPosition: '50% 48%',
          },
        },
      ],
    },
    {
      kind: 'process',
      id: 'commercial-process',
      eyebrow: 'Delivery',
      title: 'From brief to installation.',
      items: [
        {
          title: 'Define the scope',
          copy: 'Agree the site, operational brief, design and responsibilities.',
        },
        {
          title: 'Coordinate the project',
          copy: 'Confirm engineering, approvals, trades, access and sequencing.',
        },
        {
          title: 'Install and hand over',
          copy: 'Build and install the agreed structure, then complete handover.',
        },
      ],
    },
    {
      kind: 'editorial-image',
      id: 'commercial-capability',
      tone: 'neutral',
      eyebrow: 'Capability',
      title: 'Define the role before work starts.',
      image: {
        src: '/images/project-kiwi-rail-03.jpg',
        alt: 'Architectural detail of the KiwiRail canopy structure and covered pedestrian route',
        objectPosition: '50% 42%',
      },
      lead: 'Sanctuary can lead the pergola scope or work within a consultant-led package.',
      items: [
        {
          title: 'Design',
          text: 'Develop the pergola design and agreed technical pathway.',
        },
        {
          title: 'Site coordination',
          text: 'Plan access, operating constraints, interfaces and sequencing.',
        },
        {
          title: 'Delivery',
          text: 'Build, install and hand over the agreed scope.',
        },
      ],
    },
    {
      kind: 'link-cards',
      id: 'commercial-pathways',
      eyebrow: 'Choose the useful next step',
      title: 'Related project paths.',
      items: [
        {
          title: 'Working with an architect, designer or builder?',
          text: 'Share an early brief or developed consultant package.',
          href: '/architects-designers-builders',
          linkLabel: 'Review professional collaboration',
        },
        {
          title: 'Reviewing likely scope and cost drivers?',
          text: 'Compare structure, approvals, access, trades and responsibilities.',
          href: '/pergola-cost-auckland',
          linkLabel: 'Review scope and cost drivers',
        },
      ],
    },
    {
      kind: 'faq',
      id: 'commercial-pergolas-faq',
      tone: 'elevated',
      eyebrow: 'Common commercial questions',
      title: 'Commercial project questions.',
      items: faqItems,
    },
  ],
  blockOrder: [
    'commercial-projects',
    'commercial-process',
    'commercial-capability',
    'commercial-pathways',
    'commercial-pergolas-faq',
  ],
  mobileDisclosureGroups: [
    {
      id: 'commercial-planning-support',
      summary: 'Common commercial planning questions',
      blockIds: ['commercial-pergolas-faq'],
    },
  ],
  form: {
    ariaLabel: 'Commercial pergola project enquiry form',
    eyebrow: 'Commercial brief',
    heading: 'Tell us about the project.',
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
