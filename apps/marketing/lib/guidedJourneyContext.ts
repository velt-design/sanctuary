import type { EnquiryAudience, EnquiryContext } from './enquiryContext';
import {
  GUIDED_ENQUIRY_SOURCE_EXPERIENCE,
  GUIDED_HOME_PATH,
  GUIDED_HOME_VARIANT,
  guidedBusinessRoles,
  guidedBusinessSectors,
  guidedCoverFocuses,
  guidedOutdoorUses,
  guidedProfessionalNeeds,
  guidedProfessionalStages,
  guidedSiteConstraints,
  isGuidedValue,
  type GuidedFocusId,
  type GuidedResultId,
} from './guidedJourneyContract';

type SearchValue = string | string[] | undefined;
export type GuidedJourneySearchParams = Record<string, SearchValue>;

export type GuidedJourneyContext = {
  resultId: GuidedResultId;
  audience: 'home' | 'business' | 'professional';
  focusId: GuidedFocusId;
  focusLabel: string;
  title: string;
  explanation: string;
  destination: string;
  returnHref: string;
  preferredProjectSlugs: readonly string[];
  analyticsProperties: Readonly<{
    experience_variant: typeof GUIDED_HOME_VARIANT;
    audience: 'home' | 'business' | 'professional';
    pathway_result: GuidedResultId;
    final_focus: GuidedFocusId;
    destination: string;
    source_route: typeof GUIDED_HOME_PATH;
  }>;
  enquiryContext: EnquiryContext;
};

type ContextCopy = {
  label: string;
  title: string;
  explanation: string;
  preferredProjectSlugs: readonly string[];
};

const destinationByResult: Record<GuidedResultId, string> = {
  'residential-cover': '/simple-pergolas-auckland',
  'outdoor-room': '/outdoor-rooms-auckland',
  bespoke: '/custom-pergolas-auckland',
  commercial: '/commercial-pergolas-auckland',
  professional: '/architects-designers-builders',
};

const enquiryAudienceByResult: Record<GuidedResultId, EnquiryAudience> = {
  'residential-cover': 'residential',
  'outdoor-room': 'residential',
  bespoke: 'residential',
  commercial: 'commercial',
  professional: 'professional',
};

const residentialCoverCopy: Record<(typeof guidedCoverFocuses)[number], ContextCopy> = {
  daylight: {
    label: 'Keep useful daylight',
    title: 'Shelter without losing daylight.',
    explanation:
      "We'll start with clear and opal acrylic examples. Final roofing depends on the house, orientation and measured site.",
    preferredProjectSlugs: [
      'dairy-flat-estate',
      'mt-maunganui-box',
      'st-heliers-townhouse',
    ],
  },
  shade: {
    label: 'Create more shade',
    title: 'Add shelter and useful shade.',
    explanation:
      "We'll start with completed residential covers, then assess roof opacity, orientation and the shade the site actually needs.",
    preferredProjectSlugs: [
      'st-heliers-townhouse',
      'dairy-flat-estate',
      'mt-maunganui-box',
    ],
  },
  balanced: {
    label: 'Balance daylight and shade',
    title: 'Balance light, shelter and glare.',
    explanation:
      "We'll compare completed roof responses first. The useful balance depends on orientation, adjoining rooms and the measured site.",
    preferredProjectSlugs: [
      'dairy-flat-estate',
      'st-heliers-townhouse',
      'mt-maunganui-box',
    ],
  },
};

const outdoorRoomCopy: Record<(typeof guidedOutdoorUses)[number], ContextCopy> = {
  everyday: {
    label: 'Everyday family use',
    title: 'An outdoor room for everyday life.',
    explanation:
      "We'll start with rooms that coordinate shelter, comfortable edges and services around regular use.",
    preferredProjectSlugs: [
      'warkworth-outdoor-room',
      'tindalls-bay-pavilion',
      'riverhead-gable-pavilion',
    ],
  },
  entertaining: {
    label: 'Dining and entertaining',
    title: 'Plan the room around gathering.',
    explanation:
      "We'll start with examples that coordinate dining, circulation, lighting and changing weather edges.",
    preferredProjectSlugs: [
      'warkworth-outdoor-room',
      'tindalls-bay-pavilion',
      'riverhead-gable-pavilion',
    ],
  },
  poolside: {
    label: 'Poolside living',
    title: 'Connect shelter with the poolside setting.',
    explanation:
      "We'll start with poolside and open-garden examples, then review views, circulation and exposure on your site.",
    preferredProjectSlugs: [
      'riverhead-gable-pavilion',
      'warkworth-outdoor-room',
      'tindalls-bay-pavilion',
    ],
  },
};

