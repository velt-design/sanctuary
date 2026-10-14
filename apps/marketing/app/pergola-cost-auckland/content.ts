import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

export const costFaqItems = [
  { question: 'How much does a pergola cost in Auckland?', answer: ['The estimator above gives an initial installed price for your selected size, roofline and material where pricing is available. It includes GST and standard installation allowances. Site conditions and the complete agreed scope determine the final quote.'] },
  { question: 'What is included in the estimate?', answer: ['The selected structure, roofing, any priced options added in the designer, standard installation allowances and GST. Site-specific foundations, connections, drainage, access, engineering and consent requirements need confirmation. Work such as decking or electrical installation is included only when expressly agreed.'] },
  { question: 'Can I get help before I know the dimensions?', answer: ['Yes. Send photos, your Auckland location and what you want the space to do. Rough dimensions help, but are optional. We can discuss the design and a site measure before preparing a proposal.'] },
  { question: 'How should I compare pergola quotes?', answer: ['Compare the same footprint, roofing, finish and extras. Then check installation, GST, site work, drainage, approvals and exclusions. Ask what is fixed, what is allowed for and what still needs site confirmation.'] },
] as const;

export const pergolaCostConfig = {
  route: '/pergola-cost-auckland',
  description: 'Explore an initial pergola estimate for supported designs, understand Auckland installation cost drivers and compare what each quote includes.',
  hero: {
    image: '/images/project-st-heliers-01.jpg',
    imageAlt: 'Open-gable acrylic pergola at a St Heliers townhouse in Auckland',
    eyebrow: 'Pergola cost in Auckland',
    title: 'What will your pergola cost?',
    intro: 'Start with your size and roof choices. See an initial installed estimate, then work through the details with us.',
    primaryCta: 'Explore your estimate', primaryHref: '#explore-options',
    secondaryCta: 'Talk about your project', secondaryHref: '#project-details',
    proof: ['Your dimensions and choices', 'Standard installation and GST', 'Subject to site confirmation'],
  },
  form: {
    ariaLabel: 'Pergola cost enquiry form',
    eyebrow: 'Project brief',
    heading: 'Tell us about the scope.',
    intro: 'Share the site, rough dimensions and intended use.',
    submitLabel: 'Send project brief',
    messageLabel: 'Project scope',
    messagePlaceholder: 'Describe the structure, roof, edges and options you want considered.',
    briefFields: [
      { name: 'scopePriorities', label: 'Main scope priorities', type: 'textarea', placeholder: 'Structure, roofing, edges, lighting or other work', wide: true },
      { name: 'existingWork', label: 'Existing or connected work', type: 'text', placeholder: 'Deck, renovation, landscaping or other trades', wide: true },
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
} satisfies Pick<SeoLandingPageConfig, 'route' | 'description' | 'hero' | 'form'>;
