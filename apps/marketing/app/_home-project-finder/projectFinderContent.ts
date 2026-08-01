import type {
  ProjectDirection,
  ProjectPriority,
} from '@/lib/projectFinderContract';
import {
  projectDirectionLabels,
  projectPriorityLabels,
} from '@/lib/projectFinderContract';

export type ProjectDirectionContent = {
  label: string;
  description: string;
  responseHeading: string;
  responseExplanation: string;
  pathwayLabel: string;
  pathwayHref: string;
  evidenceReasonBySlug: Readonly<Record<string, string>>;
};

export const projectDirectionContent: Record<
  ProjectDirection,
  ProjectDirectionContent
> = {
  cover: {
    label: projectDirectionLabels.cover,
    description:
      'Reliable shelter over a deck or patio, with light, shade and connection to the house considered carefully.',
    responseHeading: 'Residential pergola planning',
    responseExplanation:
      'Start with a refined fixed-roof pergola designed around shelter, daylight, shade and the connection to the house.',
    pathwayLabel: 'Explore residential pergolas',
    pathwayHref: '/pergolas-auckland',
    evidenceReasonBySlug: {
      'dairy-flat-estate':
        'The new gable follows the house roofline while keeping daylight central to the brief.',
      'st-heliers-townhouse':
        'A compact townhouse cover with an open gable and a deliberate street-facing frame.',
    },
  },
  'outdoor-room': {
    label: projectDirectionLabels['outdoor-room'],
    description:
      'A more integrated space for dining, entertaining, cooking, relaxing or poolside use.',
    responseHeading: 'A complete outdoor room',
    responseExplanation:
      'Start with a more integrated space where roofing, layout, lighting, furniture and key features can be considered together.',
    pathwayLabel: 'Explore outdoor rooms',
    pathwayHref: '/outdoor-rooms-auckland',
    evidenceReasonBySlug: {
      'warkworth-outdoor-room':
        'Roofing, cedar lining, a new deck, fireplace and lighting were planned as one room.',
      'riverhead-gable-pavilion':
        'A timber-lined poolside pavilion keeps the outlook open and integrates warm lighting.',
    },
  },
  bespoke: {
    label: projectDirectionLabels.bespoke,
    description:
      'For unusual geometry, restricted posts, changing levels, difficult roof connections or wider project coordination.',
    responseHeading: 'Bespoke pergola design',
    responseExplanation:
      'Start with a design-led pathway for difficult connections, structure, levels, geometry or coordination with a wider project.',
    pathwayLabel: 'Explore bespoke pergolas',
    pathwayHref: '/custom-pergolas-auckland',
    evidenceReasonBySlug: {
      'tindalls-bay-pavilion':
        'Mixed roof zones resolve a combined patio and carport around complex house geometry.',
      'ardmore-box-carport':
        'A wide clear-access span combines a box perimeter with an internal gable roof form.',
    },
  },
};

export const projectPriorityContent: Record<
  ProjectPriority,
  { label: string; description: string; briefPhrase: string }
> = {
  daylight: {
    label: projectPriorityLabels.daylight,
    description:
      'Add shelter without making the adjoining interior or deck feel dark.',
    briefPhrase: 'natural light',
  },
  shade: {
    label: projectPriorityLabels.shade,
    description:
      'Reduce direct sun and make the space more comfortable through warmer weather.',
    briefPhrase: 'more shade and comfort',
  },
  'everyday-use': {
    label: projectPriorityLabels['everyday-use'],
    description:
      'Create reliable shelter for everyday dining, relaxing or changing weather.',
    briefPhrase: 'regular use',
  },
  entertaining: {
    label: projectPriorityLabels.entertaining,
    description:
      'Allow for furniture, lighting, services, a kitchen, fireplace or gathering space.',
    briefPhrase: 'cooking and entertaining',
  },
  'open-structure': {
    label: projectPriorityLabels['open-structure'],
    description:
      'Protect views, circulation and key areas from unnecessary posts or visual weight.',
    briefPhrase: 'an open-feeling structure',
  },
  coordination: {
    label: projectPriorityLabels.coordination,
    description:
      'Work with renovations, drawings, consultants, builders or other trades.',
    briefPhrase: 'coordination with the wider project',
  },
};

export const priorityOrderByDirection: Record<
  ProjectDirection,
  readonly ProjectPriority[]
> = {
  cover: [
    'daylight',
    'shade',
    'everyday-use',
    'open-structure',
    'entertaining',
    'coordination',
  ],
  'outdoor-room': [
    'everyday-use',
    'entertaining',
    'daylight',
    'shade',
    'coordination',
    'open-structure',
  ],
  bespoke: [
    'open-structure',
    'coordination',
    'daylight',
    'everyday-use',
    'shade',
    'entertaining',
  ],
};

const briefDirection: Record<ProjectDirection, string> = {
  cover: 'A refined deck cover',
  'outdoor-room': 'A complete outdoor room',
  bespoke: 'A bespoke pergola response',
};

function joinPhrases(phrases: readonly string[]): string {
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, and ${phrases.at(-1)}`;
}

export function buildBriefHeading(
  direction: ProjectDirection,
  priorities: readonly ProjectPriority[],
): string {
  const ordered = priorityOrderByDirection[direction]
    .filter((priority) => priorities.includes(priority))
    .map((priority) => projectPriorityContent[priority].briefPhrase);

  return ordered.length
    ? `${briefDirection[direction]} for ${joinPhrases(ordered)}.`
    : `${briefDirection[direction]} shaped around your site, home and intended use.`;
}

function buildSelectedPriorityLabel(
  priorities: readonly ProjectPriority[],
): string {
  return priorities.map((priority) => projectPriorityContent[priority].label).join(', ');
}