const bespokeCopy: Record<(typeof guidedSiteConstraints)[number], ContextCopy> = {
  connection: {
    label: 'A difficult house connection',
    title: 'Resolve the connection as part of the design.',
    explanation:
      "We'll start with projects shaped around rooflines, openings and layered building edges. The verified site sets the final answer.",
    preferredProjectSlugs: [
      'tindalls-bay-pavilion',
      'warkworth-outdoor-room',
      'ardmore-box-carport',
    ],
  },
  structure: {
    label: 'Restricted posts, spans or levels',
    title: 'Let structure follow the difficult condition.',
    explanation:
      "We'll start with projects where spans, posts, levels or mixed structure required a site-specific response.",
    preferredProjectSlugs: [
      'ardmore-box-carport',
      'tindalls-bay-pavilion',
      'warkworth-outdoor-room',
    ],
  },
  coordination: {
    label: 'Coordination with plans or a wider project',
    title: 'Coordinate the pergola with the wider project.',
    explanation:
      "We'll start with examples where interfaces, sequencing and responsibilities mattered alongside the pergola itself.",
    preferredProjectSlugs: [
      'tindalls-bay-pavilion',
      'ardmore-box-carport',
      'warkworth-outdoor-room',
    ],
  },
};

const sectorLabels: Record<(typeof guidedBusinessSectors)[number], string> = {
  hospitality: 'Hospitality venue',
  workplace: 'Workplace',
  recreation: 'Recreation or visitor venue',
};

const roleCopy: Record<(typeof guidedBusinessRoles)[number], Pick<ContextCopy, 'title' | 'explanation'>> = {
  lead: {
    title: 'A Sanctuary-led commercial pathway.',
    explanation:
      "We'll start with completed work where Sanctuary led the pergola scope, then confirm the site, operating constraints and project responsibilities.",
  },
  collaborate: {
    title: 'A defined role within the project team.',
    explanation:
      "We'll start with consultant-led examples, then agree drawings, interfaces, responsibilities and the installation pathway.",
  },
  feasibility: {
    title: 'Test feasibility before fixing the scope.',
    explanation:
      "We'll start with relevant built evidence, then review the site, intended use and constraints before proposing a delivery role.",
  },
};

const commercialProjectOrder: Record<(typeof guidedBusinessSectors)[number], readonly string[]> = {
  hospitality: [
    'goodhome-commercial-terrace',
    'lilliput-mini-golf',
    'kiwi-rail-platform',
  ],
  workplace: [
    'kiwi-rail-platform',
    'goodhome-commercial-terrace',
    'lilliput-mini-golf',
  ],
  recreation: [
    'lilliput-mini-golf',
    'goodhome-commercial-terrace',
    'kiwi-rail-platform',
  ],
};

const stageLabels: Record<(typeof guidedProfessionalStages)[number], string> = {
  concept: 'Early brief or concept',
  developed: 'Developed design or documentation',
  delivery: 'Procurement or delivery',
};

const professionalNeedCopy: Record<(typeof guidedProfessionalNeeds)[number], Pick<ContextCopy, 'title' | 'explanation' | 'preferredProjectSlugs'>> = {
  'design-input': {
    title: 'Bring pergola input into the design early.',
    explanation:
      "We'll start with architect-led evidence, then define the open decisions, technical inputs and responsibility Sanctuary should own.",
    preferredProjectSlugs: [
      'kiwi-rail-platform',
      'goodhome-commercial-terrace',
      'lilliput-mini-golf',
    ],
  },
  scope: {
    title: 'Define a clear pergola scope.',
    explanation:
      "We'll start with completed collaboration models, then agree deliverables, exclusions, interfaces and the information needed next.",
    preferredProjectSlugs: [
      'goodhome-commercial-terrace',
      'kiwi-rail-platform',
      'lilliput-mini-golf',
    ],
  },
  'delivery-coordination': {
    title: 'Coordinate the package through delivery.',
    explanation:
      "We'll start with consultant-led delivery evidence, then confirm release information, interfaces, sequencing and handover responsibilities.",
    preferredProjectSlugs: [
      'lilliput-mini-golf',
      'kiwi-rail-platform',
      'goodhome-commercial-terrace',
    ],
  },
};

function readSingle(params: GuidedJourneySearchParams, key: string): string | null {
  const value = params[key];
  return typeof value === 'string' ? value : null;
}

