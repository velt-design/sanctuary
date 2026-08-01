import type {
  GuidedBusinessRole,
  GuidedBusinessSector,
  GuidedCoverFocus,
  GuidedOutdoorUse,
  GuidedProfessionalNeed,
  GuidedProfessionalStage,
  GuidedResultId,
  GuidedSiteConstraint,
} from '@/lib/guidedJourneyContract';
import type {
  GuidedQuestion,
  GuidedQuestionId,
} from './guidedConversationModel';

export const guidedQuestions: Record<GuidedQuestionId, GuidedQuestion> = {
  audience: {
    id: 'audience',
    eyebrow: 'A guided starting point',
    title: 'Who are you planning for?',
    treatment: 'type-led',
    step: 1,
    options: [
      {
        value: 'home',
        label: 'My home',
        description: 'A deck, patio, pool area or outdoor living space.',
      },
      {
        value: 'business',
        label: 'A business or venue',
        description: 'Hospitality, workplace, recreation or another shared site.',
      },
      {
        value: 'professional',
        label: 'A client project',
        description: 'For architects, designers and builders.',
      },
    ],
  },
  'home-goal': {
    id: 'home-goal',
    eyebrow: 'Your home',
    title: 'What are you trying to create?',
    treatment: 'image-led',
    step: 2,
    options: [
      {
        value: 'straightforward-cover',
        label: 'A straightforward cover',
        description: 'A refined, uncomplicated roof over a deck or patio.',
      },
      {
        value: 'outdoor-room',
        label: 'A complete outdoor room',
        description: 'A space for dining, entertaining, cooking or relaxing.',
      },
      {
        value: 'difficult-site',
        label: 'A solution for a difficult site',
        description: 'Unusual geometry, restricted posts, roof connections or changing levels.',
      },
    ],
  },
  'home-cover-focus': {
    id: 'home-cover-focus',
    eyebrow: 'Straightforward cover',
    title: 'What should the roof improve most?',
    treatment: 'type-led',
    step: 3,
    options: [
      {
        value: 'daylight',
        label: 'Shelter without losing daylight',
        description: 'Keep the deck bright while adding reliable rain cover.',
      },
      {
        value: 'shade',
        label: 'More shade and thermal comfort',
        description: 'Reduce direct sun and create a more protected space.',
      },
      {
        value: 'balanced',
        label: 'A balance of light and shelter',
        description: 'Use different roof zones for different parts of the space.',
      },
    ],
  },
  'home-outdoor-use': {
    id: 'home-outdoor-use',
    eyebrow: 'Complete outdoor room',
    title: 'How do you want to use the space?',
    treatment: 'type-led',
    step: 3,
    options: [
      {
        value: 'everyday',
        label: 'Everyday dining and relaxing',
        description: 'A comfortable extension of daily home life.',
      },
      {
        value: 'entertaining',
        label: 'Cooking and entertaining',
        description: 'A complete setting for guests, food, lighting or a fireplace.',
      },
      {
        value: 'poolside',
        label: 'Poolside use and changing weather',
        description: 'Shelter, privacy and seasonal flexibility around the pool.',
      },
    ],
  },
  'home-site-constraint': {
    id: 'home-site-constraint',
    eyebrow: 'Difficult site',
    title: 'What is driving the complexity?',
    treatment: 'type-led',
    step: 3,
    options: [
      {
        value: 'connection',
        label: 'The house or roof connection',
        description: 'Existing eaves, openings, cladding or an unusual roofline.',
      },
      {
        value: 'structure',
        label: 'Posts, spans or changing levels',
        description: 'Restricted structure, circulation, views or difficult geometry.',
      },
      {
        value: 'coordination',
        label: 'Plans and project coordination',
        description: 'An architect-led renovation or work involving other consultants and trades.',
      },
    ],
  },
  'business-sector': {
    id: 'business-sector',
    eyebrow: 'Business or venue',
    title: 'What kind of place is it?',
    treatment: 'image-led',
    step: 2,
    options: [
      {
        value: 'hospitality',
        label: 'Hospitality or customer-facing venue',
        description: 'Restaurants, cafes, accommodation or public-facing spaces.',
      },
      {
        value: 'workplace',
        label: 'Workplace or shared site',
        description: 'Covered routes, courtyards, staff areas or common spaces.',
      },
      {
        value: 'recreation',
        label: 'Recreation or specialist setting',
        description: 'Sport, entertainment, community or another specialist environment.',
      },
    ],
  },
  'business-role': {
    id: 'business-role',
    eyebrow: 'Commercial involvement',
    title: 'How should Sanctuary be involved?',
    treatment: 'type-led',
    step: 3,
    options: [
      {
        value: 'lead',
        label: 'Lead the design and delivery',
        description: 'Develop and deliver the complete pergola scope.',
      },
      {
        value: 'collaborate',
        label: 'Work within an existing team',
        description: 'Coordinate with architects, engineers, builders or consultants.',
      },
      {
        value: 'feasibility',
        label: 'Establish feasibility and scope',
        description: 'Review the site, intended use and likely delivery pathway.',
      },
    ],
  },
  'professional-stage': {
    id: 'professional-stage',
    eyebrow: 'Client project',
    title: 'What stage is the project at?',
    treatment: 'type-led',
    step: 2,
    options: [
      {
        value: 'concept',
        label: 'Early feasibility or concept',
        description: 'The pergola scope is still being shaped.',
      },
      {
        value: 'developed',
        label: 'Developed design or tender',
        description: 'Drawings, scope or pricing information are being prepared.',
      },
      {
        value: 'delivery',
        label: 'Coordination and delivery',
        description: 'The project is moving toward fabrication and installation.',
      },
    ],
  },
  'professional-need': {
    id: 'professional-need',
    eyebrow: 'Professional collaboration',
    title: 'What do you need from Sanctuary?',
    treatment: 'type-led',
    step: 3,
    options: [
      {
        value: 'design-input',
        label: 'Design input and buildability',
        description: 'Help resolving form, structure, roofing or interfaces.',
      },
      {
        value: 'scope',
        label: 'Scope, pricing and responsibilities',
        description: 'Clear inclusions, boundaries and delivery roles.',
      },
      {
        value: 'delivery-coordination',
        label: 'Supply, installation and coordination',
        description: 'Delivery within the wider project programme.',
      },
    ],
  },
};

