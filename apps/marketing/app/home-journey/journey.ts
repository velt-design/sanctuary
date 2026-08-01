import type { Project } from '../../data/projects';
import {
  buildEnquiryHref,
  type EnquiryAudience,
} from '../../lib/enquiryContext';

export const HOME_JOURNEY_PATH = '/home-journey';
export const HOME_JOURNEY_VARIANT = 'guided_home_v1';

const journeyAnswerValues = [
  'homeowner',
  'business',
  'simple-cover',
  'bespoke-room',
  'shade-first',
  'daylight-first',
  'acrylic',
  'timber',
  'mixed',
  'architect-designer',
  'hospitality',
  'builder',
] as const;

export type JourneyAnswer = (typeof journeyAnswerValues)[number];

type JourneyQuestionId =
  | 'audience'
  | 'homeowner-service'
  | 'simple-priority'
  | 'bespoke-material'
  | 'business-role';

export type JourneyResultId =
  | 'insulated-roof'
  | 'daylight-roof'
  | 'bespoke-acrylic'
  | 'timber-lined-room'
  | 'mixed-material-room'
  | 'professional-collaboration'
  | 'hospitality-cover'
  | 'builder-collaboration';

type JourneyImage = {
  src: string;
  alt: string;
  objectPosition?: string;
};

type JourneyOption = {
  value: JourneyAnswer;
  label: string;
  detail: string;
  image?: JourneyImage;
};

export type JourneyQuestion = {
  id: JourneyQuestionId;
  eyebrow: string;
  question: string;
  guidance: string;
  step: number;
  total: number;
  presentation: 'image' | 'text';
  options: JourneyOption[];
};

type JourneyProjectReference = {
  slug: string;
  title: string;
  location: string;
  roof: Project['roof'];
  image: JourneyImage;
};

export type JourneyResult = {
  id: JourneyResultId;
  eyebrow: string;
  title: string;
  summary: string;
  considerations: [string, string, string];
  hero: JourneyImage;
  projects: [JourneyProjectReference, JourneyProjectReference];
  enquiryType: EnquiryAudience;
  action: string;
  enquiryHref: string;
};

export type JourneyModel = {
  questions: Record<JourneyQuestionId, JourneyQuestion>;
  results: Record<JourneyResultId, JourneyResult>;
};

export type JourneyScreen =
  | { kind: 'question'; id: JourneyQuestionId }
  | { kind: 'result'; id: JourneyResultId };

type ProjectImageReference = {
  slug: string;
  galleryIndex?: number;
};

type OptionConfig = Omit<JourneyOption, 'image'> & {
  image?: ProjectImageReference;
};

type QuestionConfig = Omit<JourneyQuestion, 'options'> & {
  options: OptionConfig[];
};

type ResultConfig = Omit<
  JourneyResult,
  'hero' | 'projects' | 'enquiryHref'
> & {
  hero: ProjectImageReference;
  projectSlugs: [string, string];
};

