import { afterEach, describe, expect, it } from 'vitest';
import {
  getSimpleCoverViewportCategory,
  getSimpleCoverSourcePath,
  pushSimpleCoverFunnelEvent,
} from './simpleCoverAnalytics';

type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
};

afterEach(() => {
  delete (window as TrackingWindow).dataLayer;
});

describe('pushSimpleCoverFunnelEvent', () => {
  it('uses the shared closed viewport buckets', () => {
    expect(getSimpleCoverViewportCategory(640)).toBe('mobile');
    expect(getSimpleCoverViewportCategory(641)).toBe('tablet');
    expect(getSimpleCoverViewportCategory(1_024)).toBe('tablet');
    expect(getSimpleCoverViewportCategory(1_025)).toBe('desktop');
    expect(getSimpleCoverSourcePath('standalone')).toBe('/simple-cover-calculator');
    expect(getSimpleCoverSourcePath('embedded')).toBe('/simple-pergolas-auckland');
    expect(getSimpleCoverSourcePath('contact')).toBe('/contact');
  });

  it('emits only the closed, non-personal funnel fields', () => {
    const properties = {
      placement: 'embedded',
      result_status: 'priced',
      source_path: '/simple-pergolas-auckland',
      viewport_category: 'mobile',
      calculation_attached: true,
      price: 24_250,
      widthMm: 6_000,
      calculationRef: 'private-reference',
      customerEmail: 'person@example.test',
    } as const;

    expect(pushSimpleCoverFunnelEvent('simple_calculator_cta_click', properties)).toBe(true);
    expect((window as TrackingWindow).dataLayer).toEqual([{
      event: 'simple_calculator_cta_click',
      placement: 'embedded',
      result_status: 'priced',
      source_path: '/simple-pergolas-auckland',
      viewport_category: 'mobile',
      calculation_attached: true,
    }]);
  });

  it('fails closed for values outside the event contract', () => {
    expect(pushSimpleCoverFunnelEvent(
      'simple_calculator_result_view',
      {
        placement: 'campaign' as 'embedded',
        result_status: 'priced',
        source_path: '/unexpected' as '/simple-pergolas-auckland',
        viewport_category: 'desktop',
        calculation_attached: true,
      },
    )).toBe(false);
    expect(pushSimpleCoverFunnelEvent(
      'simple_calculator_view',
      null as unknown as Parameters<typeof pushSimpleCoverFunnelEvent>[1],
    )).toBe(false);
    expect((window as TrackingWindow).dataLayer).toBeUndefined();
  });

  it('accepts the governed contact placement without adding personal data', () => {
    expect(pushSimpleCoverFunnelEvent('simple_calculator_form_start', {
      placement: 'contact',
      result_status: 'priced',
      source_path: '/contact',
      viewport_category: 'desktop',
      calculation_attached: true,
    })).toBe(true);
  });
});
