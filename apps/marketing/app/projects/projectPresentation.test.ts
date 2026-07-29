import { describe, expect, it } from 'vitest';
import { projects, type Project } from '../../data/projects';
import {
  getProjectContextLinks,
  getProjectFacts,
  getProjectFeatureTags,
  getProjectFormLabel,
  getProjectIntroCta,
  getProjectMobileFactSummary,
  getProjectTechnicalSections,
} from './projectPresentation';

function getProject(slug: string): Project {
  const project = projects.find((candidate) => candidate.slug === slug);
  if (!project) throw new Error(`Missing project fixture: ${slug}`);
  return project;
}

describe('project presentation', () => {
  it('uses concise governed summaries for every project card and detail intro', () => {
    const expectedSummaries: Record<string, string> = {
      'warkworth-outdoor-room':
        'A freestanding gable room combining mixed roofing, cedar lining, a new deck, fireplace and lighting.',
      'mt-maunganui-box':
        'A first-floor box-perimeter pergola designed around the balustrade and outlook.',
      'lilliput-mini-golf':
        'A pitched pergola supplied and installed within a consultant-led venue renovation.',
      'waiheke-holiday-home':
        'A box-perimeter deck cover designed to preserve the water view.',
      'goodhome-commercial-terrace':
        'Two gables extending the villa-style facade over the restaurant courtyard.',
      'kiwi-rail-platform':
        'An aluminium and acrylic canopy with integrated lighting along a workplace route.',
      'tindalls-bay-pavilion':
        'A patio and carport using insulated and acrylic roof zones around a complex house.',
      'atelier-shu-cafe':
        'A dark-tint acrylic gable canopy aligned with the cafe frontage.',
      'muriwai-courtyard':
        'An opal-acrylic hip roof replacing the previous courtyard pergola.',
      'velskov-forest':
        'A low-profile shelter for a working space beneath the forest canopy.',
      'ardmore-box-carport':
        'A box-perimeter carport with acrylic roofing and an internal gable.',
      'riverhead-gable-pavilion':
        'A poolside gable pavilion with timber lining and integrated lighting.',
      'st-heliers-townhouse':
        'An open gable with opal acrylic and a custom street-facing frame.',
      'dairy-flat-estate':
        'An aluminium and acrylic gable following the existing roofline.',
    };

    expect(Object.fromEntries(
      projects.map((project) => [project.slug, project.blurb]),
    )).toEqual(expectedSummaries);
  });

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

  it('summarises supported dimensions and roof evidence for compact mobile facts', () => {
    expect(getProjectMobileFactSummary(getProject('warkworth-outdoor-room'))).toEqual({
      measurement: '5.0 m W × 6.0 m D × 4.1 m H',
      roofApproach: 'Corrugated COLORSTEEL with clear acrylic roof and gable glazing',
    });
    expect(getProjectMobileFactSummary(getProject('tindalls-bay-pavilion'))).toEqual({
      measurement: '108 m²',
      roofApproach: 'Insulated panels with opal and light grey acrylic roof zones',
    });
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

  it('uses one short enquiry label across project types', () => {
    expect(getProjectIntroCta(getProject('warkworth-outdoor-room'))).toBe(
      'Send project brief',
    );
    expect(getProjectIntroCta(getProject('lilliput-mini-golf'))).toBe(
      'Send project brief',
    );
  });
});