const questionConfigs: QuestionConfig[] = [
  {
    id: 'audience',
    eyebrow: 'A guided start',
    question: 'Who are we designing for?',
    guidance: 'Choose the closest starting point.',
    step: 1,
    total: 3,
    presentation: 'image',
    options: [
      {
        value: 'homeowner',
        label: 'My home',
        detail: 'A deck, patio or complete outdoor room.',
        image: { slug: 'warkworth-outdoor-room' },
      },
      {
        value: 'business',
        label: 'A business or project',
        detail: 'Commercial work or professional collaboration.',
        image: { slug: 'goodhome-commercial-terrace' },
      },
    ],
  },
  {
    id: 'homeowner-service',
    eyebrow: 'Your home',
    question: 'How far should the space go?',
    guidance: 'Think about the finished experience, not the product name.',
    step: 2,
    total: 3,
    presentation: 'image',
    options: [
      {
        value: 'simple-cover',
        label: 'A simple deck cover',
        detail: 'Solve shade or shelter with a restrained structure.',
        image: { slug: 'mt-maunganui-box', galleryIndex: 2 },
      },
      {
        value: 'bespoke-room',
        label: 'A complete outdoor room',
        detail: 'Design the roof, finish, lighting and atmosphere together.',
        image: { slug: 'warkworth-outdoor-room', galleryIndex: 0 },
      },
    ],
  },
  {
    id: 'simple-priority',
    eyebrow: 'Simple cover',
    question: 'What should the roof solve first?',
    guidance: 'Both can provide shelter. This sets the first design priority.',
    step: 3,
    total: 3,
    presentation: 'text',
    options: [
      {
        value: 'shade-first',
        label: 'Not enough shade',
        detail: 'Prioritise deeper shade and a more solid ceiling feel.',
      },
      {
        value: 'daylight-first',
        label: 'Shelter without losing light',
        detail: 'Keep adjoining rooms and circulation feeling bright.',
      },
    ],
  },
  {
    id: 'bespoke-material',
    eyebrow: 'Complete outdoor room',
    question: 'What should the room feel like?',
    guidance: 'Choose the material character that feels closest.',
    step: 3,
    total: 3,
    presentation: 'image',
    options: [
      {
        value: 'acrylic',
        label: 'Light and open',
        detail: 'Acrylic roofing and an architectural frame.',
        image: { slug: 'muriwai-courtyard' },
      },
      {
        value: 'timber',
        label: 'Warm and room-like',
        detail: 'A timber-lined ceiling with integrated lighting.',
        image: { slug: 'riverhead-gable-pavilion', galleryIndex: 2 },
      },
      {
        value: 'mixed',
        label: 'A considered mix',
        detail: 'Solid shelter where needed, daylight where it matters.',
        image: { slug: 'tindalls-bay-pavilion', galleryIndex: 0 },
      },
    ],
  },
  {
    id: 'business-role',
    eyebrow: 'Commercial and professional',
    question: 'Where do you sit in the project?',
    guidance: 'This changes the information and project references we show.',
    step: 2,
    total: 2,
    presentation: 'text',
    options: [
      {
        value: 'architect-designer',
        label: 'Architect or designer',
        detail: 'Design, documentation and engineering interfaces.',
      },
      {
        value: 'hospitality',
        label: 'Cafe or restaurant',
        detail: 'Shelter coordinated around the venue and its operation.',
      },
      {
        value: 'builder',
        label: 'Builder',
        detail: 'A defined scope, coordinated supply and installation.',
      },
    ],
  },
];

