import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { addDaysYmd, isYmd } from '@/lib/scheduling/date';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';

type ScheduleJobIdentity = {
  projectName: string;
  customerName: string | null;
  siteAddress: string | null;
  identityDetail: string | null;
  searchText: string;
};

export type ScheduleJobPresentation = ScheduleJobIdentity & {
  scheduleItemId: string;
  crewName: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function normalizedIdentity(value: string | null): string {
  return value?.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? '';
}

function uniqueIdentityParts(projectName: string, customerName: string | null, siteAddress: string | null): string[] {
  const projectKey = normalizedIdentity(projectName);
  const seen = new Set(projectKey ? [projectKey] : []);
  const parts: string[] = [];
  for (const value of [customerName, siteAddress]) {
    const key = normalizedIdentity(value);
    if (!value || !key || seen.has(key)) continue;
    seen.add(key);
    parts.push(value);
  }
  return parts;
}

export function buildScheduleJobIdentity(project: ScheduleProjectSummary | null | undefined): ScheduleJobIdentity {
  const projectName = cleanText(project?.projectName) ?? cleanText(project?.name) ?? 'Untitled project';
  const customerName = cleanText(project?.customerName);
  const siteAddress = cleanText(project?.siteAddress);
  const identityParts = uniqueIdentityParts(projectName, customerName, siteAddress);
  return {
    projectName,
    customerName,
    siteAddress,
    identityDetail: identityParts.length ? identityParts.join(' · ') : null,
    searchText: [projectName, customerName, siteAddress].filter(Boolean).join(' ').toLocaleLowerCase(),
  };
}

export function buildScheduleJobPresentation(input: {
  item: ScheduleItem;
  project: ScheduleProjectSummary | null | undefined;
  installer: Installer | null | undefined;
}): ScheduleJobPresentation {
  const identity = buildScheduleJobIdentity(input.project);
  const startDate = isYmd(input.item.forecastStart ?? '')
    ? input.item.forecastStart ?? null
    : isYmd(input.item.startDateOverride ?? '')
      ? input.item.startDateOverride ?? null
      : null;
  const durationDays =
    typeof input.item.forecastDurationDays === 'number' && Number.isFinite(input.item.forecastDurationDays)
      ? Math.max(1, Math.trunc(input.item.forecastDurationDays))
      : typeof input.item.durationHoursOverride === 'number' && Number.isFinite(input.item.durationHoursOverride)
        ? Math.max(1, Math.ceil(input.item.durationHoursOverride / WORK_HOURS_PER_DAY))
        : 1;
  const endDate = isYmd(input.item.forecastEndExclusive ?? '')
    ? addDaysYmd(input.item.forecastEndExclusive ?? '', -1)
    : startDate
      ? addDaysYmd(startDate, durationDays - 1)
      : null;

  return {
    ...identity,
    scheduleItemId: input.item.id,
    crewName: cleanText(input.installer?.name) ?? 'Unassigned crew',
    startDate,
    endDate,
    durationDays,
  };
}

export function buildScheduleJobPresentationIndex(input: {
  scheduleItems: readonly ScheduleItem[];
  projectsById: ReadonlyMap<string, ScheduleProjectSummary>;
  installersById: ReadonlyMap<string, Installer>;
}): Map<string, ScheduleJobPresentation> {
  const index = new Map<string, ScheduleJobPresentation>();
  for (const item of input.scheduleItems) {
    if (item.itemType === 'downtime') continue;
    index.set(item.id, buildScheduleJobPresentation({
      item,
      project: input.projectsById.get(item.projectId),
      installer: input.installersById.get(item.installerId),
    }));
  }
  return index;
}

export function formatScheduleJobTiming(
  presentation: ScheduleJobPresentation,
  formatDate: (ymd: string) => string,
): string {
  if (!presentation.startDate || !presentation.endDate) return `${presentation.durationDays}d · Dates not set`;
  return `${formatDate(presentation.startDate)} to ${formatDate(presentation.endDate)} · ${presentation.durationDays}d`;
}
