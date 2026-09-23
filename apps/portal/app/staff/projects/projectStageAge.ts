import { formatPortalDate, portalTodayYmd } from '@/lib/format/portalDateTime';

/** Calendar days in Auckland, so DST and the viewer's timezone cannot change age. */
export function projectStageAge(value: string | null | undefined, now = new Date()) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.valueOf()) || date > now) return null;
  const days = Math.round((Date.parse(portalTodayYmd(now)) - Date.parse(portalTodayYmd(date))) / 86_400_000);
  return { days, label: days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`, date: formatPortalDate(date) };
}
