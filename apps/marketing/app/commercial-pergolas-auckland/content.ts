import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What kinds of commercial pergola projects does Sanctuary undertake?',
    answer: [
      'Sanctuary works across hospitality, workplace, recreation and other customer-facing sites where the pergola scope fits the property, intended use and operating requirements.',
      'The first conversation confirms the project structure, site conditions and the role Sanctuary is being asked to take.',
    ],
  },
  {
    question: 'Can Sanctuary work within an architect- or consultant-led project?',
    answer: [
      'Yes. Sanctuary can lead the design-and-build pathway from an early brief or deliver an agreed supply, installation and coordination scope within a developed consultant package.',
      'Responsibilities for design information, engineering, approvals, services and connected trades are confirmed for the actual project before fabrication and site work.',
    ],
  },
  {
    question: 'Can Sanctuary coordinate engineering and building consent?',
    answer: [
      'Sanctuary can coordinate the project engineer and building-consent pathway where these are included in the agreed scope.',
      'Requirements and decisions remain site- and design-specific, and the relevant authority remains responsible for determining whether consent is required and whether it is granted.',
    ],
  },
  {
    question: 'Can the project be planned around an operating venue?',
    answer: [
      'Planning can account for opening hours, customer and staff routes, deliveries, access, noise, protection and connected work.',
      'The achievable staging and any shutdowns must be agreed for the site. Continuous operation is not assumed until the programme and controls are confirmed.',
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
    title: 'You run the venue. We manage the pergola project.',
    intro:
      'Sanctuary designs, coordinates, builds and installs commercial pergolas for hospitality, workplace, recreation and other customer-facing sites. We can lead the full pathway or deliver within an architect- or consultant-led project.',
    primaryCta: 'Discuss your commercial project',
    secondaryCta: 'Review completed work',
    secondaryHref: '#commercial-projects',
    proof: [
      'Commercial design and delivery',
      'Approvals and interfaces coordinated where required',
      'Built and installed by Sanctuary',
    ],
  },
  blocks: [
    {
      kind: 'projects',
      id: 'commercial-projects',
      eyebrow: 'Completed commercial work',
      title: 'Three projects, three different delivery roles',
      intro:
        'Real hospitality, recreation and workplace projects show how Sanctuary adapts to the site, brief and wider project team.',
      items: [
        {
          slug: 'goodhome-commercial-terrace',
          label: 'Hospitality',
          role: 'Sanctuary-led hospitality design and build',
          summary:
            'A two-zone gable turns the front courtyard into covered hospitality space while preserving the villa-style facade.',
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
          summary:
            'A 12 by 6 metre pitched pergola supports seating and circulation within a staged site refresh.',
          facts: ['72 m² covered area', 'Existing levels and sightlines retained'],
        },
        {
          slug: 'kiwi-rail-platform',
          label: 'Workplace',
          role: 'Architect-led workplace canopy delivery',
          summary:
            'A 30 metre canopy creates a covered link between key workplace routes without making the long structure feel heavy.',
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
      eyebrow: 'A clear delivery path',
      title: 'Three stages from brief to completed installation',
      intro: 'The pathway adapts to Sanctuary-led and consultant-led projects.',
      items: [
        {
          title: 'Define the brief and design response',
          copy: 'Translate the site, operational brief and project-team inputs into an agreed pergola design and scope.',
        },
        {
          title: 'Coordinate approvals and interfaces',
          copy: 'Confirm the engineering, approvals, connected trades, access and responsibilities required for the actual site.',
        },
        {
          title: 'Build, install and hand over',
          copy: 'Manage procurement and site sequencing, install the agreed structure and complete the documented handover.',
        },
      ],
    },
    {
      kind: 'editorial-image',
      id: 'commercial-capability',
      tone: 'neutral',
      eyebrow: 'Scope and operating-site coordination',
      title: 'The space should earn its place in the operation',
      image: {
        src: '/images/project-kiwi-rail-03.jpg',
        alt: 'Architectural detail of the KiwiRail canopy structure and covered pedestrian route',
        objectPosition: '50% 42%',
      },
      lead:
        'Sanctuary can lead a complete design-and-build scope or work within an architect, designer or builder-led package. The agreed role, site controls and interfaces are set for the actual project; Sanctuary cannot remove every project variable.',
      items: [
        {
          title: 'Sanctuary-led scope',
          text: 'Develop the pergola design, coordinate the agreed technical pathway and manage build and installation.',
        },
        {
          title: 'Consultant-led scope',
          text: 'Work from a developed package with supply, installation and coordination responsibilities defined before fabrication.',
        },
        {
          title: 'Structure and connected work',
          text: 'Confirm loads, clearances, fixings, services and trade ownership against one agreed structure.',
        },
        {
          title: 'Operating hours and shutdowns',
          text: 'Plan the programme around known hours and agree where site work requires an area to operate differently.',
        },
        {
          title: 'Access and public separation',
          text: 'Set delivery, storage, staff and customer routes, noise controls and protection before site work begins.',
        },
        {
          title: 'Completion and future access',
          text: 'Keep serviceable elements accessible and record the relevant completion and handover responsibilities.',
        },
      ],
    },
    {
      kind: 'link-cards',
      id: 'commercial-pathways',
      eyebrow: 'Choose the useful next step',
      title: 'Continue with the pathway that matches your project',
      items: [
        {
          title: 'Working with an architect, designer or builder?',
          text: 'Sanctuary can work from an early brief or within a more developed consultant package.',
          href: '/architects-designers-builders',
          linkLabel: 'Review professional collaboration',
        },
        {
          title: 'Reviewing likely scope and cost drivers?',
          text: 'Commercial pricing depends on structure, approvals, access, services, connected trades and project responsibilities.',
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
      title: 'Project structure, approvals and operating sites',
      intro: 'The exact design, approval and delivery requirements remain project-specific.',
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
  finalCta: {
    eyebrow: 'Start with the opportunity',
    title: 'Show us the site and what the space needs to do',
    text: 'Complete drawings and specifications are not required for the first conversation. Share the intended outcome and known constraints, and Sanctuary can help define the useful next step.',
    button: 'Discuss your commercial project',
    checklistTitle: 'Useful first inputs',
    checklist: [
      'Site address and current use',
      'Photos, available plans and rough dimensions',
      'Customer, staff or operational outcome',
      'Operating hours, access and shutdown constraints',
      'Property contacts, project team and target stage',
    ],
  },
  form: {
    ariaLabel: 'Commercial pergola project enquiry form',
    eyebrow: 'Talk to the design and build team',
    heading: 'Discuss your commercial pergola project',
    intro:
      'Tell us about the site, intended outcome and known constraints. Complete drawings and specifications are not required for the first conversation.',
    submitLabel: 'Discuss your commercial project',
    messageLabel: 'What should the space achieve?',
    messagePlaceholder:
      'Describe the site, the customer or operational outcome you want, and anything that must keep working during the project.',
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
