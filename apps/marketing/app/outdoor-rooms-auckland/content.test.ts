import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import { orderGuidedItemsBySlug, resolveGuidedJourneyContext } from '../../lib/guidedJourneyContext';
import { outdoorRoomExamples, outdoorRoomFaqs, outdoorRoomHero } from './content';

describe('Outdoor Rooms project evidence and scope', () => {
  it('uses original public residential photographs for the room and every example', () => {
    const warkworth = projects.find(project => project.slug === 'warkworth-outdoor-room')!;
    expect(warkworth.gallery.map(image => image.src)).toContain(outdoorRoomHero.image);
    for (const example of outdoorRoomExamples) {
      const project = projects.find(item => item.slug === example.slug)!;
      expect(project.type).toBe('Residential');
      expect([project.heroImage.src, ...project.gallery.map(image => image.src)]).toContain(example.image);
    }
    expect(outdoorRoomExamples[0].caption).toContain('aluminium and steel');
    expect(outdoorRoomExamples[1].caption).toContain('aluminium and steel');
  });
  it.each(['everyday', 'entertaining', 'poolside'])('promotes the full governed %s evidence in established order without changing the default set', use => {
    const context = resolveGuidedJourneyContext('outdoor-room', { use })!;
    expect(orderGuidedItemsBySlug(outdoorRoomExamples, context.preferredProjectSlugs).map(item => item.slug)).toEqual(context.preferredProjectSlugs);
    expect(outdoorRoomExamples.map(item => item.slug)).toEqual(['warkworth-outdoor-room', 'riverhead-gable-pavilion', 'tindalls-bay-pavilion']);
  });
  it('keeps whole-room, weather and approval limits explicit without requiring a finished plan', () => {
    expect(outdoorRoomFaqs.find(item => item.question.includes('plans'))?.answer).toMatch(/^No\./);
    expect(outdoorRoomFaqs.find(item => item.question.includes('weatherproof'))?.answer).toContain('operating and exposure limits');
    expect(outdoorRoomFaqs.find(item => item.question.includes('cost'))?.answer).toContain('does not price a complete room');
    expect(outdoorRoomFaqs.find(item => item.question.includes('consent'))?.answer).toContain('depend on the site and final design');
  });
});
