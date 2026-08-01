export const PROJECT_CARD_SIZE_STORAGE_KEY = 'sanctuary-project-card-size';

export const PROJECT_CARD_SIZE_OPTIONS = [
  {
    value: 'showcase',
    label: 'Showcase',
    scale: '02',
    description: '2 columns',
  },
  {
    value: 'editorial',
    label: 'Editorial',
    scale: '03',
    description: '3 columns',
  },
  {
    value: 'compact',
    label: 'Compact',
    scale: '04',
    description: 'up to 4 columns',
  },
  {
    value: 'overview',
    label: 'Overview',
    scale: '05',
    description: 'up to 5 columns',
  },
] as const;

export type ProjectCardSize = (typeof PROJECT_CARD_SIZE_OPTIONS)[number]['value'];

export const DEFAULT_PROJECT_CARD_SIZE: ProjectCardSize = 'editorial';

export function getProjectCardSizeOption(index: number) {
  return PROJECT_CARD_SIZE_OPTIONS[index] ?? PROJECT_CARD_SIZE_OPTIONS[1];
}

export function getProjectCardSizeIndex(value: ProjectCardSize) {
  return PROJECT_CARD_SIZE_OPTIONS.findIndex((option) => option.value === value);
}

export function parseProjectCardSize(value: string | null): ProjectCardSize | null {
  return PROJECT_CARD_SIZE_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

export function getProjectCardImageSizes(value: ProjectCardSize) {
  const compactSizes = '(max-width: 899px) calc(100vw - 2.5rem), (max-width: 1199px) calc((100vw - 6rem) / 2)';

  if (value === 'showcase') {
    return `${compactSizes}, (max-width: 1359px) min(30vw, 32rem), min(47vw, 48rem)`;
  }

  if (value === 'compact') {
    return `${compactSizes}, (max-width: 1359px) min(30vw, 32rem), min(23vw, 24rem)`;
  }

  if (value === 'overview') {
    return `${compactSizes}, (max-width: 1359px) min(30vw, 32rem), (max-width: 1599px) min(23vw, 24rem), min(18vw, 19rem)`;
  }

  return `${compactSizes}, min(30vw, 32rem)`;
}
