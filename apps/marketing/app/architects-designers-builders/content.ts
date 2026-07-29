import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

export const professionalCapabilityConfig = {
  marker: 'architects-designers-builders',
  route: '/architects-designers-builders',
  showGuideNavigation: false,
  breadcrumbLabel: 'For architects, designers and builders',
  enquiryType: 'professional',
  schemaKind: 'service',
  description:
    'Sanctuary works with Auckland architects, designers and builders on fixed-roof pergola design, documentation, engineering interfaces, supply and installation.',
  schemaName: 'Pergola capability for architects, designers and builders',
  serviceName: 'Professional pergola collaboration in Auckland',
  serviceType: 'Pergola design, documentation, supply and installation collaboration',
  hero: {
    image: '/images/project-kiwi-rail-01.jpg',
    imageAlt:
      'Long aluminium and acrylic canopy connecting circulation routes at the KiwiRail head office',
    objectPosition: '50% 48%',
    eyebrow: 'For architects, designers and builders',
    title: 'Pergola delivery for architects, designers and builders.',
    intro:
      'Share a brief, drawings or tender package. We can define and deliver the agreed scope.',
    primaryCta: 'Send project brief',
    secondaryCta: 'View collaborations',
    secondaryHref: '#professional-projects',
    proof: [
      'Early or developed packages',
      'Clear responsibilities',
      'Plans and files accepted',
    ],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'professional-role',
      eyebrow: 'Project role',
      title: 'Define the scope and responsibility.',
      paragraphs: [
        'Sanctuary can develop the pergola from an early brief or deliver a defined package. We confirm deliverables, dependencies and interfaces before fabrication.',
      ],
    },
    {
      kind: 'projects',
      id: 'professional-projects',
      eyebrow: 'Completed work',
      title: 'Three collaboration models.',
      items: [
        {
          slug: 'kiwi-rail-platform',
          label: 'Architect-led canopy',
          summary: 'An architect-led aluminium and acrylic canopy with integrated lighting.',
          facts: ['Architect-led design', '115 m² recorded canopy'],
        },
        {
          slug: 'lilliput-mini-golf',
          label: 'Consultant-led renovation',
          summary: 'Supply and installation within a consultant-led venue renovation.',
          facts: ['Drawings by project architect and engineer', '72 m² recorded cover'],
        },
        {
          slug: 'goodhome-commercial-terrace',
          label: 'Building integration',
          summary: 'Two gables aligned with the restaurant facade and wider fit-out.',
          facts: ['25 degree building relationship', '67.7 m² recorded cover'],
        },
      ],
    },
    {
      kind: 'numbered-cards',
      id: 'professional-inputs',
      eyebrow: 'What to send',
      title: 'Send what exists now.',
      items: [
        {
          title: 'Brief or concept',
          text: 'Include the site, intended use, design intent and open decisions.',
        },
        {
          title: 'Drawings',
          text: 'Share relevant plans, sections, details or tender information.',
        },
        {
          title: 'Team and scope',
          text: 'Name the project team and the responsibility Sanctuary should own.',
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'professional-interfaces',
      tone: 'warm',
      eyebrow: 'Interfaces',
      title: 'Coordinate the building, structure and trades.',
      items: [
        {
          title: 'Architecture and building connection',
          outcome: 'Align form, levels, junctions, drainage and finish.',
          consider: 'Structure, cladding, clearances and adjacent work.',
        },
        {
          title: 'Project-specific engineering',
          outcome: 'Coordinate structural inputs and connection requirements.',
          consider: 'Loads, foundations, documents and engineering responsibility.',
        },
        {
          title: 'Services and specialist trades',
          outcome: 'Define locations for lighting, heating, blinds and controls.',
          consider: 'Power, clearances, installers and service access.',
        },
        {
          title: 'Procurement and installation',
          outcome: 'Set a clear release, fabrication, site and handover sequence.',
          consider: 'Information, access, trades, inspections and exclusions.',
        },
      ],
    },
    {
      kind: 'process',
      id: 'professional-process',
      eyebrow: 'Delivery',
      title: 'Define and deliver the package.',
      items: [
        {
          title: 'Review the brief',
          copy: 'Confirm the stage, intent, constraints, documents and team.',
        },
        {
          title: 'Agree the scope',
          copy: 'Define deliverables, exclusions, responsibilities and interfaces.',
        },
        {
          title: 'Build and hand over',
          copy: 'Coordinate fabrication, installation and completion information.',
        },
      ],
    },
    {
      kind: 'faq',
      id: 'professional-faq',
      eyebrow: 'Before sending a brief',
      title: 'Common questions from project teams',
      items: [
        {
          question: 'At what project stage should Sanctuary be involved?',
          answer: [
            'Sanctuary can review an early brief or a developed consultant or tender package.',
          ],
        },
        {
          question: 'Can Sanctuary work to architect and engineer drawings?',
          answer: [
            'Yes, where the agreed scope and documentation are suitable.',
          ],
        },
        {
          question: 'Can Sanctuary coordinate project-specific engineering?',
          answer: [
            'Yes, where included. Scope and sign-off responsibilities are confirmed for the project.',
          ],
        },
        {
          question: 'What file types can be sent with the enquiry?',
          answer: [
            'Use the upload control below for supported photos, plans, sketches and documents.',
          ],
        },
        {
          question: 'Does Sanctuary have to own the complete pergola design?',
          answer: [
            'No. The role can range from design development to a defined supply-and-install package.',
          ],
        },
      ],
    },
  ],
  mobileDisclosureGroups: [
    {
      id: 'professional-coordination-detail',
      summary: 'How responsibilities and interfaces are coordinated',
      blockIds: ['professional-interfaces', 'professional-process'],
    },
    {
      id: 'professional-planning-support',
      summary: 'Questions before sending a professional brief',
      blockIds: ['professional-faq'],
    },
  ],
  form: {
    ariaLabel: 'Architect, designer and builder project enquiry form',
    eyebrow: 'Professional project enquiry',
    heading: 'Send your project brief.',
    intro: 'Share what is defined, what is open and what Sanctuary should own.',
    submitLabel: 'Send project brief',
    messageLabel: 'Project and requested role',
    messagePlaceholder: 'Describe the project, open decisions and proposed Sanctuary scope.',
    briefFields: [
      {
        name: 'organisationAndRole',
        label: 'Organisation and your project role',
        type: 'text',
        placeholder: 'Practice, company and role',
        wide: true,
      },
      {
        name: 'projectStage',
        label: 'Project stage',
        type: 'select',
        options: [
          'Early brief or feasibility',
          'Concept design',
          'Developed or detailed design',
          'Consent documentation',
          'Tender or procurement',
          'Construction coordination',
        ],
      },
      {
        name: 'professionalTeam',
        label: 'Existing project team',
        type: 'text',
        placeholder: 'Architect, designer, engineer, builder and connected trades',
      },
      {
        name: 'requestedScope',
        label: 'Scope or responsibility for Sanctuary',
        type: 'textarea',
        placeholder: 'Design development, engineering coordination, supply, installation or another defined package',
        wide: true,
      },
    ],
  },
} satisfies SeoLandingPageConfig;
