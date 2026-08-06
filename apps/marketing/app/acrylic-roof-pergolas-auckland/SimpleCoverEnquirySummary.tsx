import Link from 'next/link';
import {
  SIMPLE_COVER_CONNECTION_OPTIONS,
} from '@/lib/simpleCoverCalculator';
import type { SimpleCoverHandoff } from '@/lib/simpleCoverHandoff';

function formatMetres(valueMm: number): string {
  return `${(valueMm / 1_000).toFixed(1)} m`;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SimpleCoverEnquirySummary({
  estimate,
  changeHref = '#price-your-cover',
}: {
  estimate: SimpleCoverHandoff | null;
  changeHref?: string;
}) {
  const connection = estimate
    ? SIMPLE_COVER_CONNECTION_OPTIONS.find((option) => option.value === estimate.input.connection)?.label
      ?? 'Selected connection'
    : null;

  return (
    <section
      className="acrylic-form__estimate-summary acrylic-form__field--wide"
      aria-labelledby="simple-cover-enquiry-summary-title"
      data-simple-cover-enquiry-summary={estimate?.status ?? 'empty'}
    >
      <span>Configured Simple cover</span>
      {estimate ? (
        <>
          <div className="acrylic-form__estimate-summary-heading">
            <h3 id="simple-cover-enquiry-summary-title">
              {estimate.status === 'priced'
                ? 'Your estimate is ready for a site measure request.'
                : estimate.status === 'custom'
                  ? 'This footprint needs a Custom review.'
                  : 'Your selections are ready for review.'}
            </h3>
            {estimate.status === 'priced' && estimate.displayedPriceIncGst ? (
              <strong>From {formatPrice(estimate.displayedPriceIncGst)}</strong>
            ) : null}
          </div>
          <dl>
            <div>
              <dt>Footprint</dt>
              <dd>{formatMetres(estimate.input.widthMm)} × {formatMetres(estimate.input.projectionMm)}</dd>
            </div>
            <div>
              <dt>Deck level</dt>
              <dd>{estimate.input.level === 'ground' ? 'Ground level' : 'Elevated / first floor'}</dd>
            </div>
            <div>
              <dt>House connection</dt>
              <dd>{connection}</dd>
            </div>
          </dl>
          <p>
            {estimate.status === 'priced'
              ? 'This estimate stays linked to the exact configuration you priced. Sanctuary will review the site and scope, then confirm whether a site measure is the right next step.'
              : estimate.status === 'custom'
                ? 'We’ll use these selections to understand the footprint and recommend the right Custom pathway.'
                : 'Live pricing is unavailable, but these selections will still give the team a useful starting point.'}
          </p>
          <Link href={changeHref}>Change this configuration</Link>
        </>
      ) : (
        <>
          <h3 id="simple-cover-enquiry-summary-title">No calculator result is attached yet.</h3>
          <p>You can still enquire now, or configure the footprint first so the team receives the same dimensions, deck level and connection.</p>
          <Link href={changeHref}>Price your Simple cover</Link>
        </>
      )}
    </section>
  );
}
