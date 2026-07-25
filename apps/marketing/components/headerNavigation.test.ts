import { describe, expect, it } from 'vitest';
import { buildEnquiryHref } from '../lib/enquiryContext';
import {
  getDesktopHeaderNavigation,
  getMobileHeaderNavigation,
} from './headerNavigation';

describe('shared header navigation model', () => {
  it('keeps the established desktop destinations and labels unchanged', () => {
    expect(getDesktopHeaderNavigation('/').map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Projects', href: '/projects' },
      { label: 'Products', href: '/products' },
      { label: 'Contact', href: '/contact' },
    ]);
  });

  it('clarifies product discovery and exposes the approved mobile pathways', () => {
    expect(getMobileHeaderNavigation('/projects').map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Projects', href: '/projects' },
      { label: 'Pergola options', href: '/products' },
      { label: 'Commercial', href: '/commercial-pergolas-auckland' },
      {
        label: 'Architects, designers & builders',
        href: buildEnquiryHref({
          enquiryType: 'professional',
          sourcePath: '/projects',
          sourceComponent: 'header',
        }),
      },
      { label: 'Contact', href: '/contact' },
    ]);
  });

  it('preserves the current source path in the professional enquiry destination', () => {
    const professional = getMobileHeaderNavigation('/products/pergolas/gable')
      .find((item) => item.id === 'professional');

    expect(professional?.href).toBe(
      '/contact?enquiry_type=professional&source_path=%2Fproducts%2Fpergolas%2Fgable&source_component=header#contact-form',
    );
  });

  it('marks parent destinations current on nested routes without claiming enquiry links', () => {
    expect(getMobileHeaderNavigation('/projects/warkworth-outdoor-room')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['projects']);
    expect(getMobileHeaderNavigation('/products/pergolas/pitched')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['products']);
    expect(getMobileHeaderNavigation('/commercial-pergolas-auckland')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['commercial']);
    expect(getMobileHeaderNavigation('/contact')
      .filter((item) => item.current)
      .map((item) => item.id)).toEqual(['contact']);
  });
});
