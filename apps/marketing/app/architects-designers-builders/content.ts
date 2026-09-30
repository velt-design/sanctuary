import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

export const professionalCapabilityConfig = {
  marker: 'architects-designers-builders',
  route: '/architects-designers-builders',
  showGuideNavigation: false,
  breadcrumbLabel: 'For architects, designers and builders',
  enquiryType: 'professional',
  schemaKind: 'service',
  description:
    'Develop pergola designs with Sanctuary, from concept, materials and building connections to agreed fabrication and installation.',
  schemaName: 'Pergola capability for architects, designers and builders',
  serviceName: 'Professional pergola collaboration in Auckland',
  serviceType: 'Collaborative pergola design and installation',
  hero: {
    image: '/images/project-kiwi-rail-03.jpg',
    imageAlt:
      'Canopy frame, acrylic roof and building connection at the KiwiRail head office',
    objectPosition: '50% 48%',
    eyebrow: 'For architects, designers and builders',
    title: 'Bring us into the design.',
    intro:
      'Develop the pergola with us. From the architectural idea and material choices to connections, buildability and installation.',
    primaryCta: 'Discuss a project',
    secondaryCta: 'Explore our work',
    secondaryHref: '#professional-projects',
    proof: [],
  },
  blocks: [],
  form: {
    ariaLabel: 'Architect, designer and builder project enquiry form',
    eyebrow: 'Professional project enquiry',
    heading: 'Send your project brief.',
    intro: 'Share the early brief, what is fixed and what we can develop together. Drawings and photographs are optional.',
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
        placeholder: 'Concept, materials, building connections, buildability and the coordination needed for installation',
        wide: true,
      },
    ],
  },
} satisfies SeoLandingPageConfig;
