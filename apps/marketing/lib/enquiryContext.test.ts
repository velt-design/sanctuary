import { describe, expect, it } from 'vitest';
import {
  buildEnquiryHref,
  getEnquiryContextProperties,
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

  it('infers only known audience routes and keeps direct contact neutral', () => {
    expect(inferEnquiryAudience('/commercial-pergolas-auckland')).toBe('commercial');
    expect(inferEnquiryAudience('/projects')).toBe('residential');
    expect(inferEnquiryAudience('/contact')).toBeUndefined();
  });
});
