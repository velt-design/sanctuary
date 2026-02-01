export function getCallWindowText(submittedAt: Date, timeZone = 'Pacific/Auckland') {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(submittedAt);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const minutesOfDay = hour * 60 + minute;

  // Working hours: 9:00-17:00
  const start = 9 * 60;
  const end = 17 * 60;

  const withinHours = !isWeekend && minutesOfDay >= start && minutesOfDay < end;

  return withinHours
    ? 'within 30 minutes'
    : 'within 30 minutes of the next working day';
}