const resultConfigs: ResultConfig[] = [
  {
    id: 'insulated-roof',
    eyebrow: 'Your direction / Insulated roof',
    title: 'Deep shade. The feeling of a room.',
    summary:
      'Start with an insulated roof zone, then place clear roofing only where the house needs daylight.',
    considerations: [
      'Opaque shade and ceiling character first',
      'Ceiling finish considered with the house',
      'Clear zones only where they earn their place',
    ],
    hero: { slug: 'tindalls-bay-pavilion', galleryIndex: 1 },
    projectSlugs: ['tindalls-bay-pavilion', 'riverhead-gable-pavilion'],
    enquiryType: 'residential',
    action: 'Discuss this direction',
  },
  {
    id: 'daylight-roof',
    eyebrow: 'Your direction / Acrylic roof',
    title: 'Shelter, without turning down the light.',
    summary:
      'An acrylic roof is the clearest starting point when daylight and an open feeling matter most.',
    considerations: [
      'Choose clear, opal or tinted glazing against the brief',
      'Set the roof form around the house connection',
      'Resolve drainage without adding visual weight',
    ],
    hero: { slug: 'dairy-flat-estate' },
    projectSlugs: ['dairy-flat-estate', 'mt-maunganui-box'],
    enquiryType: 'residential',
    action: 'Discuss this direction',
  },
  {
    id: 'bespoke-acrylic',
    eyebrow: 'Your direction / Acrylic outdoor room',
    title: 'A light architectural room.',
    summary:
      'Use roof form, frame proportion and acrylic selection to make a generous room that still feels open.',
    considerations: [
      'Roof form shaped around the existing architecture',
      'Glazing selected for light, glare and outlook',
      'Screens and lighting planned as part of the room',
    ],
    hero: { slug: 'muriwai-courtyard' },
    projectSlugs: ['muriwai-courtyard', 'st-heliers-townhouse'],
    enquiryType: 'residential',
    action: 'Discuss this direction',
  },
  {
    id: 'timber-lined-room',
    eyebrow: 'Your direction / Timber-lined outdoor room',
    title: 'Warmth overhead. Architecture all around.',
    summary:
      'A lined, insulated roof gives the space the warmth and finish of a room while it stays open to the outdoors.',
    considerations: [
      'Timber lining and roof insulation designed together',
      'Lighting integrated into the ceiling',
      'Structure kept open to the garden and outlook',
    ],
    hero: { slug: 'riverhead-gable-pavilion', galleryIndex: 2 },
    projectSlugs: ['riverhead-gable-pavilion', 'warkworth-outdoor-room'],
    enquiryType: 'residential',
    action: 'Discuss this direction',
  },
  {
    id: 'mixed-material-room',
    eyebrow: 'Your direction / Mixed-material outdoor room',
    title: 'Solid shelter, placed light, one resolved room.',
    summary:
      'Combine solid and clear roof zones so comfort, daylight and finish are solved as one composition.',
    considerations: [
      'Solid roofing over the main living zone',
      'Clear zones at entries and daylight-sensitive edges',
      'Ceiling, lighting and screening coordinated early',
    ],
    hero: { slug: 'warkworth-outdoor-room', galleryIndex: 0 },
    projectSlugs: ['warkworth-outdoor-room', 'tindalls-bay-pavilion'],
    enquiryType: 'residential',
    action: 'Discuss this direction',
  },
  {
    id: 'professional-collaboration',
    eyebrow: 'Your direction / Professional collaboration',
    title: 'A specialist pergola partner for the design team.',
    summary:
      'Start with the design intent, documentation status and engineering interfaces, then define the delivery scope.',
    considerations: [
      'Design and documentation responsibilities made clear',
      'Engineering and building interfaces coordinated',
      'Supply and installation scope agreed early',
    ],
    hero: { slug: 'kiwi-rail-platform' },
    projectSlugs: ['kiwi-rail-platform', 'lilliput-mini-golf'],
    enquiryType: 'professional',
    action: 'Share the project brief',
  },
  {
    id: 'hospitality-cover',
    eyebrow: 'Your direction / Hospitality',
    title: 'Shelter that works with the venue.',
    summary:
      'Plan the roof around the building character, customer areas, circulation and the way the venue needs to operate.',
    considerations: [
      'Customer shelter and circulation considered together',
      'Roof form aligned with the existing frontage',
      'Lighting and screening included in the early brief',
    ],
    hero: { slug: 'goodhome-commercial-terrace' },
    projectSlugs: ['goodhome-commercial-terrace', 'atelier-shu-cafe'],
    enquiryType: 'commercial',
    action: 'Share the project brief',
  },
  {
    id: 'builder-collaboration',
    eyebrow: 'Your direction / Builder collaboration',
    title: 'A clear package, coordinated into the wider build.',
    summary:
      'Define the pergola scope, interfaces and programme so supply and installation fit the work around it.',
    considerations: [
      'Drawings and engineering interfaces confirmed',
      'Trade boundaries and fixing zones made clear',
      'Supply and installation sequenced with the build',
    ],
    hero: { slug: 'lilliput-mini-golf', galleryIndex: 3 },
    projectSlugs: ['lilliput-mini-golf', 'ardmore-box-carport'],
    enquiryType: 'professional',
    action: 'Share the project brief',
  },
];

function getProject(catalogue: readonly Project[], slug: string): Project {
  const project = catalogue.find((candidate) => candidate.slug === slug);
  if (!project) throw new Error(`Missing guided-home project: ${slug}`);
  return project;
}

function getImage(
  catalogue: readonly Project[],
  reference: ProjectImageReference,
): JourneyImage {
  const project = getProject(catalogue, reference.slug);
  const image = reference.galleryIndex === undefined
    ? project.heroImage
    : project.gallery[reference.galleryIndex];

  if (!image) {
    throw new Error(
      `Missing guided-home image: ${reference.slug}[${reference.galleryIndex}]`,
    );
  }

  return {
    src: image.src,
    alt: image.alt,
    ...(image.objectPosition
      ? { objectPosition: image.objectPosition }
      : {}),
  };
}

