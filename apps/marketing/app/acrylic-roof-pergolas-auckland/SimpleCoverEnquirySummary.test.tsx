import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SimpleCoverHandoff } from '@/lib/simpleCoverHandoff';
import SimpleCoverEnquirySummary from './SimpleCoverEnquirySummary';

const estimate: SimpleCoverHandoff = {
  schemaVersion: 'simple-cover-handoff.v1',
  status: 'priced',
  input: {
    widthMm: 6_000,
    projectionMm: 3_000,
    level: 'elevated',
    connection: 'soffit',
  },
  calculationRef: 'v1.this-reference-must-not-render',
  displayedPriceIncGst: 28_000,
  configurationVersion: 7,
};

describe('SimpleCoverEnquirySummary', () => {
  it('shows the configured estimate without rendering its opaque reference', () => {
    const html = renderToStaticMarkup(<SimpleCoverEnquirySummary estimate={estimate} />);

    expect(html).toContain('Your estimate is ready for a site measure request.');
    expect(html).toContain('From $28,000');
    expect(html).toContain('6.0 m');
    expect(html).toContain('3.0 m');
    expect(html).toContain('Elevated / first floor');
    expect(html).toContain('Soffit brackets');
    expect(html).not.toContain(estimate.calculationRef);
  });

  it('keeps a direct enquiry useful before a calculator handoff', () => {
    const html = renderToStaticMarkup(<SimpleCoverEnquirySummary estimate={null} />);

    expect(html).toContain('No calculator result is attached yet.');
    expect(html).toContain('href="#price-your-cover"');
  });
});
