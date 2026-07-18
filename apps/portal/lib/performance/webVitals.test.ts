import { describe, expect, it } from 'vitest';
import {
  portalPerformanceDeviceClass,
  portalRouteTemplate,
  sanitizePortalWebVitalEvent,
} from './webVitals';

describe('portal Web Vitals privacy boundary', () => {
  it('maps dynamic routes to identifier-free templates', () => {
    expect(portalRouteTemplate('/staff/projects/project-secret')).toBe('/staff/projects/[projectId]');
    expect(portalRouteTemplate('/staff/projects/project-secret/design-workbench')).toBe(
      '/staff/projects/[projectId]/design-workbench',
    );
    expect(portalRouteTemplate('/staff/contacts/contact-secret')).toBe('/staff/contacts/[contactId]');
    expect(portalRouteTemplate('/staff/projects/design-packages')).toBe('/staff/projects/design-packages');
    expect(portalRouteTemplate('/unknown/customer-name')).toBeNull();
  });

  it('keeps only the closed event contract', () => {
    const event = sanitizePortalWebVitalEvent({
      name: 'INP',
      value: 142.12345,
      rating: 'good',
      routeTemplate: '/staff/projects/[projectId]',
      navigationType: 'navigate',
      deviceClass: 'desktop',
      buildId: 'build-123',
      rawUrl: '/staff/projects/private-project?customer=Alice',
      userId: 'private-user',
      email: 'alice@example.com',
    });

    expect(event).toEqual({
      name: 'INP',
      value: 142.123,
      rating: 'good',
      routeTemplate: '/staff/projects/[projectId]',
      navigationType: 'navigate',
      deviceClass: 'desktop',
      buildId: 'build-123',
    });
    expect(JSON.stringify(event)).not.toMatch(/Alice|private-project|private-user|example\.com/);
  });

  it('rejects invalid, non-finite and free-form route values', () => {
    const base = {
      name: 'LCP',
      value: 800,
      rating: 'good',
      routeTemplate: '/dashboard',
      navigationType: 'reload',
      deviceClass: 'desktop',
    };
    expect(sanitizePortalWebVitalEvent({ ...base, value: Number.NaN })).toBeNull();
    expect(sanitizePortalWebVitalEvent({ ...base, value: Number.POSITIVE_INFINITY })).toBeNull();
    expect(sanitizePortalWebVitalEvent({ ...base, routeTemplate: '/staff/projects/secret' })).toBeNull();
    expect(sanitizePortalWebVitalEvent({ ...base, buildId: 'customer@example.com' })).toEqual(base);
  });

  it('classifies device width without retaining user-agent data', () => {
    expect(portalPerformanceDeviceClass(500)).toBe('mobile');
    expect(portalPerformanceDeviceClass(900)).toBe('tablet');
    expect(portalPerformanceDeviceClass(1600)).toBe('desktop');
  });
});
