import type { SeoLandingBlock } from './types';

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