function getProjectReference(
  catalogue: readonly Project[],
  slug: string,
): JourneyProjectReference {
  const project = getProject(catalogue, slug);
  return {
    slug: project.slug,
    title: project.title,
    location: project.location,
    roof: project.roof,
    image: getImage(catalogue, { slug }),
  };
}

export function getJourneyModel(
  catalogue: readonly Project[],
): JourneyModel {
  const questions = Object.fromEntries(
    questionConfigs.map((question) => [
      question.id,
      {
        ...question,
        options: question.options.map((option) => ({
          value: option.value,
          label: option.label,
          detail: option.detail,
          ...(option.image
            ? { image: getImage(catalogue, option.image) }
            : {}),
        })),
      },
    ]),
  ) as Record<JourneyQuestionId, JourneyQuestion>;

  const results = Object.fromEntries(
    resultConfigs.map((result) => {
      const projects = result.projectSlugs.map((slug) =>
        getProjectReference(catalogue, slug),
      ) as [JourneyProjectReference, JourneyProjectReference];

      return [
        result.id,
        {
          id: result.id,
          eyebrow: result.eyebrow,
          title: result.title,
          summary: result.summary,
          considerations: result.considerations,
          hero: getImage(catalogue, result.hero),
          projects,
          enquiryType: result.enquiryType,
          action: result.action,
          enquiryHref: buildEnquiryHref({
            enquiryType: result.enquiryType,
            sourcePath: HOME_JOURNEY_PATH,
            sourceComponent: 'pathway',
          }),
        },
      ];
    }),
  ) as Record<JourneyResultId, JourneyResult>;

  return { questions, results };
}

export function getJourneyScreen(
  answers: readonly JourneyAnswer[],
): JourneyScreen {
  if (answers.length === 0) return { kind: 'question', id: 'audience' };

  const [audience, direction, detail] = answers;

  if (audience === 'homeowner') {
    if (!direction) return { kind: 'question', id: 'homeowner-service' };
    if (direction === 'simple-cover') {
      if (!detail) return { kind: 'question', id: 'simple-priority' };
      if (detail === 'shade-first') {
        return { kind: 'result', id: 'insulated-roof' };
      }
      if (detail === 'daylight-first') {
        return { kind: 'result', id: 'daylight-roof' };
      }
    }
    if (direction === 'bespoke-room') {
      if (!detail) return { kind: 'question', id: 'bespoke-material' };
      if (detail === 'acrylic') {
        return { kind: 'result', id: 'bespoke-acrylic' };
      }
      if (detail === 'timber') {
        return { kind: 'result', id: 'timber-lined-room' };
      }
      if (detail === 'mixed') {
        return { kind: 'result', id: 'mixed-material-room' };
      }
    }
  }

  if (audience === 'business') {
    if (!direction) return { kind: 'question', id: 'business-role' };
    if (direction === 'architect-designer') {
      return { kind: 'result', id: 'professional-collaboration' };
    }
    if (direction === 'hospitality') {
      return { kind: 'result', id: 'hospitality-cover' };
    }
    if (direction === 'builder') {
      return { kind: 'result', id: 'builder-collaboration' };
    }
  }

  return { kind: 'question', id: 'audience' };
}

export function appendJourneyAnswer(
  model: JourneyModel,
  answers: readonly JourneyAnswer[],
  answer: JourneyAnswer,
): JourneyAnswer[] {
  const screen = getJourneyScreen(answers);
  if (screen.kind !== 'question') return [...answers];

  const allowed = model.questions[screen.id].options.some(
    (option) => option.value === answer,
  );
  return allowed ? [...answers, answer] : [...answers];
}

export function getJourneyCompletion(
  answers: readonly JourneyAnswer[],
): { current: number; total: number } {
  const screen = getJourneyScreen(answers);
  if (screen.kind === 'question') {
    const total = answers[0] === 'business' ? 2 : 3;
    return { current: screen.id === 'audience' ? 1 : answers.length + 1, total };
  }

  const total = answers[0] === 'business' ? 2 : 3;
  return { current: total, total };
}
