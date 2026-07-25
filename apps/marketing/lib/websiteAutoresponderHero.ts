import { projects, type Project } from '../data/projects';

const MARKETING_ORIGIN = 'https://www.sanctuarypergolas.co.nz';

type PergolaForm = Project['roof'];
type RoofSelection = 'acrylic' | 'timber' | 'mixed' | 'unknown';

export type WebsiteAutoresponderHero = Readonly<{
  projectSlug: string;
  projectTitle: string;
  projectHref: string;
  imageUrl: string;
  imageAlt: string;
  location: string;
  roofApproach: string;
  match: 'exact' | 'form-only' | 'professional' | 'fallback';
}>;

type HeroInput = Readonly<{
  enquiryType?: unknown;
  style?: unknown;
  roof?: unknown;
}>;

function normalizePergolaForm(value: unknown): PergolaForm | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('gable')) return 'Gable';
  if (normalized.includes('hip')) return 'Hip';
  if (normalized.includes('perimeter') || normalized.includes('box')) return 'Perimeter';
  if (normalized.includes('pitch') || normalized.includes('mono')) return 'Pitched';
  return null;
}

function normalizeRoofSelection(value: unknown): RoofSelection {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.includes('not selected')) return 'unknown';

  const hasAcrylic =
    normalized.includes('acrylic')
    || normalized.includes('polycarbonate')
    || normalized.includes('glazing');
  const hasTimber =
    normalized.includes('timber')
    || normalized.includes('solid')
    || normalized.includes('insulated');

  if (normalized.includes('both') || normalized.includes('mixed') || (hasAcrylic && hasTimber)) {
    return 'mixed';
  }
  if (hasTimber) return 'timber';
  if (hasAcrylic) return 'acrylic';
  return 'unknown';
}

function findProject(slug: string): Project {
  const project = projects.find((candidate) => candidate.slug === slug);
  if (!project) {
    throw new Error(`Missing governed project for website autoresponder hero: ${slug}`);
  }
  return project;
}

function findProjectImage(project: Project, imagePath?: string) {
  const images = [
    project.heroImage,
    ...(project.caseStudyHeroImage ? [project.caseStudyHeroImage] : []),
    ...project.gallery,
  ];
  const image = imagePath
    ? images.find((candidate) => candidate.src === imagePath)
    : project.heroImage;
  if (!image) {
    throw new Error(
      `Missing governed image ${imagePath ?? 'hero'} for website autoresponder project ${project.slug}`,
    );
  }
  return image;
}

function createHero(
  projectSlug: string,
  options: {
    imagePath?: string;
    match: WebsiteAutoresponderHero['match'];
  },
): WebsiteAutoresponderHero {
  const project = findProject(projectSlug);
  const image = findProjectImage(project, options.imagePath);
  return Object.freeze({
    projectSlug: project.slug,
    projectTitle: project.title,
    projectHref: `${MARKETING_ORIGIN}/projects/${project.slug}`,
    imageUrl: `${MARKETING_ORIGIN}${image.src}`,
    imageAlt: image.alt,
    location: project.location,
    roofApproach: project.roofApproach,
    match: options.match,
  });
}

const HEROES = {
  fallback: createHero('warkworth-outdoor-room', {
    imagePath: '/images/project-warkworth-outdoor-room-07.jpg',
    match: 'fallback',
  }),
  professional: createHero('kiwi-rail-platform', {
    imagePath: '/images/project-kiwi-rail-01.jpg',
    match: 'professional',
  }),
  pitchedAcrylic: createHero('lilliput-mini-golf', {
    match: 'exact',
  }),
  pitchedMixed: createHero('tindalls-bay-pavilion', {
    imagePath: '/images/project-tindalls-bay-03.jpg',
    match: 'exact',
  }),
  gableMixed: createHero('warkworth-outdoor-room', {
    imagePath: '/images/project-warkworth-outdoor-room-07.jpg',
    match: 'exact',
  }),
  gableTimber: createHero('riverhead-gable-pavilion', {
    match: 'exact',
  }),
  gableAcrylicResidential: createHero('dairy-flat-estate', {
    match: 'exact',
  }),
  gableAcrylicCommercial: createHero('goodhome-commercial-terrace', {
    imagePath: '/images/project-goodhome-03.jpg',
    match: 'exact',
  }),
  hip: createHero('muriwai-courtyard', {
    match: 'exact',
  }),
  perimeter: createHero('mt-maunganui-box', {
    match: 'exact',
  }),
} as const;

function withMatch(
  hero: WebsiteAutoresponderHero,
  match: WebsiteAutoresponderHero['match'],
): WebsiteAutoresponderHero {
  return hero.match === match ? hero : Object.freeze({ ...hero, match });
}

export function resolveWebsiteAutoresponderHero(
  input: HeroInput,
): WebsiteAutoresponderHero {
  if (
    typeof input.enquiryType === 'string'
    && input.enquiryType.trim().toLowerCase() === 'professional'
  ) {
    return HEROES.professional;
  }

  const form = normalizePergolaForm(input.style);
  const roof = normalizeRoofSelection(input.roof);

  if (form === 'Gable') {
    if (roof === 'mixed') return HEROES.gableMixed;
    if (roof === 'timber') return HEROES.gableTimber;
    if (roof === 'acrylic') {
      return typeof input.enquiryType === 'string'
        && input.enquiryType.trim().toLowerCase() === 'commercial'
        ? HEROES.gableAcrylicCommercial
        : HEROES.gableAcrylicResidential;
    }
    return withMatch(HEROES.gableMixed, 'form-only');
  }

  if (form === 'Pitched') {
    if (roof === 'acrylic') return HEROES.pitchedAcrylic;
    if (roof === 'mixed') return HEROES.pitchedMixed;
    return withMatch(HEROES.pitchedMixed, 'form-only');
  }

  if (form === 'Hip') {
    return roof === 'acrylic' ? HEROES.hip : withMatch(HEROES.hip, 'form-only');
  }
  if (form === 'Perimeter') {
    return roof === 'acrylic'
      ? HEROES.perimeter
      : withMatch(HEROES.perimeter, 'form-only');
  }
  return HEROES.fallback;
}
