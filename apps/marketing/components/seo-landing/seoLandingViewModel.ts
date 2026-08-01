import type {
  SeoLandingBlock,
  SeoLandingGuideFirstLayer,
} from './types';
import { orderGuidedItemsBySlug } from '@/lib/guidedJourneyContext';

export function orderSeoLandingBlocks(
  blocks: readonly SeoLandingBlock[],
  blockOrder?: readonly string[],
) {
  if (!blockOrder) return blocks;

  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const orderedBlocks = blockOrder.flatMap((blockId) => {
    const block = blocksById.get(blockId);
    return block ? [block] : [];
  });

  if (
    new Set(blockOrder).size !== blockOrder.length ||
    orderedBlocks.length !== blocks.length ||
    blockOrder.length !== blocks.length
  ) {
    throw new Error(
      'SEO landing blockOrder must reference every block exactly once.',
    );
  }

  return orderedBlocks;
}

export function prioritizeSeoLandingProjectEvidence(
  blocks: readonly SeoLandingBlock[],
  preferredProjectSlugs: readonly string[] = [],
): SeoLandingBlock[] {
  if (!preferredProjectSlugs.length) return [...blocks];
  return blocks.map((block) => block.kind === 'projects'
    ? {
        ...block,
        items: orderGuidedItemsBySlug(block.items, preferredProjectSlugs),
      }
    : block);
}

export function prioritizeSeoLandingGuideFirstLayer(
  blocks: readonly SeoLandingBlock[],
  config: SeoLandingGuideFirstLayer,
  preferredProjectSlugs: readonly string[] = [],
): SeoLandingGuideFirstLayer {
  const projectBlock = blocks.find(({ id }) => id === config.projectBlockId);
  if (projectBlock?.kind !== 'projects' || !preferredProjectSlugs.length) {
    return config;
  }
  const availableSlugs = new Set(projectBlock.items.map(({ slug }) => slug));
  const preferredProject = preferredProjectSlugs.find((slug) =>
    availableSlugs.has(slug));
  return preferredProject
    ? { ...config, projectSlug: preferredProject }
    : config;
}

type GuideFirstLayerViewModel = {
  answerBlock: SeoLandingBlock;
  projectBlock: SeoLandingBlock;
  supportingBlocks: readonly SeoLandingBlock[];
};

export function buildGuideFirstLayer(
  blocks: readonly SeoLandingBlock[],
  config: SeoLandingGuideFirstLayer,
): GuideFirstLayerViewModel {
  const answerBlock = blocks.find(
    (block) => block.id === config.answerBlockId,
  );
  const projectBlock = blocks.find(
    (block) => block.id === config.projectBlockId,
  );

  if (answerBlock?.kind !== 'split-intro') {
    throw new Error(
      `Guide first layer answer "${config.answerBlockId}" must be a split-intro block.`,
    );
  }
  if (projectBlock?.kind !== 'projects') {
    throw new Error(
      `Guide first layer project "${config.projectBlockId}" must be a projects block.`,
    );
  }

  const selectedProject = projectBlock.items.find(
    ({ slug }) => slug === config.projectSlug,
  );
  if (!selectedProject) {
    throw new Error(
      `Guide first layer project "${config.projectSlug}" is not present in "${config.projectBlockId}".`,
    );
  }

  const supportingBlocks: SeoLandingBlock[] = [];
  const remainingParagraphs = answerBlock.paragraphs.slice(1);
  if (remainingParagraphs.length) {
    supportingBlocks.push({
      ...answerBlock,
      id: `${answerBlock.id}-supporting`,
      title: config.supportingAnswerTitle,
      paragraphs: remainingParagraphs,
    });
  }

  const remainingProjects = projectBlock.items.filter(
    ({ slug }) => slug !== config.projectSlug,
  );
  if (remainingProjects.length) {
    supportingBlocks.push({
      ...projectBlock,
      id: `${projectBlock.id}-supporting`,
      title: config.supportingProjectsTitle,
      intro:
        'Additional completed projects preserve the wider comparison behind this guide.',
      items: remainingProjects,
    });
  }

  supportingBlocks.push(
    ...blocks.filter(
      ({ id }) =>
        id !== config.answerBlockId && id !== config.projectBlockId,
    ),
  );

  return {
    answerBlock: {
      ...answerBlock,
      paragraphs: answerBlock.paragraphs.slice(0, 1),
    },
    projectBlock: {
      ...projectBlock,
      items: [selectedProject],
    },
    supportingBlocks,
  };
}
