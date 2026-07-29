const AUCKLAND_TIME_ZONE = 'Pacific/Auckland';

const aucklandDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AUCKLAND_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Presentation-only local-date conversion.
 *
 * Durable business-calendar rules and cadence deadlines are owned by the
 * atomic database commands in the Project Work Items V2 migration.
 */
export function aucklandLocalDate(value: Date | string): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.valueOf())) return '';
  const parts = new Map(
    aucklandDateFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}