function buildContext(
  resultId: GuidedResultId,
  audience: GuidedJourneyContext['audience'],
  focusId: GuidedFocusId,
  copy: ContextCopy,
  returnParams: ReadonlyArray<readonly [string, string]>,
): GuidedJourneyContext {
  const destination = destinationByResult[resultId];
  const returnSearchParams = new URLSearchParams(
    returnParams.map(([key, value]) => [key, value]),
  );

  return {
    resultId,
    audience,
    focusId,
    focusLabel: copy.label,
    title: copy.title,
    explanation: copy.explanation,
    destination,
    returnHref: `${GUIDED_HOME_PATH}?${returnSearchParams.toString()}`,
    preferredProjectSlugs: copy.preferredProjectSlugs,
    analyticsProperties: {
      experience_variant: GUIDED_HOME_VARIANT,
      audience,
      pathway_result: resultId,
      final_focus: focusId,
      destination,
      source_route: GUIDED_HOME_PATH,
    },
    enquiryContext: {
      enquiryType: enquiryAudienceByResult[resultId],
      sourcePath: destination,
      sourceComponent: 'embedded_form',
      sourceExperience: GUIDED_ENQUIRY_SOURCE_EXPERIENCE,
      sourcePathway: resultId,
      sourceFocus: focusId,
    },
  };
}

export function resolveGuidedJourneyContext(
  resultId: GuidedResultId,
  params: GuidedJourneySearchParams,
): GuidedJourneyContext | null {
  if (resultId === 'residential-cover') {
    const focus = readSingle(params, 'focus');
    if (!isGuidedValue(guidedCoverFocuses, focus)) return null;
    return buildContext(
      resultId,
      'home',
      focus,
      residentialCoverCopy[focus],
      [
        ['audience', 'home'],
        ['goal', 'straightforward-cover'],
        ['focus', focus],
      ],
    );
  }

  if (resultId === 'outdoor-room') {
    const use = readSingle(params, 'use');
    if (!isGuidedValue(guidedOutdoorUses, use)) return null;
    return buildContext(
      resultId,
      'home',
      use,
      outdoorRoomCopy[use],
      [
        ['audience', 'home'],
        ['goal', 'outdoor-room'],
        ['use', use],
      ],
    );
  }

  if (resultId === 'bespoke') {
    const constraint = readSingle(params, 'constraint');
    if (!isGuidedValue(guidedSiteConstraints, constraint)) return null;
    return buildContext(
      resultId,
      'home',
      constraint,
      bespokeCopy[constraint],
      [
        ['audience', 'home'],
        ['goal', 'difficult-site'],
        ['constraint', constraint],
      ],
    );
  }

  if (resultId === 'commercial') {
    const sector = readSingle(params, 'sector');
    const role = readSingle(params, 'role');
    if (
      !isGuidedValue(guidedBusinessSectors, sector)
      || !isGuidedValue(guidedBusinessRoles, role)
    ) {
      return null;
    }
    const roleContext = roleCopy[role];
    return buildContext(
      resultId,
      'business',
      role,
      {
        label: `${sectorLabels[sector]} / ${role === 'lead' ? 'Sanctuary-led scope' : role === 'collaborate' ? 'Project-team collaboration' : 'Early feasibility'}`,
        title: roleContext.title,
        explanation: roleContext.explanation,
        preferredProjectSlugs: commercialProjectOrder[sector],
      },
      [
        ['audience', 'business'],
        ['sector', sector],
        ['role', role],
      ],
    );
  }

  const stage = readSingle(params, 'stage');
  const need = readSingle(params, 'need');
  if (
    !isGuidedValue(guidedProfessionalStages, stage)
    || !isGuidedValue(guidedProfessionalNeeds, need)
  ) {
    return null;
  }
  const needContext = professionalNeedCopy[need];
  return buildContext(
    resultId,
    'professional',
    need,
    {
      label: `${stageLabels[stage]} / ${need === 'design-input' ? 'Design input' : need === 'scope' ? 'Scope definition' : 'Delivery coordination'}`,
      title: needContext.title,
      explanation: needContext.explanation,
      preferredProjectSlugs: needContext.preferredProjectSlugs,
    },
    [
      ['audience', 'professional'],
      ['stage', stage],
      ['need', need],
    ],
  );
}

export function orderGuidedItemsBySlug<T extends { slug: string }>(
  items: readonly T[],
  preferredProjectSlugs: readonly string[] = [],
): T[] {
  if (!preferredProjectSlugs.length) return [...items];
  const preferredIndex = new Map(
    preferredProjectSlugs.map((slug, index) => [slug, index]),
  );
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftRank = preferredIndex.get(left.item.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = preferredIndex.get(right.item.slug) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ item }) => item);
}
