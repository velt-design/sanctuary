import { describe, expect, it } from 'vitest';
import { commercialPergolasConfig } from './content';

describe('commercial service journey content', () => {
  it('keeps guide-series navigation out of the high-intent service route', () => {
    expect(commercialPergolasConfig.showGuideNavigation).toBe(false);
  });

  it('leads with three projects and a three-stage delivery path', () => {
    expect(commercialPergolasConfig.blockOrder.slice(0, 2)).toEqual([
      'commercial-projects',
      'commercial-process',
    ]);

    const projects = commercialPergolasConfig.blocks.find(
      (block) => block.id === 'commercial-projects',
    );
    const process = commercialPergolasConfig.blocks.find(
      (block) => block.id === 'commercial-process',
    );

    expect(projects?.kind).toBe('projects');
    expect(projects && 'items' in projects ? projects.items : []).toHaveLength(
      3,
    );
    expect(process?.kind).toBe('process');
    expect(process && 'items' in process ? process.items : []).toHaveLength(3);
  });

  it('retains three purposeful supporting-detail groups', () => {
    expect(commercialPergolasConfig.mobileDisclosureGroups.map(({ id }) => id))
      .toEqual([
        'commercial-value-detail',
        'commercial-coordination-detail',
        'commercial-planning-support',
      ]);
  });
});
