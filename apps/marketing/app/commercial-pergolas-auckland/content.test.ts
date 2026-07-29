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

  it('keeps three capability owners and two planning pathways before one supporting disclosure', () => {
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
    expect(capability && 'items' in capability ? capability.items : [])
      .toHaveLength(3);
    expect(
      capability?.kind === 'editorial-image'
        ? capability.items.map(({ title }) => title)
        : [],
    ).toEqual(['Design', 'Site coordination', 'Delivery']);
    expect(capability && 'lead' in capability ? capability.lead : '')
      .toContain('consultant-led package');
    expect(
      pathways?.kind === 'link-cards'
        ? pathways.items.map(({ href }) => href)
        : [],
    ).toEqual(['/architects-designers-builders', '/pergola-cost-auckland']);
  });

  it('keeps the commercial enquiry contract while shortening the first brief', () => {
    expect(commercialPergolasConfig.enquiryType).toBe('commercial');
    expect(commercialPergolasConfig.form.heading).toBe(
      'Tell us about the project.',
    );
    expect(commercialPergolasConfig.form.submitLabel).toBe(
      'Send project brief',
    );
    expect(commercialPergolasConfig.form.directContact).toEqual({
      intro: 'Prefer a direct conversation?',
      phoneLabel: 'Call 022 854 5633',
      phoneHref: 'tel:+64228545633',
      emailLabel: 'Email Sanctuary',
      emailHref: 'mailto:info@sanctuarypergolas.co.nz',
    });
  });

  it('assigns distinct verified assets to hero, proof and operating-site roles', () => {
    const projects = commercialPergolasConfig.blocks.find(
      (block) => block.id === 'commercial-projects',
    );
    const capability = commercialPergolasConfig.blocks.find(
      (block) => block.id === 'commercial-capability',
    );

    expect(commercialPergolasConfig.hero.image).toBe('/images/project-goodhome-03.jpg');
    expect(
      projects?.kind === 'projects'
        ? projects.items.map(({ image }) => image?.src ?? null)
        : [],
    ).toEqual([
      '/images/project-goodhome-02.jpg',
      null,
      '/images/project-kiwi-rail-01.jpg',
    ]);
    expect(
      capability?.kind === 'editorial-image' ? capability.image.src : null,
    ).toBe('/images/project-kiwi-rail-03.jpg');
  });
});
