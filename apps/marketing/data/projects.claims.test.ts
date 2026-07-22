import { describe, expect, it } from 'vitest';
import { WARKWORTH_EXTERIOR_IMAGE, WARKWORTH_EXTERIOR_OBJECT_POSITION } from '../lib/projectImageFraming';
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

  for (const evidence of evidenceCases) {
    it(`${evidence.slug} keeps its current summary and detail aligned`, () => {
      const project = projects.find((candidate) => candidate.slug === evidence.slug);
      expect(project).toBeDefined();
      const detail = JSON.stringify({
        blurb: project?.blurb,
        description: project?.description,
        tags: project?.tags,
        sections: project?.sections,
      });
      expect(detail).toMatch(evidence.current);
      expect(detail).not.toMatch(evidence.retired);
    });
  }
});
