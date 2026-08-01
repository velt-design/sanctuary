import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import {
  appendJourneyAnswer,
  getJourneyCompletion,
  getJourneyModel,
  getJourneyScreen,
  type JourneyAnswer,
  type JourneyResultId,
} from './journey';

const expectedPaths: Array<[
  JourneyAnswer[],
  JourneyResultId,
]> = [
  [
    ['homeowner', 'simple-cover', 'shade-first'],
    'insulated-roof',
  ],
  [
    ['homeowner', 'simple-cover', 'daylight-first'],
    'daylight-roof',
  ],
  [
    ['homeowner', 'bespoke-room', 'acrylic'],
    'bespoke-acrylic',
  ],
  [
    ['homeowner', 'bespoke-room', 'timber'],
    'timber-lined-room',
  ],
  [
    ['homeowner', 'bespoke-room', 'mixed'],
    'mixed-material-room',
  ],
  [
    ['business', 'architect-designer'],
    'professional-collaboration',
  ],
  [
    ['business', 'hospitality'],
    'hospitality-cover',
  ],
  [
    ['business', 'builder'],
    'builder-collaboration',
  ],
];

describe('guided homepage journey', () => {
  it('resolves every approved answer path deterministically', () => {
    for (const [answers, resultId] of expectedPaths) {
      expect(getJourneyScreen(answers)).toEqual({
        kind: 'result',
        id: resultId,
      });
    }
  });

  it('shows only the next relevant question', () => {
    expect(getJourneyScreen([])).toEqual({
      kind: 'question',
      id: 'audience',
    });
    expect(getJourneyScreen(['homeowner'])).toEqual({
      kind: 'question',
      id: 'homeowner-service',
    });
    expect(getJourneyScreen(['homeowner', 'simple-cover'])).toEqual({
      kind: 'question',
      id: 'simple-priority',
    });
    expect(getJourneyScreen(['homeowner', 'bespoke-room'])).toEqual({
      kind: 'question',
      id: 'bespoke-material',
    });
    expect(getJourneyScreen(['business'])).toEqual({
      kind: 'question',
      id: 'business-role',
    });
  });

  it('accepts only answers offered by the active question', () => {
    const model = getJourneyModel(projects);
    expect(appendJourneyAnswer(model, [], 'homeowner')).toEqual([
      'homeowner',
    ]);
    expect(appendJourneyAnswer(model, [], 'shade-first')).toEqual([]);
    expect(
      appendJourneyAnswer(model, ['business'], 'simple-cover'),
    ).toEqual(['business']);
  });

  it('uses two steps for business and three for homeowner pathways', () => {
    expect(getJourneyCompletion([])).toEqual({ current: 1, total: 3 });
    expect(getJourneyCompletion(['business'])).toEqual({
      current: 2,
      total: 2,
    });
    expect(
      getJourneyCompletion(['homeowner', 'simple-cover']),
    ).toEqual({ current: 3, total: 3 });
  });

  it('builds every result from governed projects and one attributed enquiry', () => {
    const model = getJourneyModel(projects);

    for (const [, resultId] of expectedPaths) {
      const result = model.results[resultId];
      expect(result.projects).toHaveLength(2);
      expect(new Set(result.projects.map((project) => project.slug)).size)
        .toBe(2);
      expect(result.enquiryHref).toContain(
        'source_path=%2Fhome-journey',
      );
      expect(result.enquiryHref).toContain('source_component=pathway');
    }
  });

  it('fails closed when a governed project is unavailable', () => {
    expect(() =>
      getJourneyModel(
        projects.filter(
          (project) => project.slug !== 'goodhome-commercial-terrace',
        ),
      ),
    ).toThrow('Missing guided-home project: goodhome-commercial-terrace');
  });
});
