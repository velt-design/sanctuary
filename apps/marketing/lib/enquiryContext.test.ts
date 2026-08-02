import { describe, expect, it } from 'vitest';
import { projects } from '../data/projects';
import { products } from '../data/products';
import {
  buildEnquiryHref,
  getEnquiryAnalyticsProperties,
  getEnquiryContextProperties,
  getEnquiryRouteContext,
  inferEnquiryAudience,
  parseEnquiryContext,
} from './enquiryContext';

describe('enquiry context', () => {
  it('builds one canonical non-personal contact URL', () => {
    expect(buildEnquiryHref({
      enquiryType: 'commercial',
      sourcePath: '/projects/goodhome-commercial-terrace',
      sourceComponent: 'project_cta',
      sourceProject: 'goodhome-commercial-terrace',
    })).toBe(
      '/contact?enquiry_type=commercial&source_path=%2Fprojects%2Fgoodhome-commercial-terrace&source_component=project_cta&source_project=goodhome-commercial-terrace#contact-form',
    );
  });

  it('keeps route context when the footer starts an enquiry', () => {
    expect(buildEnquiryHref({
      ...getEnquiryRouteContext('/commercial-pergolas-auckland'),
      sourcePath: '/commercial-pergolas-auckland',
      sourceComponent: 'footer',
    })).toBe(
      '/contact?enquiry_type=commercial&source_path=%2Fcommercial-pergolas-auckland&source_component=footer#contact-form',
    );
  });

  it('parses canonical and legacy audience values while validating known items', () => {
    expect(parseEnquiryContext(
      {
        enquiry_type: 'Professional',
        source_path: '/products/pergolas/gable',
        source_component: 'product_cta',
        source_product: 'gable',
      },
      { productSlugs: ['gable'] },
    )).toEqual({
      enquiryType: 'professional',
      sourcePath: '/products/pergolas/gable',
      sourceComponent: 'product_cta',
      sourceProduct: 'gable',
    });
    expect(parseEnquiryContext({ enquiry: 'residential' })).toEqual({
      enquiryType: 'residential',
    });
  });

  it('drops malformed paths, unknown components and unknown item slugs', () => {
    expect(parseEnquiryContext(
      {
        enquiry_type: 'other',
        source_path: '//example.test/customer@example.test',
        source_component: 'free_text',
        source_project: 'unknown-project',
        source_product: '../gable',
      },
      {
        projectSlugs: ['warkworth-outdoor-room'],
        productSlugs: ['gable'],
      },
    )).toEqual({});
  });

  it('does not serialize arbitrary or personal-looking values', () => {
    expect(buildEnquiryHref({
      sourcePath: '/contact?email=person@example.test',
      sourceProject: 'person@example.test',
    })).toBe('/contact#contact-form');
  });

  it('maps validated context to canonical submission and analytics properties', () => {
    expect(getEnquiryContextProperties({
      enquiryType: 'residential',
      sourcePath: '/projects/warkworth-outdoor-room',
      sourceComponent: 'project_cta',
      sourceProject: 'warkworth-outdoor-room',
    })).toEqual({
      enquiry_type: 'residential',
      source_path: '/projects/warkworth-outdoor-room',
      source_component: 'project_cta',
      source_project: 'warkworth-outdoor-room',
    });
  });

  it('keeps only a complete validated guided source context', () => {
    expect(getEnquiryContextProperties({
      enquiryType: 'commercial',
      sourcePath: '/commercial-pergolas-auckland',
      sourceComponent: 'embedded_form',
      sourceExperience: 'guided-home-v1',
      sourcePathway: 'commercial',
      sourceFocus: 'collaborate',
    })).toEqual({
      enquiry_type: 'commercial',
      source_path: '/commercial-pergolas-auckland',
      source_component: 'embedded_form',
      source_experience: 'guided-home-v1',
      source_pathway: 'commercial',
      source_focus: 'collaborate',
    });

    expect(parseEnquiryContext({
      source_experience: 'guided-home-v1',
      source_pathway: 'free-text',
      source_focus: 'person@example.test',
    })).toEqual({});
    expect(parseEnquiryContext({
      source_experience: 'guided-home-v1',
      source_pathway: 'commercial',
    })).toEqual({});
    expect(parseEnquiryContext({
      source_experience: 'guided-home-v1',
      source_pathway: 'residential-cover',
      source_focus: 'collaborate',
    })).toEqual({});
  });

  it('carries only validated project finder context into the contact journey', () => {
    expect(buildEnquiryHref({
      enquiryType: 'residential',
      sourcePath: '/',
      sourceComponent: 'brief_summary',
      sourceExperience: 'project-finder-home-v1',
      projectDirection: 'outdoor-room',
      projectPriorities: ['entertaining', 'daylight', 'entertaining'],
    })).toBe(
      '/contact?enquiry_type=residential&source_path=%2F&source_component=brief_summary&source_experience=project-finder-home-v1&project_direction=outdoor-room&project_priorities=daylight%2Centertaining#contact-form',
    );

    expect(parseEnquiryContext({
      source_experience: 'project-finder-home-v1',
      project_direction: 'not-valid',
      project_priorities: 'daylight,person@example.test',
    })).toEqual({
      sourceExperience: 'project-finder-home-v1',
    });
  });

  it('prevents arbitrary analytics properties from overriding canonical context', () => {
    expect(getEnquiryAnalyticsProperties(
      {
        enquiryType: 'commercial',
        sourcePath: '/projects/goodhome-commercial-terrace',
        sourceComponent: 'project_cta',
        sourceProject: 'goodhome-commercial-terrace',
      },
      {
        event_category: 'contact',
        enquiry_type: 'Commercial',
        source_path: '/contact?email=person@example.test',
        source_project: 'person-example-test',
      },
    )).toEqual({
      event_category: 'contact',
      enquiry_type: 'commercial',
      source_path: '/projects/goodhome-commercial-terrace',
      source_component: 'project_cta',
      source_project: 'goodhome-commercial-terrace',
    });
  });

  it('infers only known audience routes and keeps mixed or unknown routes neutral', () => {
    expect(inferEnquiryAudience('/commercial-pergolas-auckland')).toBe('commercial');
    expect(inferEnquiryAudience('/architects-designers-builders')).toBe(
      'professional',
    );
    expect(inferEnquiryAudience('/pergolas-auckland')).toBe('residential');
    expect(inferEnquiryAudience('/projects')).toBeUndefined();
    expect(inferEnquiryAudience('/products')).toBeUndefined();
    expect(inferEnquiryAudience('/contact')).toBeUndefined();
    expect(inferEnquiryAudience('/unknown')).toBeUndefined();
    expect(getEnquiryRouteContext('/')).toEqual({
      enquiryType: 'residential',
      sourceExperience: 'project-finder-home-v1',
    });
  });

  it('resolves project and product routes without inventing product audiences', () => {
    expect(getEnquiryRouteContext(
      '/projects/goodhome-commercial-terrace',
    )).toEqual({
      enquiryType: 'commercial',
      sourceProject: 'goodhome-commercial-terrace',
    });
    expect(getEnquiryRouteContext('/projects/warkworth-outdoor-room')).toEqual({
      enquiryType: 'residential',
      sourceProject: 'warkworth-outdoor-room',
    });
    expect(getEnquiryRouteContext('/products/pergolas/gable')).toEqual({
      sourceProduct: 'gable',
    });
    expect(getEnquiryRouteContext('/architects-designers-builders')).toEqual({
      enquiryType: 'professional',
    });
    expect(getEnquiryRouteContext('/projects/not-published')).toEqual({});
    expect(getEnquiryRouteContext('/products/pergolas/not-published')).toEqual({});
  });

  it('keeps the compact header route index aligned with governed catalogues', () => {
    for (const project of projects) {
      expect(getEnquiryRouteContext(`/projects/${project.slug}`)).toEqual({
        enquiryType: project.type === 'Commercial' ? 'commercial' : 'residential',
        sourceProject: project.slug,
      });
    }

    for (const product of products) {
      expect(getEnquiryRouteContext(product.route)).toEqual({
        sourceProduct: product.slug,
      });
    }
  });
});
