import { describe, expect, it } from 'vitest';
import {
  ATELIER_SHU_CASE_STUDY_HERO_IMAGE,
  ATELIER_SHU_CASE_STUDY_HERO_OBJECT_POSITION,
  WARKWORTH_EXTERIOR_IMAGE,
  WARKWORTH_EXTERIOR_OBJECT_POSITION,
} from '../lib/projectImageFraming';
import { projects } from './projects';

const evidenceCases = [
  {
    slug: 'goodhome-commercial-terrace',
    current: /Acrylic roof over the two gable zones/i,
    retired: /50 mm insulated|DMX|Heatstrip/i,
  },
  {
    slug: 'kiwi-rail-platform',
    current: /covered path between key circulation routes/i,
    retired: /pantograph|ColorCote|EN 12464|service platform/i,
  },
  {
    slug: 'tindalls-bay-pavilion',
    current: /Opal and light grey acrylic/i,
    retired: /twinwall polycarbonate|Somfy RTS|wind\/rain sensors/i,
  },
  {
    slug: 'atelier-shu-cafe',
    current: /dark-tint acrylic roof/i,
    retired: /laminated glass|acoustic interlayer|frameless sliding/i,
  },
  {
    slug: 'muriwai-courtyard',
    current: /Opal acrylic roofing/i,
    retired: /cedar soffit|fireplace fan|projector cabling/i,
  },
  {
    slug: 'waiheke-holiday-home',
    current: /4 degree roof fall/i,
    retired: /Somfy RTS|infrared heaters|insulated aluminium roof/i,
  },
] as const;

const narrativeClaimCases = [
  {
    slug: 'warkworth-outdoor-room',
    current: /clear acrylic glazing placed through the roof and gable ends in response to the daylight brief/i,
    retired: /keeps daylight moving through the space|bring natural light into the outdoor room/i,
  },
  {
    slug: 'mt-maunganui-box',
    current: /opal acrylic was selected in response to the brief for daylight and glare/i,
    retired: /soft filtered light|softens glare|soft, even light quality|reduce glare/i,
  },
  {
    slug: 'lilliput-mini-golf',
    current: /establishes the recorded roof fall/i,
    retired: /keep rain off|plenty of daylight|shedding water cleanly/i,
  },
  {
    slug: 'goodhome-commercial-terrace',
    current: /two new gable zones align with the established rhythm/i,
    retired: /blends seamlessly|part of the original structure/i,
  },
  {
    slug: 'kiwi-rail-platform',
    current: /cover a pathway between key circulation routes/i,
    retired: /stay dry|dry, well-lit|safe and inviting/i,
  },
  {
    slug: 'tindalls-bay-pavilion',
    current: /identified in the brief for wind and privacy/i,
    retired: /daylight can flood|wind protection|bright but protected/i,
  },
  {
    slug: 'atelier-shu-cafe',
    current: /aligned the gable frame and colour with the established frontage/i,
    retired: /feels like it has always been there|changes the shade and light character/i,
  },
  {
    slug: 'muriwai-courtyard',
    current: /5 degree hip roof retains the established footprint/i,
    retired: /bright, sheltered outdoor room|diffusing daylight/i,
  },
  {
    slug: 'velskov-forest',
    current: /covering a space for farm activity/i,
    retired: /dry, usable space for farm activity/i,
  },
  {
    slug: 'ardmore-box-carport',
    current: /6 mm acrylic glazing across the driveway/i,
    retired: /strong weather protection|providing weather cover|keeping the space bright/i,
  },
  {
    slug: 'riverhead-gable-pavilion',
    current: /skillion insulation sits above the (?:lining|timber sarking)/i,
    retired: /all-season|proper weather protection|improves comfort|comfortable covered lounge/i,
  },
  {
    slug: 'st-heliers-townhouse',
    current: /selecting opal acrylic roofing in response to the brief for daylight and glare/i,
    retired: /keep the patio bright while cutting glare/i,
  },
  {
    slug: 'dairy-flat-estate',
    current: /acrylic roofing was selected in response to the daylight brief/i,
    retired: /maximum light|shelter from wind and rain|bright and sheltered/i,
  },
] as const;

describe('published project evidence', () => {
  it('keeps the Warkworth exterior framing consistent in project data', () => {
    const project = projects.find((candidate) => candidate.slug === 'warkworth-outdoor-room');
    expect(project?.heroImage).toMatchObject({
      src: WARKWORTH_EXTERIOR_IMAGE,
      objectPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION,
    });
    expect(project?.gallery.find((image) => image.src === WARKWORTH_EXTERIOR_IMAGE)?.objectPosition)
      .toBe(WARKWORTH_EXTERIOR_OBJECT_POSITION);
  });

  it('keeps the Atelier Shu case-study hero distinct from its reusable card image', () => {
    const project = projects.find((candidate) => candidate.slug === 'atelier-shu-cafe');
    expect(project?.heroImage.src).toBe('/images/project-atelier-shu-06.jpg');
    expect(project?.caseStudyHeroImage).toMatchObject({
      src: ATELIER_SHU_CASE_STUDY_HERO_IMAGE,
      objectPosition: ATELIER_SHU_CASE_STUDY_HERO_OBJECT_POSITION,
    });
  });

  it('features Atelier Shu third in the project collection', () => {
    expect(projects.slice(0, 4).map(({ slug }) => slug)).toEqual([
      'warkworth-outdoor-room',
      'mt-maunganui-box',
      'atelier-shu-cafe',
      'lilliput-mini-golf',
    ]);
  });

  it('uses the full Tindalls Bay composition as hero and keeps both detail views', () => {
    const project = projects.find((candidate) => candidate.slug === 'tindalls-bay-pavilion');
    expect(project?.heroImage.src).toBe('/images/project-tindalls-bay-02.jpg');
    expect(project?.gallery.map((image) => image.src)).toEqual([
      '/images/project-tindalls-bay.jpg',
      '/images/project-tindalls-bay-03.jpg',
    ]);
  });

  for (const evidence of evidenceCases) {
    it(`${evidence.slug} keeps its current summary and detail aligned`, () => {
      const project = projects.find((candidate) => candidate.slug === evidence.slug);
      expect(project).toBeDefined();
      const detail = JSON.stringify({
        blurb: project?.blurb,
        constraint: project?.constraint,
        roofApproach: project?.roofApproach,
        materials: project?.materials,
        description: project?.description,
        tags: project?.tags,
        sections: project?.sections,
      });
      expect(detail).toMatch(evidence.current);
      expect(detail).not.toMatch(evidence.retired);
    });
  }

  for (const narrative of narrativeClaimCases) {
    it(`${narrative.slug} distinguishes the built response from an unsupported outcome`, () => {
      const project = projects.find((candidate) => candidate.slug === narrative.slug);
      expect(project).toBeDefined();
      const publicNarrative = JSON.stringify({
        blurb: project?.blurb,
        constraint: project?.constraint,
        description: project?.description,
        sections: project?.sections,
      });
      expect(publicNarrative).toMatch(narrative.current);
      expect(publicNarrative).not.toMatch(narrative.retired);
    });
  }
});
