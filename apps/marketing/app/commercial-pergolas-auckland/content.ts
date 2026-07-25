import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What kinds of commercial pergola projects does Sanctuary undertake?',
    answer: [
      'Sanctuary designs and builds pergolas for restaurants, cafes and other hospitality venues, along with selected workplace, recreation and customer-facing sites.',
      'Each opportunity is assessed against the intended use, property, site conditions, operating requirements and the scope Sanctuary is being asked to manage.',
    ],
  },
  {
    question: 'Does Sanctuary design and build the complete pergola?',
    answer: [
      'Yes. Sanctuary develops the pergola design internally, confirms the agreed scope, project-manages delivery and builds and installs the structure.',
      'Where specialist input or connected work is required, Sanctuary coordinates the project engineer and relevant trades so their requirements are carried through the design and site sequence.',
    ],
  },
  {
    question: 'Can Sanctuary coordinate engineering and building consent?',
    answer: [
      'Yes. Sanctuary has taken multiple pergola projects through the building consent process and can manage that pathway where it is required, including coordination with the project engineer and the documentation needed for the application.',
      'Whether consent is required and whether it is granted depend on the site, use and completed design. The relevant authority remains responsible for its decision.',
    ],
  },
  {
    question: 'Can the project be planned around an operating venue?',
    answer: [
      'The design and delivery plan can account for opening hours, customer and staff routes, seating, doors, deliveries, noise, access and areas that must remain clear.',
      'The achievable staging and any shutdowns need to be agreed for the actual site. Continuous operation should not be assumed until the programme and site controls are confirmed.',
    ],
  },
  {
    question: 'How does Sanctuary work with other commercial trades?',
    answer: [
      'Sanctuary can coordinate the interfaces with electrical, lighting, heating, blind, signage and other relevant trades within the agreed project scope.',
      'Locations, loads, power, controls, fixings, access and installation responsibilities are identified before fabrication so each trade has a clear point of coordination.',
    ],
  },
  {
    question: 'Which roof types suit a commercial pergola?',
    answer: [
      'Acrylic, solid and combination roofs, together with pitched, gable and other forms, can serve different venue and architectural briefs.',
      'The right approach depends on daylight, shade, building connection, drainage, services, appearance and the product evidence required for the project.',
    ],
  },
  {
    question: 'What does Sanctuary provide at handover?',
    answer: [
      'The agreed handover can include completion information, care guidance and the product and warranty documents that apply to the installed assembly.',
      'The project scope should also identify maintenance access and the handover responsibilities of any connected trades.',
    ],
  },
  {
    question: 'What should I include in a commercial pergola enquiry?',
    answer: [
      'Start with the site address, venue or facility use, photos, rough dimensions and what the outdoor area should make possible for customers, staff or visitors.',
      'Include operating hours, access constraints, landlord details, available plans, existing consultants and any target dates. The roof approach can remain undecided.',
    ],
  },
] as const;

