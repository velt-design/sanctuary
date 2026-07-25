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
    title: 'Bring Sanctuary into the project at the right level.',
    intro:
      'Share an early brief, concept, consultant set or tender package. Sanctuary can help define the fixed-roof pergola scope, resolve buildable interfaces and take responsibility for the agreed design, supply and installation work.',
    primaryCta: 'Send plans or a project brief',
    secondaryCta: 'Review completed collaborations',
    secondaryHref: '#professional-projects',
    proof: [
      'Early design or defined package',
      'Engineering interfaces coordinated',
      'Supported plans and files accepted',
    ],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'professional-role',
      eyebrow: 'A clear role in the wider team',
      title: 'Start by defining the outcome, information and responsibility',
      paragraphs: [
        'Sanctuary can develop the pergola design from an early architectural brief or work within a more defined project package. The agreed role may cover design development, project-specific engineering coordination, supply, installation and connected trade interfaces.',
        'The first conversation identifies what is already resolved, which consultants and contractors are involved, what information governs the work and where responsibility needs to sit.',
        'Scope, approvals and technical decisions remain project-specific. Sanctuary confirms its deliverables and dependencies before the project moves into fabrication or site work.',
      ],
    },
    {
      kind: 'projects',
      id: 'professional-projects',
      eyebrow: 'Governed project evidence',
      title: 'Three completed projects, three different collaboration models',
      intro:
        'These records show an architect-led canopy, a consultant-led venue renovation and a building-integrated hospitality response.',
      items: [
        {
          slug: 'kiwi-rail-platform',
          label: 'Architect-led canopy',
          summary:
            'JCY Architects engaged Sanctuary to help deliver a 30 metre aluminium and acrylic canopy with integrated strip lighting between workplace circulation routes.',
          facts: ['Architect-led design', '115 m² recorded canopy'],
        },
        {
          slug: 'lilliput-mini-golf',
          label: 'Consultant-led renovation',
          summary:
            'Sanctuary worked alongside the client architect and engineer, focusing its scope on supply and installation while coordinating with the wider renovation team.',
          facts: ['Drawings by project architect and engineer', '72 m² recorded cover'],
        },
        {
          slug: 'goodhome-commercial-terrace',
          label: 'Building integration',
          summary:
            'A two-zone gable was developed around the restaurant facade, matching the existing 25 degree roof rhythm and coordinating screens and lighting in the completed setting.',
          facts: ['25 degree building relationship', '67.7 m² recorded cover'],
        },
      ],
    },
    {
      kind: 'numbered-cards',
      id: 'professional-inputs',
      eyebrow: 'Useful project information',
      title: 'Send what exists now. The gaps can be identified together.',
      intro:
        'A complete package is not required for the first review, but the governing information should be visible.',
      items: [
        {
          title: 'Early brief or concept',
          text: 'Include intended use, site, architectural intent, target programme and the decisions that are still open.',
        },
        {
          title: 'Drawings and specifications',
          text: 'Share relevant plans, elevations, sections, details, schedules or tender information in the existing supported file formats.',
        },
        {
          title: 'Team and responsibilities',
          text: 'Name the client, architect, designer, engineer, builder and connected trades where known, together with the scope Sanctuary is being asked to own.',
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'professional-interfaces',
      tone: 'warm',
      eyebrow: 'Interfaces to resolve',
      title: 'Keep structure, building and connected work on one coordinated path',
      intro:
        'The exact owners are agreed for the actual project; these are the common interfaces to close before fabrication.',
      items: [
        {
          title: 'Architecture and building connection',
          outcome: 'Pergola form, set-out, levels, junctions, drainage and finish respond to the governing building information.',
          consider: 'Survey information, primary structure, cladding, waterproofing, clearances, tolerances and responsibility for adjacent work.',
        },
        {
          title: 'Project-specific engineering',
          outcome: 'Structural inputs and connection requirements are coordinated with the developing pergola scope where required.',
          consider: 'Design loads, existing structure, foundations, producer documentation, review points and the engineer responsible for each element.',
        },
        {
          title: 'Services and specialist trades',
          outcome: 'Lighting, heating, blinds, controls, signage and other connected elements have defined locations and fixing requirements.',
          consider: 'Loads, power, cabling, clearances, penetrations, installers, commissioning and future service access.',
        },
        {
          title: 'Procurement and installation',
          outcome: 'The agreed Sanctuary package has a clear release, fabrication, site and handover sequence.',
          consider: 'Approved information, lead times, access, protection, other trades, inspections, completion documents and exclusions.',
        },
      ],
    },
    {
      kind: 'process',
      id: 'professional-process',
      eyebrow: 'A practical collaboration path',
      title: 'Three steps to define and deliver the right package',
      intro:
        'Each step closes the information and responsibility needed for the next one.',
      items: [
        {
          title: 'Review the brief and information',
          copy: 'Confirm the project stage, design intent, site constraints, governing documents, team and the outcome expected from Sanctuary.',
        },
        {
          title: 'Agree scope and interfaces',
          copy: 'Define deliverables, exclusions, engineering and approval responsibilities, connected trades, programme dependencies and information release points.',
        },
        {
          title: 'Coordinate, build and hand over',
          copy: 'Develop and release the agreed package, coordinate fabrication and installation, then close the completion information included in scope.',
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
            'Sanctuary can review an early brief or a more developed consultant or tender package. Earlier involvement can help identify pergola-specific geometry, drainage, structure and connected-trade interfaces before they are fixed.',
          ],
        },
        {
          question: 'Can Sanctuary work to architect and engineer drawings?',
          answer: [
            'Yes, where the agreed scope and documentation are suitable. Lilliput Mini Golf is a governed example where Sanctuary supplied and installed the structure while working to drawings prepared by the project architect and engineer.',
          ],
        },
        {
          question: 'Can Sanctuary coordinate project-specific engineering?',
          answer: [
            'Sanctuary can coordinate the project engineer where that service is included. The engineering scope, inputs, producer documentation and sign-off responsibilities are confirmed for the actual project.',
          ],
        },
        {
          question: 'What file types can be sent with the enquiry?',
          answer: [
            'Use the upload control below for the currently supported photos, plans, sketches and documents. The same validated attachment policy used across Sanctuary enquiries applies here.',
          ],
        },
        {
          question: 'Does Sanctuary have to own the complete pergola design?',
          answer: [
            'No. The role can be shaped around the project information and procurement path, from design development through to a defined supply-and-install package. Responsibility boundaries must be agreed before work proceeds.',
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
  finalCta: {
    eyebrow: 'Start with the information you have',
    title: 'Send the project brief and define the role together',
    text: 'Share the project stage, relevant drawings or specifications, known consultants and the responsibility you want Sanctuary to consider. A complete pergola solution does not need to be predetermined.',
    button: 'Send plans or a project brief',
    checklistTitle: 'Useful first inputs',
    checklist: [
      'Project name, address and intended use',
      'Your organisation and role',
      'Current project stage and programme',
      'Plans, elevations, sections or sketches',
      'Relevant specification or tender information',
      'Known architect, engineer, builder and trades',
      'Proposed Sanctuary scope',
      'Open technical or responsibility questions',
    ],
  },
  form: {
    ariaLabel: 'Architect, designer and builder project enquiry form',
    eyebrow: 'Professional project enquiry',
    heading: 'Send plans or a project brief',
    intro:
      'Tell us what is already defined and what you need Sanctuary to own. Attach the relevant project information in the supported formats below.',
    submitLabel: 'Send professional project brief',
    messageLabel: 'Project brief and requested Sanctuary role',
    messagePlaceholder:
      'Describe the project, current design intent, open decisions and the scope or responsibility you want Sanctuary to consider.',
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
