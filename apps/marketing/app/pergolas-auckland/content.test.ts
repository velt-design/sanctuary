import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import {
  faqItems,
  investmentDrivers,
  planningLinks,
  residentialProcessSteps,
  residentialProjectProof,
  roofFormLinks,
} from './content';

describe('residential service journey content', () => {
  it('keeps three residential project examples', () => {
    expect(residentialProjectProof).toHaveLength(3);

    for (const proof of residentialProjectProof) {
      expect(
        projects.find((project) => project.slug === proof.slug)?.type,
      ).toBe('Residential');
    }
  });

  it('uses three service stages and compact investment drivers', () => {
    expect(residentialProcessSteps).toHaveLength(3);
    expect(investmentDrivers).toHaveLength(4);
  });

  it('keeps all four canonical pergola forms and useful guide routes', () => {
    expect(roofFormLinks.map((item) => item.href)).toEqual([
      '/products/pergolas/pitched',
      '/products/pergolas/gable',
      '/products/pergolas/hip',
      '/products/pergolas/box-perimeter',
    ]);
    expect(planningLinks.map((item) => item.href)).toEqual([
      '/custom-pergolas-auckland',
      '/pergola-cost-auckland',
      '/outdoor-rooms-auckland',
    ]);
  });

  it('states the approved service-area qualification', () => {
    expect(faqItems).toContainEqual({
      question: 'Where does Sanctuary work?',
      answer: [
        'Sanctuary is based in Auckland and considers selected projects up to about a three-hour drive away when the scope is a good fit.',
      ],
    });
  });
});
