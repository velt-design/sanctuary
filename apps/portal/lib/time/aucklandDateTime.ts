const AUCKLAND_TIME_ZONE = 'Pacific/Auckland';
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function partsAt(instant: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: AUCKLAND_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
}

export function formatAucklandDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) return '';
  const parts = partsAt(parsed);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function parseAucklandDateTimeLocal(value: string): string | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const localUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const offsetAt = (instant: number) => {
    const parts = partsAt(new Date(instant));
    const representedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return representedUtc - instant;
  };

  let instant = localUtc - offsetAt(localUtc);
  instant = localUtc - offsetAt(instant);
  const parsed = new Date(instant);
  if (!Number.isFinite(parsed.valueOf())) return null;

  // Reject impossible wall-clock values during the daylight-saving gap.
  return formatAucklandDateTimeLocal(parsed.toISOString()) === value
    ? parsed.toISOString()
    : null;
}
