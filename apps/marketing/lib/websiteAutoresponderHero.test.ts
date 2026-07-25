import { describe, expect, it } from 'vitest';
import { resolveWebsiteAutoresponderHero } from './websiteAutoresponderHero';

describe('resolveWebsiteAutoresponderHero', () => {
  it.each([
    ['residential', 'Gable', 'Both', 'warkworth-outdoor-room'],
    ['residential', 'Gable', 'Acrylic and timber-lined', 'warkworth-outdoor-room'],
    ['residential', 'Gable', 'Timber', 'riverhead-gable-pavilion'],
    ['residential', 'Gable', 'Acrylic', 'dairy-flat-estate'],
    ['commercial', 'Gable', 'Acrylic', 'goodhome-commercial-terrace'],
    ['residential', 'Pitched', 'Acrylic', 'lilliput-mini-golf'],
    ['commercial', 'Pitched', 'Acrylic', 'lilliput-mini-golf'],
    ['residential', 'Pitched', 'Both', 'tindalls-bay-pavilion'],
    ['residential', 'Pitched', 'Timber', 'tindalls-bay-pavilion'],
    ['residential', 'Hip', 'Acrylic', 'muriwai-courtyard'],
    ['residential', 'Hip', 'Timber', 'muriwai-courtyard'],
    ['residential', 'Perimeter', 'Acrylic', 'mt-maunganui-box'],
    ['commercial', 'Box perimeter', 'Both', 'mt-maunganui-box'],
  ])(
    'maps %s %s with %s to %s',
    (enquiryType, style, roof, projectSlug) => {
      expect(resolveWebsiteAutoresponderHero({ enquiryType, style, roof }).projectSlug).toBe(
        projectSlug,
      );
    },
  );

  it('uses the architect-led KiwiRail collaboration for professional enquiries', () => {
    const hero = resolveWebsiteAutoresponderHero({ enquiryType: 'professional' });

    expect(hero.projectSlug).toBe('kiwi-rail-platform');
    expect(hero.match).toBe('professional');
  });

  it('marks same-form projects as contextual when the selected material is not evidenced', () => {
    expect(
      resolveWebsiteAutoresponderHero({
        enquiryType: 'residential',
        style: 'Hip',
        roof: 'Timber',
      }).match,
    ).toBe('form-only');
    expect(
      resolveWebsiteAutoresponderHero({
        enquiryType: 'commercial',
        style: 'Perimeter',
        roof: 'Acrylic',
      }).match,
    ).toBe('exact');
  });

  it('falls back to the homepage Warkworth project when the selection is unclear', () => {
    const hero = resolveWebsiteAutoresponderHero({
      enquiryType: 'residential',
      style: 'Not sure yet',
      roof: 'Not selected',
    });

    expect(hero).toMatchObject({
      projectSlug: 'warkworth-outdoor-room',
      match: 'fallback',
    });
    expect(hero.imageUrl).toMatch(/^https:\/\/www\.sanctuarypergolas\.co\.nz\/images\//);
    expect(hero.projectHref).toBe(
      'https://www.sanctuarypergolas.co.nz/projects/warkworth-outdoor-room',
    );
  });
});