export const commercialPergolasConfig = {
  marker: 'commercial-pergolas-auckland',
  route: '/commercial-pergolas-auckland',
  enquiryType: 'commercial',
  description:
    'Sanctuary designs and builds commercial pergolas in Auckland, coordinating engineering, consent and trades where required from venue brief to installation.',
  schemaName: 'Commercial Pergolas Auckland',
  serviceName: 'Commercial pergola design and build in Auckland',
  serviceType: 'Commercial pergola design and build',
  hero: {
    image: '/images/project-goodhome-04.jpg',
    imageAlt: 'Occupied Auckland hospitality courtyard beneath a lit acrylic gable pergola',
    objectPosition: '50% 42%',
    eyebrow: 'Commercial pergolas in Auckland',
    title: 'You run the venue. We manage the pergola project.',
    intro:
      'Sanctuary designs and builds commercial pergolas, coordinating engineering, building consent and connected trades where required. You get one accountable pathway from the first site conversation through project management, installation and handover.',
    primaryCta: 'Discuss your venue',
    secondaryCta: 'See how we manage it',
    secondaryHref: '#commercial-process',
    proof: [
      'Designed in-house',
      'Engineering, consent and trades coordinated',
      'Built and installed by Sanctuary',
    ],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'commercial-value',
      eyebrow: 'More usable space, less project to manage',
      title: 'Make more of the venue without taking on another construction project',
      paragraphs: [
        'For a restaurant or cafe, a well-planned covered area can make more of existing seating, frontage or customer space. It can help the venue serve customers in changing conditions while keeping circulation and service clear.',
        'The value is not only the finished structure. It is reaching that result without the owner having to brief and coordinate every designer, engineer, authority and trade.',
        'Sanctuary designs the pergola internally, leads the agreed consent and coordination pathway, project-manages delivery and builds the finished structure.',
      ],
    },
    {
      kind: 'numbered-cards',
      id: 'commercial-outcomes',
      eyebrow: 'Practical value for a working venue',
      title: 'The space should earn its place in the operation',
      intro: 'Good design begins with what customers, staff and the property need the space to do.',
      items: [
        {
          title: 'More usable customer space',
          text: 'Plan cover over seating, frontage or arrival areas so valuable outdoor space can be used more often, within the limits of the site and completed design.',
        },
        {
          title: 'A design that belongs',
          text: 'Shape the roof, frame, colour, light and integrated features around the venue architecture and the experience presented to customers.',
        },
        {
          title: 'An easier delivery path',
          text: 'Keep design, engineering, building consent, connected trades, site works and handover moving through one Sanctuary-led project plan.',
        },
      ],
    },
    {
      kind: 'projects',
      id: 'commercial-projects',
      eyebrow: 'Hospitality projects first',
      title: 'See how completed venues made outdoor space part of the business',
      intro:
        'The Good Home and Atelier Shu show two hospitality responses, followed by broader commercial work across recreation and workplace settings.',
      items: [
        {
          slug: 'goodhome-commercial-terrace',
          label: 'Restaurant courtyard',
          summary:
            'A 10.09 by 6.7 metre, two-zone gable extends the restaurant into a covered courtyard while following the villa-style facade.',
          facts: ['67.7 m² hospitality cover', '25 degree gable relationship'],
        },
        {
          slug: 'atelier-shu-cafe',
          label: 'Cafe frontage',
          summary:
            'A 9.0 by 4.0 metre aluminium gable adds a sheltered outdoor zone while matching the existing cafe architecture and colours.',
          facts: ['36 m² frontage cover', '30 degree gable form'],
          image: {
            src: '/images/project-atelier-shu-02.jpg',
            alt: 'Front-on view of the dark-tint acrylic gable canopy over outdoor seating at Atelier Shu Cafe in Newmarket',
            objectPosition: '50% 42%',
          },
        },
        {
          slug: 'lilliput-mini-golf',
          label: 'Recreation venue',
          summary:
            'A 12.0 by 6.0 metre pitched pergola covers circulation and seating within a staged site refresh coordinated with the client design team.',
          facts: ['72 m² covered area', 'Existing levels and sightlines retained'],
        },
        {
          slug: 'kiwi-rail-platform',
          label: 'Workplace circulation',
          summary:
            'A 30 metre long aluminium and acrylic canopy forms a covered link between important routes at the KiwiRail head office.',
          facts: ['115 m² circulation canopy', 'Architect-led project'],
        },
      ],
    },
    {
      kind: 'process',
      id: 'commercial-process',
      eyebrow: 'One accountable pathway',
      title: 'From the first venue conversation to the installed project',
      intro:
        'Sanctuary leads each agreed stage, with site requirements and professional inputs confirmed for the actual project.',
      items: [
        {
          title: 'Define the venue opportunity',
          copy: 'Understand the customer or operational value, daily use, property stakeholders, existing information, access constraints and the outcome the space needs to support.',
        },
        {
          title: 'Design the pergola in-house',
          copy: 'Measure the site and develop the form, structure, roof, drainage, finishes and integrated features around the venue and building.',
        },
        {
          title: 'Coordinate engineering and consent',
          copy: 'Where required, coordinate the project engineer and manage the building consent documentation and process. Requirements and approval remain specific to the site and completed design.',
        },
        {
          title: 'Align trades and project delivery',
          copy: 'Confirm the interfaces with electrical, lighting, heating, blinds, signage or other trades, then project-manage procurement and the agreed site sequence.',
        },
        {
          title: 'Build, install and hand over',
          copy: 'Build and install the agreed pergola, coordinate completion items and provide the handover information included in the project scope.',
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'commercial-decisions',
      tone: 'warm',
      eyebrow: 'What Sanctuary brings together',
      title: 'The moving parts stay connected under one project plan',
      intro: 'The commercial owner has one experienced team leading the agreed design and build pathway.',
      items: [
        {
          title: 'Venue and architectural design',
          outcome: 'An in-house design arranged around customers, staff, furniture, circulation and the character of the property.',
          consider: 'Peak use, seating, accessibility, exits, service routes, sightlines, facade, roofline, colours and future layout changes.',
        },
        {
          title: 'Engineering and consent',
          outcome: 'A project-specific technical and documentation pathway coordinated alongside the evolving design.',
          consider: 'Existing information, site conditions, structural inputs, required documents, authority process, reviews and sign-offs.',
        },
        {
          title: 'Connected trades and services',
          outcome: 'Lighting, heating, blinds, signage, power and controls coordinated with the structure rather than added as competing late decisions.',
          consider: 'Loads, locations, clearances, fixings, cabling, controls, installers, commissioning and future access.',
        },
        {
          title: 'Project management and build',
          outcome: 'A clear scope and sequence from procurement through installation, completion and agreed handover.',
          consider: 'Operating hours, site access, public separation, protection, other trades, inspections, documents and maintenance access.',
        },
      ],
    },
    {
      kind: 'editorial-image',
      id: 'commercial-circulation',
      tone: 'neutral',
      eyebrow: 'Keep the venue working',
      title: 'Plan the installation around the operation, not just the footprint',
      image: {
        src: '/images/project-kiwi-rail-01.jpg',
        alt: 'Long commercial canopy framing a pedestrian route between Auckland office buildings',
        objectPosition: '50% 50%',
      },
      lead: 'Commercial sites bring opening hours, customers, staff, neighbours, deliveries and other trades into the build plan.',
      items: [
        {
          title: 'Customer and staff routes',
          text: 'Test posts, headroom, thresholds, doors, seating and temporary work areas against the people who use the site.',
        },
        {
          title: 'Access and protection',
          text: 'Agree delivery access, storage, public separation, noise limits and protection of the existing venue before site work begins.',
        },
        {
          title: 'Services and shutdowns',
          text: 'Coordinate power, controls and connected work with the programme, including any periods when an area cannot operate normally.',
        },
        {
          title: 'Completion and future access',
          text: 'Keep drainage, lights, controls and other serviceable elements accessible and record the relevant handover responsibilities.',
        },
      ],
    },
    {
      kind: 'dark-cards',
      id: 'commercial-risks',
      eyebrow: 'Less ambiguity, fewer owner handoffs',
      title: 'One project lead helps close the gaps between scopes',
      intro:
        'Sanctuary cannot remove every project variable, but it can make ownership, dependencies and the next decision visible.',
      items: [
        {
          title: 'Design and engineering stay connected',
          text: 'The in-house design develops alongside coordinated project-specific engineering so structural requirements can inform the agreed form and details.',
        },
        {
          title: 'Consent has a named pathway',
          text: 'Where building consent is required, Sanctuary manages the process and coordinates the information needed while the authority retains the approval decision.',
        },
        {
          title: 'The structure and other trades meet on one plan',
          text: 'Fixings, power, loads, locations, installation responsibilities and completion items are assigned before they become site problems.',
        },
      ],
      links: [
        { href: '/projects', label: 'Browse completed projects' },
        { href: '/pergola-cost-auckland', label: 'Review commercial scope drivers' },
      ],
    },
    {
      kind: 'link-cards',
      id: 'commercial-next-decisions',
      tone: 'neutral',
      eyebrow: 'Continue planning',
      title: 'Bring the next commercial decision into focus',
      items: [
        {
          title: 'Resolve a bespoke interface',
          text: 'Use the custom guide for difficult connections, restricted supports and consultant-led geometry.',
          href: '/custom-pergolas-auckland',
          linkLabel: 'Open the custom guide',
        },
        {
          title: 'Compare complete scope',
          text: 'Use the cost guide to align inclusions, exclusions, access, approvals and connected trades.',
          href: '/pergola-cost-auckland',
          linkLabel: 'Open the cost guide',
        },
        {
          title: 'Review completed work',
          text: 'See dimensions, constraints and design responses across hospitality and other commercial projects.',
          href: '/projects',
          linkLabel: 'Browse projects',
        },
      ],
    },
    {
      kind: 'faq',
      id: 'commercial-pergolas-faq',
      tone: 'elevated',
      eyebrow: 'Questions from commercial owners',
      title: 'What to know before starting a commercial pergola in Auckland',
      intro:
        'Sanctuary can define the pathway with you. The exact design, engineering, consent and delivery requirements remain project-specific.',
      items: faqItems,
    },
  ],
  mobileDisclosureGroups: [
    {
      id: 'commercial-outcomes-detail',
      summary: 'How the pergola supports a working venue',
      blockIds: ['commercial-outcomes'],
    },
    {
      id: 'commercial-coordination-detail',
      summary: 'How coordination protects the operation',
      blockIds: ['commercial-decisions', 'commercial-circulation', 'commercial-risks'],
    },
    {
      id: 'commercial-planning-support',
      summary: 'Commercial planning links and common questions',
      blockIds: ['commercial-next-decisions', 'commercial-pergolas-faq'],
    },
  ],
  finalCta: {
    eyebrow: 'Start with the opportunity',
    title: 'Show us the venue and what the space needs to do',
    text: 'You do not need a complete consultant brief. Share the site, customer or operational outcome and known constraints, and Sanctuary can map the design, coordination and build pathway from there.',
    button: 'Discuss your venue',
    checklistTitle: 'Useful first inputs',
    checklist: [
      'Site address and business use',
      'Photos, plans and rough dimensions',
      'Customer, seating or service outcome',
      'Opening hours and access constraints',
      'Property owner or landlord details',
      'Existing architect or consultant contacts',
      'Services and integrated features',
      'Target dates and current project stage',
    ],
  },
  form: {
    ariaLabel: 'Commercial pergola project enquiry form',
    eyebrow: 'Talk to the design and build team',
    heading: 'Discuss your commercial pergola project',
    intro:
      'Tell us about the venue and the outcome you want. Sanctuary can help define the design, engineering, consent, trade coordination and delivery pathway from there.',
    submitLabel: 'Discuss your venue',
    messageLabel: 'What should the space achieve?',
    messagePlaceholder:
      'Describe the venue, the customer or operational value you want, and anything that must keep working during the project.',
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
