import { expect, it } from 'vitest';
import path from 'node:path';
import sharp from 'sharp';
import { blindExamples, blindsFaqs, blindsHero, blindStates } from './content';

it('ships six sufficiently sized real-photo derivatives without source EXIF, location or editorial metadata', async () => {
  const images = [blindsHero.image, ...blindExamples.map(image => image.image), ...blindStates.map(image => image.image), '/images/blind-roller-post-detail.webp'];
  expect(new Set(images).size).toBe(6);
  for (const image of images) {
    const metadata = await sharp(path.resolve(process.cwd(), 'apps/marketing/public', image.slice(1))).metadata();
    expect(metadata.width).toBeGreaterThanOrEqual(960);
    expect(metadata.height).toBeGreaterThanOrEqual(1100);
    expect(metadata.exif).toBeUndefined(); expect(metadata.xmp).toBeUndefined(); expect(metadata.iptc).toBeUndefined();
  }
});

it('describes the actual flexible materials and the compared opening without a simulated product claim', () => {
  expect(blindExamples.find(example => example.material === 'Clear PVC')?.text).toContain('not glass');
  expect(blindStates.every(state => state.alt.includes('right-hand opening'))).toBe(true);
  expect(blindsFaqs.find(item => item.question.includes('every side'))?.answer).toContain('roller or headbox');
  expect(blindsFaqs.find(item => item.question.includes('motorised'))?.answer).toContain('depending on the selected blind system and material');
});

it('retains an assessed existing-pergola path and specific operating, power and price limitations', () => {
  expect(blindsFaqs.find(item => item.question.includes('existing pergola'))?.answer).toMatch(/^Yes\..*reviewed/);
  expect(blindsFaqs.find(item => item.question.includes('weatherproof'))?.answer).toContain('exact product and site');
  expect(blindsFaqs.find(item => item.question.includes('motorised'))?.answer).toContain('licensed electrician');
  expect(blindsFaqs.find(item => item.question.includes('cost'))?.answer).toContain('not a quote for a bespoke blind system or a retrofit');
  expect(blindsFaqs.find(item => item.question.includes('measurements'))?.answer).toMatch(/^No\./);
});