export const resultTitles: Record<GuidedResultId, string> = {
  'residential-cover': 'Residential pergola planning',
  'outdoor-room': 'Complete outdoor room',
  bespoke: 'Bespoke pergola',
  commercial: 'Commercial pergola planning',
  professional: 'Professional collaboration',
};

export const resultCtaLabels: Record<GuidedResultId, string> = {
  'residential-cover': 'Explore residential pergolas',
  'outdoor-room': 'Explore outdoor rooms',
  bespoke: 'Explore bespoke pergolas',
  commercial: 'Explore commercial projects',
  professional: 'Explore professional collaboration',
};

export const resultRoutes: Record<GuidedResultId, string> = {
  'residential-cover': '/pergolas-auckland',
  'outdoor-room': '/outdoor-rooms-auckland',
  bespoke: '/custom-pergolas-auckland',
  commercial: '/commercial-pergolas-auckland',
  professional: '/architects-designers-builders',
};

export const coverExplanations: Record<GuidedCoverFocus, string> = {
  daylight:
    'A residential pergola with acrylic or mixed roofing is a useful starting point when shelter and natural light both matter.',
  shade:
    'A more solid or insulated roof direction is worth exploring when shade and thermal comfort lead the brief.',
  balanced:
    'A combination roof is worth exploring when different parts of the space need different light and shelter conditions.',
};

export const outdoorExplanations: Record<GuidedOutdoorUse, string> = {
  everyday:
    'Your best starting point is an outdoor room planned around furniture, circulation and daily use.',
  entertaining:
    'Your best starting point is an integrated outdoor room where roofing, lighting, services and key features are planned together.',
  poolside:
    'Your best starting point is a poolside outdoor room with shelter, changing edges and privacy considered as one design.',
};

export const bespokeExplanations: Record<GuidedSiteConstraint, string> = {
  connection:
    'A bespoke pergola pathway is the best starting point when the house connection must be resolved as part of the design.',
  structure:
    'A bespoke pergola pathway is the best starting point when posts, spans, levels or circulation cannot follow a conventional layout.',
  coordination:
    'A bespoke pergola pathway is the best starting point when the pergola must coordinate with plans, consultants or a wider project.',
};

const commercialSectorPhrases: Record<GuidedBusinessSector, string> = {
  hospitality: 'a hospitality or customer-facing venue',
  workplace: 'a workplace or shared site',
  recreation: 'a recreation or specialist setting',
};

const professionalStagePhrases: Record<GuidedProfessionalStage, string> = {
  concept: 'early feasibility or concept work',
  developed: 'a developed design or tender',
  delivery: 'a project moving into coordination and delivery',
};

export function commercialExplanation(
  sector: GuidedBusinessSector,
  role: GuidedBusinessRole,
): string {
  const sectorPhrase = commercialSectorPhrases[sector];
  if (role === 'lead') {
    return `A commercial design-and-build pathway is the best starting point for ${sectorPhrase} that needs Sanctuary to lead the pergola scope.`;
  }
  if (role === 'collaborate') {
    return `The commercial collaboration pathway is the best starting point for ${sectorPhrase} already supported by a wider project team.`;
  }
  return `An early commercial feasibility review is the best starting point for ${sectorPhrase} that still needs its scope defined.`;
}

export function professionalExplanation(
  stage: GuidedProfessionalStage,
  need: GuidedProfessionalNeed,
): string {
  const stagePhrase = professionalStagePhrases[stage];
  if (need === 'design-input') {
    return `Professional collaboration is the best starting point for ${stagePhrase} that needs pergola design and buildability input.`;
  }
  if (need === 'scope') {
    return `Professional collaboration is the best starting point when ${stagePhrase} needs scope, pricing and responsibilities confirmed.`;
  }
  return `Professional collaboration is the best starting point when ${stagePhrase} needs supply, installation and programme coordination.`;
}
