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
    expect(
      projects?.kind === 'projects'
        ? projects.items.map(({ role }) => role)
        : [],
    ).toEqual([
      'Sanctuary-led hospitality design and build',
      'Supply and installation within a consultant-led renovation',
      'Architect-led workplace canopy delivery',
    ]);
  });

  it('keeps capability and planning pathways visible before one supporting disclosure', () => {
    expect(commercialPergolasConfig.blockOrder).toEqual([
      'commercial-projects',
      'commercial-process',
      'commercial-capability',
      'commercial-pathways',
      'commercial-pergolas-faq',
    ]);
    expect(commercialPergolasConfig.mobileDisclosureGroups).toEqual([
      {
        id: 'commercial-planning-support',
        summary: 'Common commercial planning questions',
        blockIds: ['commercial-pergolas-faq'],
      },
    ]);

    const capability = commercialPergolasConfig.blocks.find(
      (block) => block.id === 'commercial-capability',
    );
    const pathways = commercialPergolasConfig.blocks.find(
      (block) => block.id === 'commercial-pathways',
    );

    expect(capability?.kind).toBe('editorial-image');
    expect(capability && 'items' in capability ? capability.items : []).toHaveLength(6);
    expect(capability && 'lead' in capability ? capability.lead : '').toContain(
      'cannot remove every project variable',
    );
    expect(
      pathways?.kind === 'link-cards'
        ? pathways.items.map(({ href }) => href)
        : [],
    ).toEqual(['/architects-designers-builders', '/pergola-cost-auckland']);
  });

  it('keeps the commercial enquiry contract while shortening the first brief', () => {
    expect(commercialPergolasConfig.enquiryType).toBe('commercial');
    expect(commercialPergolasConfig.finalCta.checklist).toHaveLength(5);
    expect(commercialPergolasConfig.form.directContact).toEqual({
      intro: 'Prefer a direct conversation?',
      phoneLabel: 'Call 022 854 5633',
      phoneHref: 'tel:+64228545633',
      emailLabel: 'Email Sanctuary',
      emailHref: 'mailto:info@sanctuarypergolas.co.nz',
    });
  });
});
