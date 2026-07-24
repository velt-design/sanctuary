import { describe, expect, it } from 'vitest';
import { normalizeKnownEnquirySourceContext } from './enquirySourceContext.server';

describe('known enquiry source context', () => {
  it('keeps public project and product references', () => {
    expect(normalizeKnownEnquirySourceContext({
      sourcePath: '/projects/warkworth-outdoor-room',
      sourceComponent: 'project-final',
      projectSlug: 'warkworth-outdoor-room',
      productSlug: 'gable',
    })).toEqual({
      sourcePath: '/projects/warkworth-outdoor-room',
      sourceComponent: 'project-final',
      projectSlug: 'warkworth-outdoor-room',
      productSlug: 'gable',
    });
  });

  it('drops invented slugs before persistence and analytics', () => {
    expect(normalizeKnownEnquirySourceContext({
      sourcePath: '/contact',
      sourceComponent: 'header',
      projectSlug: 'private-customer-reference',
      productSlug: 'invented-product',
    })).toEqual({
      sourcePath: '/contact',
      sourceComponent: 'header',
    });
  });
});
