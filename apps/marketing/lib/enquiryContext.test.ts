import { describe, expect, it } from 'vitest';
import {
  buildEnquiryHref,
  getHeaderEnquiryContext,
  normalizeEnquirySourceContext,
  parseEnquiryContext,
} from './enquiryContext';

describe('enquiry context', () => {
  it('builds a stable, non-personal contact link', () => {
    expect(buildEnquiryHref({
      enquiryType: 'commercial',
      sourcePath: '/commercial-pergolas-auckland',
      sourceComponent: 'header',
      projectSlug: 'atelier-shu-cafe',
    })).toBe(
      '/contact?enquiry=commercial&source_path=%2Fcommercial-pergolas-auckland'
      + '&source_component=header&project=atelier-shu-cafe#contact-form',
    );
  });

  it('parses supported values and drops malformed or unknown context', () => {
    expect(parseEnquiryContext(new URLSearchParams({
      enquiry: 'Professional',
      source_path: '/projects/warkworth-outdoor-room',
      source_component: 'project-final',
      project: 'warkworth-outdoor-room',
      product: 'not valid!',
    }))).toEqual({
      enquiryType: 'professional',
      sourcePath: '/projects/warkworth-outdoor-room',
      sourceComponent: 'project-final',
      projectSlug: 'warkworth-outdoor-room',
    });

    expect(parseEnquiryContext({
      enquiry: 'general',
      source_path: 'https://example.com/private',
      source_component: 'free-form-value',
      project: '../customer-name',
    })).toEqual({});
  });

  it('normalizes the submitted source context independently of URL parsing', () => {
    expect(normalizeEnquirySourceContext({
      sourcePath: '/products/pergolas/gable',
      sourceComponent: 'product-hero',
      productSlug: 'gable',
      extra: 'ignored',
    })).toEqual({
      sourcePath: '/products/pergolas/gable',
      sourceComponent: 'product-hero',
      productSlug: 'gable',
    });
  });

  it('keeps known header intent and leaves mixed or neutral routes unclassified', () => {
    expect(getHeaderEnquiryContext('/commercial-pergolas-auckland')).toEqual({
      enquiryType: 'commercial',
      sourcePath: '/commercial-pergolas-auckland',
    });
    expect(getHeaderEnquiryContext('/products/pergolas/gable')).toEqual({
      enquiryType: 'residential',
      sourcePath: '/products/pergolas/gable',
      productSlug: 'gable',
    });
    expect(getHeaderEnquiryContext('/projects/atelier-shu-cafe')).toEqual({
      sourcePath: '/projects/atelier-shu-cafe',
      projectSlug: 'atelier-shu-cafe',
    });
    expect(getHeaderEnquiryContext('/contact')).toEqual({
      sourcePath: '/contact',
    });
  });
});
