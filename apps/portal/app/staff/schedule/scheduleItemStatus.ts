import type { ScheduleItem, ScheduleItemStatus } from '@/lib/types/scheduling';

export function deriveScheduleStatus(item: ScheduleItem, today: string): ScheduleItemStatus {
  const value = typeof item.scheduleStatus === 'string' ? item.scheduleStatus.trim().toUpperCase() : '';
  const raw = value === 'CONFIRMED' || value === 'IN_PROGRESS' || value === 'COMPLETED' ? value : 'TENTATIVE';
  if (item.scheduledJobId || item.itemType === 'job') {
    if (item.jobStatus === 'done' || item.actualEndDate) return 'COMPLETED';
    if (item.jobStatus === 'in_progress' || item.jobStatus === 'paused' || item.actualStartDate) return 'IN_PROGRESS';
    return raw === 'CONFIRMED' || item.locked ? 'CONFIRMED' : 'TENTATIVE';
  }
  // Retain the isolated legacy surface's date-derived status contract.
  if (raw === 'COMPLETED') return 'COMPLETED';
  const planned = typeof item.startDateOverride === 'string' ? item.startDateOverride : '';
  const started = Boolean(item.actualStartDate) || (planned && planned <= today);
  if (started) return 'IN_PROGRESS';
  if (raw === 'CONFIRMED' || item.locked) return 'CONFIRMED';
  return 'TENTATIVE';
}
