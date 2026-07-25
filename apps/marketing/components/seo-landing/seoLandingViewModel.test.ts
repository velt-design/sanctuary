import { describe, expect, it } from 'vitest';
import { acrylicVsLouvreConfig } from '../../app/acrylic-pergolas-vs-louvre-roofs/content';
import { aluminiumPergolasConfig } from '../../app/aluminium-pergolas-auckland/content';
import { gablePergolasConfig } from '../../app/gable-pergolas-auckland/content';
import { outdoorRoomsConfig } from '../../app/outdoor-rooms-auckland/content';
import { pergolaCostConfig } from '../../app/pergola-cost-auckland/content';
import { pergolasWithBlindsConfig } from '../../app/pergolas-with-blinds/content';
import { pitchedPergolasConfig } from '../../app/pitched-pergolas-auckland/content';
import type { SeoLandingBlock } from './types';
import {
  buildGuideFirstLayer,
  orderSeoLandingBlocks,
} from './seoLandingViewModel';

const blocks = [
  { kind: 'split-intro', id: 'answer' },
  { kind: 'projects', id: 'projects' },
  { kind: 'faq', id: 'faq' },
] as unknown as readonly SeoLandingBlock[];

describe('orderSeoLandingBlocks', () => {
  it('preserves the authored order when no presentation order is supplied', () => {
    expect(orderSeoLandingBlocks(blocks)).toBe(blocks);
  });

  it('returns every block in the requested canonical order', () => {
    expect(
      orderSeoLandingBlocks(blocks, ['projects', 'answer', 'faq']).map(
        ({ id }) => id,
      ),
    ).toEqual(['projects', 'answer', 'faq']);
  });

  it.each([
    ['missing a block', ['projects', 'answer']],
    ['repeating a block', ['projects', 'answer', 'answer']],
    ['referencing an unknown block', ['projects', 'answer', 'unknown']],
  ])('fails safely when %s', (_label, blockOrder) => {
    expect(() => orderSeoLandingBlocks(blocks, blockOrder)).toThrow(
      'must reference every block exactly once',
    );
  });
});

const guideConfigs = [
  outdoorRoomsConfig,
  aluminiumPergolasConfig,
  gablePergolasConfig,
  pitchedPergolasConfig,
  pergolaCostConfig,
  pergolasWithBlindsConfig,
  acrylicVsLouvreConfig,
] as const;

describe('buildGuideFirstLayer', () => {
  it.each(guideConfigs)(
    'builds a concise, complete first layer for $route',
    (config) => {
      const firstLayer = buildGuideFirstLayer(
        config.blocks,
        config.guideFirstLayer,
      );
      expect(firstLayer.answerBlock.kind).toBe('split-intro');
      expect(firstLayer.projectBlock.kind).toBe('projects');
      if (firstLayer.answerBlock.kind !== 'split-intro') return;
      if (firstLayer.projectBlock.kind !== 'projects') return;

      expect(firstLayer.answerBlock.paragraphs).toHaveLength(1);
      expect(firstLayer.projectBlock.items.map(({ slug }) => slug)).toEqual([
        config.guideFirstLayer.projectSlug,
      ]);

      const renderedModel = JSON.stringify([
        firstLayer.answerBlock,
        firstLayer.projectBlock,
        ...firstLayer.supportingBlocks,
      ]);
      const authoredAnswer = config.blocks.find(
        ({ id }) => id === config.guideFirstLayer.answerBlockId,
      );
      const authoredProjects = config.blocks.find(
        ({ id }) => id === config.guideFirstLayer.projectBlockId,
      );
      if (authoredAnswer?.kind !== 'split-intro') return;
      if (authoredProjects?.kind !== 'projects') return;

      for (const paragraph of authoredAnswer.paragraphs) {
        expect(renderedModel).toContain(paragraph);
      }
      for (const project of authoredProjects.items) {
        expect(renderedModel).toContain(project.slug);
        expect(renderedModel).toContain(project.summary);
      }
    },
  );

  it('fails safely when answer, project block or project metadata is unknown', () => {
    const config = outdoorRoomsConfig.guideFirstLayer;
    expect(() =>
      buildGuideFirstLayer(outdoorRoomsConfig.blocks, {
        ...config,
        answerBlockId: 'unknown',
      }),
    ).toThrow('must be a split-intro block');
    expect(() =>
      buildGuideFirstLayer(outdoorRoomsConfig.blocks, {
        ...config,
        projectBlockId: 'unknown',
      }),
    ).toThrow('must be a projects block');
    expect(() =>
      buildGuideFirstLayer(outdoorRoomsConfig.blocks, {
        ...config,
        projectSlug: 'unknown',
      }),
    ).toThrow('is not present');
  });
});
