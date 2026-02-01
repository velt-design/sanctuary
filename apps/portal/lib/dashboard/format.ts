export const NZ_TZ = 'Pacific/Auckland';

export function todayNzYYYYMMDD() {
  return new Date().toLocaleDateString('en-CA', { timeZone: NZ_TZ });
}

export function addDaysYYYYMMDD(yyyyMmDd: string, days: number) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function humanDueLabel(dueYYYYMMDD?: string | null, todayYYYYMMDD?: string) {
  if (!dueYYYYMMDD) return null;
  const t = todayYYYYMMDD ?? todayNzYYYYMMDD();
  if (dueYYYYMMDD < t) return 'Overdue';
  if (dueYYYYMMDD === t) return 'Today';
  return null;
}

export function formatShortDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', timeZone: NZ_TZ });
}

export function formatShortDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString('en-NZ', {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: NZ_TZ,
  });
}
