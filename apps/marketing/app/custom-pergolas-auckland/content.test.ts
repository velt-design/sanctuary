import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import { customPergolasConfig } from './content';

describe('custom service journey content', () => {
  it('removes the numbered guide progression from the service first layer', () => {
    expect(customPergolasConfig.showGuideNavigation).toBe(false);
    expect(customPergolasConfig.mobileDisclosureGroups).toEqual([
      {
        id: 'custom-planning-support',
        summary: 'Project checks, related guides and questions',
        blockIds: [
          'custom-boundaries',
          'custom-next-decisions',
          'custom-pergolas-faq',
        ],
      },
    ]);
  });

  it('keeps three strong residential examples with distinct constraints', () => {
    const projectBlock = customPergolasConfig.blocks.find(
      (block) => block.kind === 'projects',
    );
    if (!projectBlock || projectBlock.kind !== 'projects') {
      throw new Error('Missing custom project evidence block');
    }

    expect(projectBlock.items).toHaveLength(3);
    expect(new Set(projectBlock.items.map((item) => item.label)).size).toBe(3);
    for (const proof of projectBlock.items) {
      expect(
        projects.find((project) => project.slug === proof.slug)?.type,
      ).toBe('Residential');
    }
  });

  it('uses three custom conditions and three process stages', () => {
    const conditions = customPergolasConfig.blocks.find(
      (block) => block.id === 'custom-conditions',
    );
    const process = customPergolasConfig.blocks.find(
      (block) => block.id === 'custom-process',
    );

    expect(conditions?.kind).toBe('decision-cards');
    expect(conditions && 'items' in conditions ? conditions.items : [])
      .toHaveLength(3);
    expect(process?.kind).toBe('process');
    expect(process && 'items' in process ? process.items : [])
      .toHaveLength(3);
  });
});
