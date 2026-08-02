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
  evidenceReasonBySlug: Readonly<Record<string, string>>;
};

export const projectDirectionContent: Record<
  ProjectDirection,
  ProjectDirectionContent
> = {
  cover: {
    label: projectDirectionLabels.cover,
    description:
      'Shelter for a deck or patio, balanced with daylight, shade and the connection to the house.',
    responseHeading: 'Residential pergola planning',
    responseExplanation:
      'Start with a refined fixed-roof pergola designed around shelter, daylight, shade and the connection to the house.',
    pathwayLabel: 'Explore residential pergolas',
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
      'An integrated space for dining, cooking, entertaining or everyday use.',
    responseHeading: 'A complete outdoor room',
    responseExplanation:
      'Start with a more integrated space where roofing, layout, lighting, furniture and key features can be considered together.',
    pathwayLabel: 'Explore outdoor rooms',
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
      'A design-led response for difficult geometry, levels, structure or wider project coordination.',
    responseHeading: 'Bespoke pergola design',
    responseExplanation:
      'Start with a design-led pathway for difficult connections, structure, levels, geometry or coordination with a wider project.',
    pathwayLabel: 'Explore bespoke pergolas',
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
  { label: string; description: string }
> = {
  daylight: {
    label: projectPriorityLabels.daylight,
    description:
      'Add shelter without making the adjoining interior or deck feel dark.',
  },
  shade: {
    label: projectPriorityLabels.shade,
    description:
      'Reduce direct sun and make the space more comfortable through warmer weather.',
  },
  'everyday-use': {
    label: projectPriorityLabels['everyday-use'],
    description:
      'Create reliable shelter for everyday dining, relaxing or changing weather.',
  },
  entertaining: {
    label: projectPriorityLabels.entertaining,
    description:
      'Allow for furniture, lighting, services, a kitchen, fireplace or gathering space.',
  },
  'open-structure': {
    label: projectPriorityLabels['open-structure'],
    description:
      'Protect views, circulation and key areas from unnecessary posts or visual weight.',
  },
  coordination: {
    label: projectPriorityLabels.coordination,
    description:
      'Work with renovations, drawings, consultants, builders or other trades.',
  },
};
