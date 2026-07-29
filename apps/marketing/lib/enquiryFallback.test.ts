import { describe, expect, it } from 'vitest';
import { buildEnquiryFallbackPayload } from './enquiryFallback';

describe('buildEnquiryFallbackPayload', () => {
  it('preserves direct-form arrays, context, reachability, and technical details', () => {
    const formData = new FormData();
    formData.set('enquiryType', 'commercial');
    formData.set('name', 'Test Person');
    formData.set('phone', '021 000 0000');
    formData.set('email', 'test@example.com');
    formData.set('message', 'A covered customer area.');
    formData.set('widthM', '6');
    formData.append('roofMaterials', 'acrylic');
    formData.append('roofMaterials', 'timber');
    formData.append('addOns', 'blinds');
    formData.append('addOns', 'lighting');
    formData.set('page', '/contact');
    formData.set('source', 'website');
    formData.set(
      'enquiryContext',
      JSON.stringify({
        enquiry_type: 'commercial',
        source_path: '/projects/goodhome-commercial-terrace',
        source_component: 'project_cta',
      }),
    );

    expect(buildEnquiryFallbackPayload(
      formData,
      'c12688f9-50e4-42e8-a5e9-d9e0319bd086',
    )).toMatchObject({
      submissionId: 'c12688f9-50e4-42e8-a5e9-d9e0319bd086',
      enquiryType: 'commercial',
      name: 'Test Person',
      phone: '021 000 0000',
      email: 'test@example.com',
      dimensions: { widthM: '6', depthM: null, heightM: null },
      roofMaterials: ['acrylic', 'timber'],
      addOns: {
        blinds: true,
        slats: false,
        lighting: true,
        heating: false,
      },
      enquiryContext: {
        enquiry_type: 'commercial',
        source_path: '/projects/goodhome-commercial-terrace',
        source_component: 'project_cta',
      },
      page: '/contact',
    });
  });

  it('maps embedded-form roof choices and keeps page-specific details', () => {
    const formData = new FormData();
    formData.set('enquiryType', 'professional');
    formData.set('name', 'Test Architect');
    formData.set('phone', '+64 21 555 0101');
    formData.set('email', 'architect@example.com');
    formData.set('roofPreference', 'Combination roofing');
    formData.append('priorities', 'Rain protection');
    formData.append('priorities', 'Architectural integration');
    formData.append('accessories', 'Outdoor blinds');
    formData.set('operatingConstraints', 'Keep the public route clear.');

    expect(buildEnquiryFallbackPayload(
      formData,
      '24719055-79d0-4b3c-86ef-d3e8aa8a8795',
    )).toMatchObject({
      enquiryType: 'professional',
      roofMaterials: ['acrylic', 'timber'],
      addOns: { blinds: true },
      projectDetails: {
        roofPreference: 'Combination roofing',
        priorities: ['Rain protection', 'Architectural integration'],
        accessories: 'Outdoor blinds',
        operatingConstraints: 'Keep the public route clear.',
      },
    });
  });
});
