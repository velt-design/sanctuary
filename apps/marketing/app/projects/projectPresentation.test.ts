import { describe, expect, it } from 'vitest';
import { projects, type Project } from '../../data/projects';
import {
  getProjectContextLinks,
  getProjectFacts,
  getProjectFeatureTags,
  getProjectFormLabel,
  getProjectTechnicalSections,
} from './projectPresentation';

function getProject(slug: string): Project {
  const project = projects.find((candidate) => candidate.slug === slug);
  if (!project) throw new Error(`Missing project fixture: ${slug}`);
  return project;
}

describe('project presentation', () => {
  it('uses the approved box-perimeter form label', () => {
    expect(getProjectFormLabel(getProject('mt-maunganui-box'))).toBe('Box-perimeter');
  });

  it('shows supported facts and omits missing values', () => {
    const warkworthFacts = getProjectFacts(getProject('warkworth-outdoor-room'));
    expect(warkworthFacts).toContainEqual({ label: 'Configuration', value: 'Freestanding' });
    expect(warkworthFacts).toContainEqual({
      label: 'Dimensions',
      value: '5.0 m W × 6.0 m D × 4.1 m H',
    });

    const velskovFacts = getProjectFacts(getProject('velskov-forest'));
    expect(velskovFacts.some((fact) => fact.label === 'Completed')).toBe(false);
    expect(velskovFacts.some((fact) => fact.label === 'Structure & finish')).toBe(false);
    expect(velskovFacts.every((fact) => fact.value.trim().length > 0)).toBe(true);
  });

  it('does not repeat the design brief inside secondary technical details', () => {
    const sections = getProjectTechnicalSections(getProject('warkworth-outdoor-room'));
    expect(sections.map((section) => section.title)).not.toContain('Design brief');
    expect(sections.map((section) => section.title)).toContain('Structure & finish');
  });

  it('keeps selected detail tags concise and contextual links relevant', () => {
    expect(getProjectFeatureTags(getProject('warkworth-outdoor-room'))).not.toContain('Residential');
    expect(getProjectFeatureTags(getProject('warkworth-outdoor-room'))).not.toContain('Gable');

    expect(getProjectContextLinks(getProject('lilliput-mini-golf'))).toEqual([
      { href: '/commercial-pergolas-auckland', label: 'Explore commercial pergolas' },
      { href: '/pitched-pergolas-auckland', label: 'Explore pitched pergolas' },
    ]);
  });
});
