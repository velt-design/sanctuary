'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './schedule.module.css';
import type { SiteVisitCalendarItem, SiteVisitsSnapshotV1 } from '@/lib/types/siteVisits';
import UnscheduledSiteVisitCard from './UnscheduledSiteVisitCard';
import { apiJson } from '@/lib/repo/apiClient';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import Modal from '@/components/ui/modal/Modal';
import SiteVisitEventModal, { LINK_NONE, type SiteVisitEventFormValues } from '@/components/schedule/site-visits/SiteVisitEventModal';
import SiteVisitHoverPopover from '@/components/schedule/site-visits/SiteVisitHoverPopover';
import SlotSelectPopover from '@/components/schedule/site-visits/SlotSelectPopover';
import {
  DEFAULT_DURATION_MINUTES,
  DAY_END_HOUR,
  DAY_MINUTES,
  DAY_START_HOUR,
  HOUR_HEIGHT_PX,
  MINUTES_STEP,
  SLOT_HEIGHT_PX,
  START_SCROLL_HOUR,
  WORK_END_HOUR,
  WORK_START_HOUR,
} from '@/components/schedule/site-visits/siteVisits.constants';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { ApiError } from '@/lib/repo/apiClient';
import { SALES_PEOPLE } from '@/src/config/salesPeople';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queries/keys';

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => i + DAY_START_HOUR);
const DAY_START_MINUTES = DAY_START_HOUR * 60;

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, m: mo, d };
}

function toLocalDateFromYmd(ymd: string): Date | null {
  const parts = parseYmd(ymd);
  if (!parts) return null;
  return new Date(parts.y, parts.m - 1, parts.d, 0, 0, 0, 0);
}

function toYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysLocal(ymd: string, days: number): string {
  const dt = toLocalDateFromYmd(ymd);
  if (!dt) return ymd;
  dt.setDate(dt.getDate() + days);
  return toYmdLocal(dt);
}

function startOfWeekMonday(ymd: string): string {
  const dt = toLocalDateFromYmd(ymd);
  if (!dt) return ymd;
  const day = dt.getDay(); // 0=Sun ... 6=Sat
  const daysSinceMonday = (day + 6) % 7;
  return addDaysLocal(ymd, -daysSinceMonday);
}

function slotCount(): number {
  return Math.ceil(DAY_MINUTES / MINUTES_STEP);
}

function slotStartIso(ymd: string, slotIdx: number): string {
  const base = toLocalDateFromYmd(ymd) ?? new Date();
  const mins = DAY_START_MINUTES + clamp(slotIdx, 0, slotCount() - 1) * MINUTES_STEP;
  const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  dt.setMinutes(mins);
  return dt.toISOString();
}

function addMinutesIso(iso: string, minutes: number): string {
  const dt = new Date(iso);
  dt.setMinutes(dt.getMinutes() + minutes);
  return dt.toISOString();
}

function formatTimeLabel(hour: number): string {
  const label = new Date(2000, 0, 1, hour, 0).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' });
  return label;
}

function fmtDayLabel(ymd: string): string {
  const dt = toLocalDateFromYmd(ymd);
  if (!dt) return ymd;
  return new Intl.DateTimeFormat('en-NZ', { weekday: 'short', day: '2-digit', month: 'short' }).format(dt);
}

function firstName(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const beforeDash = raw.split(/[-–—]/)[0].trim();
  return beforeDash.split(/\s+/)[0] ?? '';
}

function siteVisitLabel(item: SiteVisitCalendarItem): string {
  return firstName(item.contact?.name) || firstName(item.project?.name) || item.projectId || '\u2014';
}

function eventStatusClass(status: SiteVisitCalendarItem['status']): string {
  const s = String(status).toUpperCase();
  if (s === 'TENTATIVE') return styles.siteVisitEventTentative;
  if (s === 'CONFIRMED') return styles.siteVisitEventConfirmed;
  if (s === 'RESCHEDULED') return styles.siteVisitEventConfirmed;
  if (s === 'COMPLETED') return styles.siteVisitEventCompleted;
  if (s === 'CANCELLED' || s === 'NO_SHOW') return styles.siteVisitEventCancelled;
  return styles.siteVisitEventTentative;
}

function eventTierClass(tier: SiteVisitCalendarItem['priorityTier']): string {
  if (tier === 1) return styles.siteVisitEventTier1;
  if (tier === 2) return styles.siteVisitEventTier2;
  return '';
}

function toLocalDayKey(iso: string | null): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return null;
  return toYmdLocal(dt);
}

function minutesSinceStart(iso: string): number {
  const dt = new Date(iso);
  const start = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), DAY_START_HOUR, 0, 0, 0);
  return Math.round((dt.getTime() - start.getTime()) / 60000);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function SiteVisitEvent({
  item,
  onClick,
  onHover,
  onUnhover,
}: {
  item: SiteVisitCalendarItem;
  onClick: () => void;
  onHover?: (item: SiteVisitCalendarItem, rect: DOMRect) => void;
  onUnhover?: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.siteVisitEvent} ${eventStatusClass(item.status)} ${eventTierClass(item.priorityTier ?? null)}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={(e) => onHover?.(item, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onUnhover?.()}
      onFocus={(e) => onHover?.(item, e.currentTarget.getBoundingClientRect())}
      onBlur={() => onUnhover?.()}
    >
      <div className={styles.siteVisitEventTitle}>{siteVisitLabel(item)}</div>
    </button>
  );
}

type SiteVisitFormPreset = {
  salespersonId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

type ModalState =
  | { kind: 'closed' }
  | { kind: 'create'; preset?: SiteVisitFormPreset; initialLinkValue?: string; focusLinked?: boolean }
  | { kind: 'edit'; item: SiteVisitCalendarItem; preset?: SiteVisitFormPreset };

type SlotPopoverState = {
  day: string;
  laneId: string;
  slotIdx: number;
  anchorRect: DOMRect;
};

function isoFromLocalInputs(ymd: string, hm: string): string | null {
  const d = parseYmd(ymd);
  if (!d) return null;
  const t = hm.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!t) return null;
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return new Date(d.y, d.m - 1, d.d, hour, minute, 0, 0).toISOString();
}

function hmFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function addMinutesToHm(hm: string, minutes: number): string {
  const match = hm.match(/^(\d{2}):(\d{2})$/);
  if (!match) return hm;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hm;
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return hmFromMinutes(total);
}

function isWorkingHour(hour: number): boolean {
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

function isLocalItem(item: SiteVisitCalendarItem): boolean {
  return item.id.startsWith('local:');
}

export default function SiteVisitsView() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()), []);
  const hostKey = host || 'unknown';

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (didInitScroll.current) return;
    const el = calendarScrollRef.current;
    if (!el) return;
    didInitScroll.current = true;
    requestAnimationFrame(() => {
      const offsetHours = Math.max(0, START_SCROLL_HOUR - DAY_START_HOUR);
      el.scrollTop = offsetHours * HOUR_HEIGHT_PX;
    });
  }, [mounted]);

  const viewWeek = useMemo(() => {
    const raw = (searchParams.get('week') || '').trim();
    const today = toYmdLocal(new Date());
    return startOfWeekMonday(raw || today);
  }, [searchParams]);

  const salesOwnerIdRaw = useMemo(() => (searchParams.get('salesOwnerId') || '').trim() || null, [searchParams]);
  const highlightId = useMemo(() => (searchParams.get('highlightSiteVisitId') || '').trim() || null, [searchParams]);

  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>({ kind: 'closed' });
  const [assigning, setAssigning] = useState<{ item: SiteVisitCalendarItem; salespersonId: string } | null>(null);
  const [slotPopover, setSlotPopover] = useState<SlotPopoverState | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<{ item: SiteVisitCalendarItem; anchorRect: DOMRect } | null>(null);
  const [localEvents, setLocalEvents] = useState<SiteVisitCalendarItem[]>([]);

  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const didInitScroll = useRef(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysLocal(viewWeek, i)), [viewWeek]);

  const slotIndices = useMemo(() => Array.from({ length: slotCount() }, (_, i) => i), []);

  const slotPreset = useMemo(() => {
    if (!slotPopover) return null;
    const startTime = hmFromMinutes(DAY_START_MINUTES + slotPopover.slotIdx * MINUTES_STEP);
    return {
      date: slotPopover.day,
      startTime,
      endTime: addMinutesToHm(startTime, DEFAULT_DURATION_MINUTES),
      salespersonId: slotPopover.laneId,
    } as SiteVisitFormPreset;
  }, [slotPopover]);

  const slotLabel = useMemo(() => {
    if (!slotPopover || !slotPreset) return '';
    return `${fmtDayLabel(slotPopover.day)} ${slotPreset.startTime}`;
  }, [slotPopover, slotPreset]);

  // Sales lanes are authoritative from config (Steve/Bruce), not from cached snapshots.
  // This avoids stale lane headers/IDs breaking drag+drop and salesperson assignment.
  const salesPeople = useMemo(() => SALES_PEOPLE, []);

  const laneIds = useMemo(() => salesPeople.map((p) => p.id), [salesPeople]);
  const salesOwnerId = useMemo(() => (salesOwnerIdRaw && laneIds.includes(salesOwnerIdRaw) ? salesOwnerIdRaw : null), [laneIds, salesOwnerIdRaw]);
  const defaultSalespersonId = useMemo(() => salesOwnerId ?? laneIds[0] ?? '', [laneIds, salesOwnerId]);

  const rangeKey = useMemo(() => `${days[0]}:${days[6]}:${salesOwnerId ?? 'all'}`, [days, salesOwnerId]);
  const snapshotKey = useMemo(() => qk.siteVisits.snapshot(hostKey, rangeKey), [hostKey, rangeKey]);

  const fetchSnapshot = async (): Promise<SiteVisitsSnapshotV1> => {
    const from = new Date(slotStartIso(days[0], 0)).toISOString();
    const to = new Date(addMinutesIso(slotStartIso(days[6], slotCount() - 1), MINUTES_STEP)).toISOString();

    const qs = new URLSearchParams();
    qs.set('from', from);
    qs.set('to', to);
    if (salesOwnerId) qs.set('salesOwnerId', salesOwnerId);

    const res = await apiJson<{ unscheduled: SiteVisitCalendarItem[]; events: SiteVisitCalendarItem[]; salesPeople: any[]; generatedAt: string }>(
      `/api/staff/v1/site-visits?${qs.toString()}`,
    );
    return {
      host: host ?? null,
      rangeFrom: from,
      rangeTo: to,
      salesOwnerId,
      generatedAt: res.generatedAt,
      unscheduled: res.unscheduled,
      events: res.events,
      salesPeople: res.salesPeople,
    };
  };

  const { data: snapshot, error: snapshotError, isFetching, refetch } = useQuery({
    queryKey: snapshotKey,
    queryFn: fetchSnapshot,
    enabled: mounted,
  });

  const syncing = isFetching;

  useEffect(() => {
    if (!snapshotError) return;
    if (snapshot?.unscheduled?.length || snapshot?.events?.length) {
      toast.error("Couldn't refresh site visits (showing last saved).");
      return;
    }
    const msg = snapshotError instanceof Error ? snapshotError.message : 'Failed to load site visits.';
    toast.error(msg);
  }, [snapshotError, snapshot, toast]);

  const fetchFresh = async () => {
    await refetch();
  };

  useEffect(() => {
    setSlotPopover(null);
    setHoveredEvent(null);
  }, [viewWeek, salesOwnerId]);

  const data = snapshot;
  const unscheduled = data?.unscheduled ?? [];
  const events = data?.events ?? [];
  const eventsWithLocal = useMemo(() => [...events, ...localEvents], [events, localEvents]);

  const orphanEventCandidates = useMemo(() => events.filter((ev) => !(ev.project.name || '').trim()), [events]);
  const renderableEvents = useMemo(() => eventsWithLocal.filter((ev) => (ev.project.name || '').trim()), [eventsWithLocal]);
  const needsAssignmentEvents = useMemo(() => {
    return renderableEvents
      .filter((ev) => {
        if (!ev.scheduledStart) return false;
        if (ev.salespersonId && laneIds.includes(ev.salespersonId)) return false;
        return true;
      })
      .slice()
      .sort((a, b) => String(a.scheduledStart ?? '').localeCompare(String(b.scheduledStart ?? '')));
  }, [laneIds, renderableEvents]);
  const assignedRenderableEvents = useMemo(
    () => renderableEvents.filter((ev) => Boolean(ev.salespersonId) && laneIds.includes(ev.salespersonId as string)),
    [laneIds, renderableEvents],
  );

  const setAndCacheSnapshot = (next: SiteVisitsSnapshotV1) => {
    queryClient.setQueryData(snapshotKey, next);
  };

  const applyOptimisticBooking = (params: {
    base: SiteVisitsSnapshotV1;
    fromUnscheduledId?: string | null;
    booked: SiteVisitCalendarItem;
  }) => {
    const nextUnscheduled = params.fromUnscheduledId
      ? (params.base.unscheduled ?? []).filter((u) => u.id !== params.fromUnscheduledId)
      : params.base.unscheduled ?? [];

    const existingEvents = params.base.events ?? [];
    const nextEvents = [...existingEvents];
    const idx = nextEvents.findIndex((e) => e.id === params.booked.id);
    if (idx >= 0) nextEvents[idx] = params.booked;
    else nextEvents.push(params.booked);

    setAndCacheSnapshot({ ...params.base, unscheduled: nextUnscheduled, events: nextEvents });
  };

  const unscheduledFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return unscheduled.filter((it) => {
      if (!needle) return true;
      const text = [it.project.name, it.project.region, it.project.siteAddress, it.contact.name, it.contact.email, it.contact.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(needle);
    });
  }, [query, unscheduled]);

  const unscheduledSorted = useMemo(() => {
    const list = [...unscheduledFiltered];
    list.sort((a, b) => {
      const ta = a.priorityTier ?? 99;
      const tb = b.priorityTier ?? 99;
      return ta - tb;
    });
    return list;
  }, [unscheduledFiltered]);

  const eventsByLaneDay = useMemo(() => {
    const map = new Map<string, SiteVisitCalendarItem[]>();
    for (const ev of assignedRenderableEvents) {
      const day = toLocalDayKey(ev.scheduledStart);
      if (!day) continue;
      if (!ev.salespersonId) continue;
      const key = `${day}::${ev.salespersonId}`;
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => String(a.scheduledStart ?? '').localeCompare(String(b.scheduledStart ?? '')));
    }
    return map;
  }, [assignedRenderableEvents]);

  const removeOrphans = async () => {
    try {
      setActionError(null);
      const res = await apiJson<{ removed: number }>('/api/staff/v1/site-visits/remove-orphans', { method: 'POST' });
      toast.success(`Removed ${res.removed} orphaned site visit${res.removed === 1 ? '' : 's'}.`);
      await fetchFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove orphaned site visits.';
      toast.error(msg);
    }
  };

  const openWeek = (weekYmd: string) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('view', 'site-visits');
    qs.set('week', weekYmd);
    router.replace(`/staff/schedule?${qs.toString()}`);
  };

  const setSalesOwner = (next: string | null) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('view', 'site-visits');
    qs.set('week', viewWeek);
    if (next) qs.set('salesOwnerId', next);
    else qs.delete('salesOwnerId');
    qs.delete('highlightSiteVisitId');
    router.replace(`/staff/schedule?${qs.toString()}`);
  };

  const highlight = (id: string | null) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('view', 'site-visits');
    qs.set('week', viewWeek);
    if (salesOwnerId) qs.set('salesOwnerId', salesOwnerId);
    if (id) qs.set('highlightSiteVisitId', id);
    else qs.delete('highlightSiteVisitId');
    router.replace(`/staff/schedule?${qs.toString()}`);
  };

  const upsertLocalEvent = (next: SiteVisitCalendarItem) => {
    setLocalEvents((prev) => {
      const idx = prev.findIndex((ev) => ev.id === next.id);
      if (idx === -1) return [...prev, next];
      const clone = [...prev];
      clone[idx] = next;
      return clone;
    });
  };

  const applyOptimisticReschedule = (base: SiteVisitsSnapshotV1, next: SiteVisitCalendarItem) => {
    const nextEvents = (base.events ?? []).map((e) => (e.id === next.id ? next : e));
    setAndCacheSnapshot({ ...base, events: nextEvents });
  };

  const openEditModal = (item: SiteVisitCalendarItem, preset?: SiteVisitFormPreset) => {
    setHoveredEvent(null);
    setSlotPopover(null);
    setModal({ kind: 'edit', item, preset });
  };

  const openCreateModal = (params?: { preset?: SiteVisitFormPreset; initialLinkValue?: string; focusLinked?: boolean }) => {
    setHoveredEvent(null);
    setSlotPopover(null);
    setModal({ kind: 'create', preset: params?.preset, initialLinkValue: params?.initialLinkValue, focusLinked: params?.focusLinked });
  };

  const closeModal = () => setModal({ kind: 'closed' });

  const openSlotPopover = (params: { day: string; laneId: string; slotIdx: number; rect: DOMRect }) => {
    setHoveredEvent(null);
    setSlotPopover({ day: params.day, laneId: params.laneId, slotIdx: params.slotIdx, anchorRect: params.rect });
  };

  const handleModalSave = async (values: SiteVisitEventFormValues) => {
    try {
      setActionError(null);
      const salespersonId = values.salespersonId.trim();
      if (!salespersonId) {
        toast.error('Salesperson is required.');
        return;
      }
      if (!laneIds.includes(salespersonId)) {
        toast.error('Invalid salesperson.');
        return;
      }

      const startIso = isoFromLocalInputs(values.date, values.startTime);
      if (!startIso) {
        toast.error('Date and start time are required.');
        return;
      }

      const endIso = isoFromLocalInputs(values.date, values.endTime);
      if (!endIso) {
        toast.error('End time is required.');
        return;
      }
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        toast.error('End time must be after start time.');
        return;
      }

      if (modal.kind === 'create') {
        if (values.linkMode === 'unscheduled') {
          if (!values.linkedUnscheduledId) {
            toast.error('Select an unscheduled visit.');
            return;
          }
          const base = snapshot;
          if (!base) return;
          const fromUnscheduled = (base.unscheduled ?? []).find((u) => u.id === values.linkedUnscheduledId) ?? null;
          if (!fromUnscheduled) {
            toast.error('Selected visit is no longer available.');
            return;
          }

          const res = await apiJson<any>(`/api/staff/v1/projects/${encodeURIComponent(fromUnscheduled.projectId)}/action/site-visit/book`, {
            method: 'POST',
            body: JSON.stringify({
              start: startIso,
              end: endIso,
              salespersonId,
              tentative: true,
              notes: values.notes.trim(),
            }),
          });

          const now = new Date().toISOString();
          const returnedId = typeof res?.siteVisitEventId === 'string' && res.siteVisitEventId.trim() ? res.siteVisitEventId.trim() : null;
          const existingEvent = (base.events ?? []).find((e) => e.projectId === fromUnscheduled.projectId) ?? null;
          const id = returnedId ?? fromUnscheduled.id ?? existingEvent?.id ?? fromUnscheduled.id;
          const seed = fromUnscheduled ?? existingEvent ?? fromUnscheduled;

          const booked: SiteVisitCalendarItem = {
            ...seed,
            id,
            status: 'TENTATIVE',
            scheduledStart: startIso,
            scheduledEnd: endIso,
            salespersonId,
            notes: values.notes.trim() || null,
            customerNotified: false,
            lastNotifiedAt: seed.lastNotifiedAt ?? null,
            cancelReason: null,
            updatedAt: now,
          };

          applyOptimisticBooking({ base, fromUnscheduledId: fromUnscheduled.id, booked });
          toast.success('Booked.');
          closeModal();
          await fetchFresh();
          return;
        }

        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `local:${crypto.randomUUID()}` : `local:${Date.now()}`;
        const now = new Date().toISOString();
        const title = values.address.trim() || 'Site visit (no project)';
        const localEvent: SiteVisitCalendarItem = {
          id,
          projectId: id,
          status: 'TENTATIVE',
          scheduledStart: startIso,
          scheduledEnd: endIso,
          salespersonId,
          notes: values.notes.trim() || null,
          customerNotified: false,
          lastNotifiedAt: null,
          cancelReason: null,
          createdAt: now,
          updatedAt: now,
          project: {
            id,
            name: title,
            region: null,
            siteAddress: values.address.trim() || null,
            pipelineStage: 'SITE_VISIT',
          },
          contact: {
            id: null,
            name: null,
            email: null,
            phone: values.phone.trim() || null,
          },
        };

        upsertLocalEvent(localEvent);
        toast.success('Site visit created (local only).');
        closeModal();
        return;
      }

      if (modal.kind !== 'edit') return;
      const item = modal.item;

      if (isLocalItem(item)) {
        const nextLocal: SiteVisitCalendarItem = {
          ...item,
          scheduledStart: startIso,
          scheduledEnd: endIso,
          salespersonId,
          notes: values.notes.trim() || null,
          updatedAt: new Date().toISOString(),
          project: {
            ...item.project,
            name: item.project.name,
            siteAddress: values.address.trim() || item.project.siteAddress,
          },
          contact: {
            ...item.contact,
            phone: values.phone.trim() || item.contact.phone,
          },
        };
        upsertLocalEvent(nextLocal);
        toast.success('Site visit updated (local only).');
        closeModal();
        return;
      }

      const base = snapshot;
      if (!base) return;

      if (!item.scheduledStart || String(item.status).toUpperCase() === 'UNSCHEDULED') {
        const res = await apiJson<any>(`/api/staff/v1/projects/${encodeURIComponent(item.projectId)}/action/site-visit/book`, {
          method: 'POST',
          body: JSON.stringify({
            start: startIso,
            end: endIso,
            salespersonId,
            tentative: true,
            notes: values.notes.trim(),
          }),
        });

        const now = new Date().toISOString();
        const returnedId = typeof res?.siteVisitEventId === 'string' && res.siteVisitEventId.trim() ? res.siteVisitEventId.trim() : null;
        const fromUnscheduled = (base.unscheduled ?? []).find((u) => u.id === item.id) ?? null;
        const existingEvent = (base.events ?? []).find((e) => e.projectId === item.projectId) ?? null;
        const id = returnedId ?? fromUnscheduled?.id ?? existingEvent?.id ?? item.id;
        const seed = fromUnscheduled ?? existingEvent ?? item;

        const booked: SiteVisitCalendarItem = {
          ...seed,
          id,
          status: 'TENTATIVE',
          scheduledStart: startIso,
          scheduledEnd: endIso,
          salespersonId,
          notes: values.notes.trim() || null,
          customerNotified: false,
          lastNotifiedAt: seed.lastNotifiedAt ?? null,
          cancelReason: null,
          updatedAt: now,
        };
        applyOptimisticBooking({ base, fromUnscheduledId: fromUnscheduled?.id ?? null, booked });

        toast.success('Booked.');
        closeModal();
        await fetchFresh();
        return;
      }

      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(item.projectId)}/action/site-visit/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ siteVisitEventId: item.id, start: startIso, end: endIso, notifyCustomer: false, salespersonId }),
      });

      applyOptimisticReschedule(base, {
        ...item,
        scheduledStart: startIso,
        scheduledEnd: endIso,
        salespersonId,
        updatedAt: new Date().toISOString(),
      });

      toast.success('Booking updated.');
      closeModal();
      await fetchFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save site visit.';
      const extra =
        err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in (err.body as any) ? String((err.body as any).error) : '';
      setActionError(extra && extra !== msg ? `${msg}\n${extra}` : msg);
      toast.error(msg);
    }
  };

  const assignSalesperson = async (item: SiteVisitCalendarItem, salespersonIdRaw: string) => {
    try {
      setActionError(null);
      const salespersonId = salespersonIdRaw.trim();
      if (!salespersonId) {
        toast.error('Salesperson is required.');
        return;
      }
      if (!laneIds.includes(salespersonId)) {
        toast.error('Invalid salesperson.');
        return;
      }

      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(item.projectId)}/action/site-visit/assign`, {
        method: 'POST',
        body: JSON.stringify({ siteVisitEventId: item.id, salespersonId }),
      });

      const base = snapshot;
      if (base) {
        setAndCacheSnapshot({
          ...base,
          events: (base.events ?? []).map((e) => (e.id === item.id ? { ...e, salespersonId } : e)),
        });
      }

      toast.success('Assigned.');
      setAssigning(null);
      await fetchFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to assign salesperson.';
      const extra =
        err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in (err.body as any) ? String((err.body as any).error) : '';
      setActionError(extra && extra !== msg ? `${msg}\n${extra}` : msg);
      toast.error(msg);
    }
  };

  const unscheduleSiteVisit = async (item: SiteVisitCalendarItem) => {
    try {
      setActionError(null);

      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(item.projectId)}/action/site-visit/unschedule`, {
        method: 'POST',
        body: JSON.stringify({ siteVisitEventId: item.id }),
      });

      const base = snapshot;
      if (base) {
        const now = new Date().toISOString();
        const moved: SiteVisitCalendarItem = {
          ...item,
          status: 'UNSCHEDULED',
          scheduledStart: null,
          scheduledEnd: null,
          salespersonId: null,
          updatedAt: now,
        };

        setAndCacheSnapshot({
          ...base,
          events: (base.events ?? []).filter((e) => e.id !== item.id),
          unscheduled: [...(base.unscheduled ?? []).filter((u) => u.id !== item.id), moved],
        });
      }

      toast.success('Unscheduled.');
      await fetchFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to unschedule site visit.';
      const extra =
        err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in (err.body as any) ? String((err.body as any).error) : '';
      setActionError(extra && extra !== msg ? `${msg}\n${extra}` : msg);
      toast.error(msg);
      throw err;
    }
  };

  if (!mounted) {
    return (
      <section className={styles.siteVisitsShell} aria-label="Site visits calendar">
        <div className={styles.siteVisitsTopBar}>
          <div className={styles.siteVisitsControls}>
            <span className={styles.muted} style={{ alignSelf: 'center' }}>
              Loading site visits…
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.siteVisitsShell}
      aria-label="Site visits calendar"
      style={{
        ['--site-visits-lane-count' as any]: laneIds.length,
        ['--site-visits-slot-h' as any]: `${SLOT_HEIGHT_PX}px`,
        ['--site-visits-hour-h' as any]: `${HOUR_HEIGHT_PX}px`,
      }}
    >
      <div className={styles.siteVisitsTopBar}>
        <div className={styles.siteVisitsControls}>
          <button type="button" className={styles.buttonSecondary} onClick={() => openWeek(addDaysLocal(viewWeek, -7))}>
            ← Prev
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={() => openWeek(startOfWeekMonday(toYmdLocal(new Date())))}>
            This week
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={() => openWeek(addDaysLocal(viewWeek, 7))}>
            Next →
          </button>
          <span className={styles.muted} style={{ alignSelf: 'center' }}>
            Week of {fmtDayLabel(viewWeek)}
          </span>
        </div>

        <div className={styles.siteVisitsControls}>
          <label className={styles.muted} style={{ alignSelf: 'center' }}>
            Sales:
          </label>
          <select
            value={salesOwnerId ?? ''}
            onChange={(e) => setSalesOwner(e.target.value.trim() || null)}
            className={styles.siteVisitsSelect}
          >
            <option value="">All</option>
            {salesPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className={styles.muted} style={{ alignSelf: 'center' }}>
            {syncing ? 'Syncing…' : data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleTimeString('en-NZ')}` : ''}
          </span>
        </div>
      </div>

      <div className={styles.siteVisitsContent}>
        <div className={styles.siteVisitsPanels}>
          <aside className={styles.siteVisitsQueue} aria-label="Unscheduled site visits">
            <div className={styles.siteVisitsQueueHeader}>
              <div>
                <div className={styles.siteVisitsQueueTitle}>Unscheduled site visits</div>
                <div className={styles.muted}>{unscheduledFiltered.length} waiting</div>
              </div>
            </div>
            <div className={styles.siteVisitsQueueSearchRow}>
              <div className={styles.siteVisitsQueueSearch}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className={styles.siteVisitsSearchInput}
                />
              </div>
            </div>

            <div className={styles.siteVisitsQueueBody}>
              {orphanEventCandidates.length ? (
                <div className={styles.issues}>
                  <div className={styles.issuesHeader}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <strong style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Issues</strong>
                      <span className={styles.muted} style={{ fontSize: 12 }}>
                        {orphanEventCandidates.length} site visit record{orphanEventCandidates.length === 1 ? '' : 's'} missing project details
                      </span>
                    </div>
                    <button type="button" className={styles.buttonSecondary} onClick={() => void removeOrphans()}>
                      Remove orphaned
                    </button>
                  </div>
                  <div className={styles.issuesBody}>
                    <p className={styles.muted} style={{ margin: 0, fontSize: 12 }}>
                      These are not shown on the calendar. This usually means a `site_visit_events` row references a project that no longer exists.
                    </p>
                  </div>
                </div>
              ) : null}
              {needsAssignmentEvents.length ? (
                <div className={styles.issues}>
                  <div className={styles.issuesHeader}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <strong style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Needs assignment</strong>
                      <span className={styles.muted} style={{ fontSize: 12 }}>
                        {needsAssignmentEvents.length} scheduled site visit{needsAssignmentEvents.length === 1 ? '' : 's'} missing salesperson
                      </span>
                    </div>
                  </div>
                  <div className={styles.issuesBody}>
                    <ul className={styles.issueList}>
                      {needsAssignmentEvents.map((item) => (
                        <li key={item.id} className={styles.issueItem} style={{ justifyContent: 'space-between' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800 }}>
                              {(item.project.name || '').trim() || item.projectId || 'Untitled project'}
                            </div>
                            <div className={styles.muted} style={{ fontSize: 12 }}>
                              {item.scheduledStart ? new Date(item.scheduledStart).toLocaleString('en-NZ') : '—'}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => setAssigning({ item, salespersonId: defaultSalespersonId })}
                          >
                            Assign…
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
              {unscheduledSorted.length ? (
                unscheduledSorted.map((item) => (
                  <UnscheduledSiteVisitCard
                    key={item.id}
                    item={item}
                    onBook={() => openCreateModal({ initialLinkValue: item.id })}
                  />
                ))
              ) : (
                <p className={styles.muted} style={{ margin: 0 }}>
                  No unscheduled site visits.
                </p>
              )}
            </div>
          </aside>

          <main className={styles.siteVisitsCalendar} aria-label="Site visits week calendar">
            {actionError ? (
              <div style={{ padding: 10, borderBottom: '1px solid rgba(15,15,16,0.08)', background: 'rgba(185,28,28,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Booking error</strong>
                  <button type="button" className={styles.buttonSecondary} onClick={() => setActionError(null)}>
                    Dismiss
                  </button>
                </div>
                <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                  {actionError}
                </pre>
              </div>
            ) : null}
            <div
              className={styles.siteVisitsCalendarScroll}
              ref={calendarScrollRef}
              onScroll={() => {
                setSlotPopover(null);
                setHoveredEvent(null);
              }}
            >
              <div className={styles.siteVisitsCalendarHeader}>
                <div className={styles.siteVisitsTimeHeader} />
                {days.map((day) => (
                  <div key={day} className={styles.siteVisitsDayHeader}>
                    <div className={styles.siteVisitsDayTitle}>{fmtDayLabel(day)}</div>
                    <div className={styles.siteVisitsLaneHeaderRow}>
                      {salesPeople.map((p) => (
                        <div key={`${day}:${p.id}`} className={styles.siteVisitsLaneHeaderCell}>
                          {p.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.siteVisitsCalendarBody}>
                <div className={styles.siteVisitsTimeColumn}>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className={`${styles.siteVisitsTimeCell} ${isWorkingHour(hour) ? '' : styles.siteVisitsTimeCellOffHours}`}
                      style={{ height: HOUR_HEIGHT_PX }}
                    >
                      {formatTimeLabel(hour)}
                    </div>
                  ))}
                </div>

                {days.map((day) => (
                  <div key={day} className={styles.siteVisitsDayColumn}>
                    <div className={styles.siteVisitsLaneGrid}>
                      {laneIds.map((laneId) => (
                        <div key={`${day}:${laneId}`} className={styles.siteVisitsLaneColumn}>
                          {slotIndices.map((slotIdx) => {
                            const slotHour = Math.floor((slotIdx * MINUTES_STEP) / 60) + DAY_START_HOUR;
                            const timeLabel = hmFromMinutes(DAY_START_MINUTES + slotIdx * MINUTES_STEP);
                            return (
                              <button
                                key={slotIdx}
                                type="button"
                                className={`${styles.siteVisitSlot} ${isWorkingHour(slotHour) ? '' : styles.siteVisitSlotOffHours}`}
                                onClick={(e) => {
                                  openSlotPopover({ day, laneId, slotIdx, rect: e.currentTarget.getBoundingClientRect() });
                                }}
                                aria-label={`Book ${day} ${timeLabel}`}
                                title={`${fmtDayLabel(day)} ${timeLabel}`}
                              />
                            );
                          })}

                          <div className={styles.siteVisitsLaneEvents} style={{ height: slotCount() * SLOT_HEIGHT_PX }}>
                            {(eventsByLaneDay.get(`${day}::${laneId}`) ?? []).map((item) => {
                              if (!item.scheduledStart) return null;
                              const mins = clamp(minutesSinceStart(item.scheduledStart), 0, DAY_MINUTES);
                              const top = (mins / MINUTES_STEP) * SLOT_HEIGHT_PX;
                              const endIso = item.scheduledEnd ?? addMinutesIso(item.scheduledStart, 60);
                              const durMins = clamp(minutesSinceStart(endIso) - minutesSinceStart(item.scheduledStart), MINUTES_STEP, DAY_MINUTES);
                              const height = (durMins / MINUTES_STEP) * SLOT_HEIGHT_PX;

                              const isHighlighted = highlightId === item.id;

                              return (
                                <div
                                  key={item.id}
                                  className={isHighlighted ? styles.siteVisitEventHighlight : undefined}
                                  style={{ position: 'absolute', left: 4, right: 4, top, height }}
                                >
                                  <SiteVisitEvent
                                    item={item}
                                    onClick={() => {
                                      setHoveredEvent(null);
                                      openEditModal(item);
                                      highlight(item.id);
                                    }}
                                    onHover={(it, rect) => setHoveredEvent({ item: it, anchorRect: rect })}
                                    onUnhover={() => setHoveredEvent(null)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>

        {slotPopover ? (
          <SlotSelectPopover
            open
            anchorRect={slotPopover.anchorRect}
            unscheduledCount={unscheduled.length}
            label={slotLabel}
            onClose={() => setSlotPopover(null)}
            onBookUnscheduled={() => {
              if (!slotPreset) return;
              openCreateModal({ preset: slotPreset, focusLinked: true });
            }}
            onCreateNoProject={() => {
              if (!slotPreset) return;
              openCreateModal({ preset: slotPreset, initialLinkValue: LINK_NONE });
            }}
          />
        ) : null}

        {hoveredEvent ? (
          <SiteVisitHoverPopover open anchorRect={hoveredEvent.anchorRect} item={hoveredEvent.item} salesPeople={salesPeople} />
        ) : null}

      <SiteVisitEventModal
        open={modal.kind !== 'closed'}
        mode={modal.kind === 'edit' ? 'edit' : 'create'}
        item={modal.kind === 'edit' ? modal.item : null}
        unscheduled={unscheduled}
        preset={modal.kind === 'closed' ? undefined : modal.preset}
        salesPeople={salesPeople}
        defaultSalespersonId={defaultSalespersonId}
        initialLinkValue={modal.kind === 'create' ? modal.initialLinkValue : undefined}
        focusLinked={modal.kind === 'create' ? modal.focusLinked : undefined}
        onClose={closeModal}
        onSave={handleModalSave}
        onUnschedule={
          modal.kind === 'edit' && modal.item && !isLocalItem(modal.item) && modal.item.scheduledStart
            ? () => unscheduleSiteVisit(modal.item)
            : undefined
        }
      />

      {assigning ? (
        <Modal open ariaLabel="Assign salesperson" onClose={() => setAssigning(null)} maxWidthPx={560}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Assign</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setAssigning(null)}>
                Close
              </button>
            </div>

            <p className={styles.hint} style={{ marginTop: 10 }}>
              Project: <strong>{(assigning.item.project.name || '').trim() || assigning.item.projectId || 'Untitled project'}</strong>
            </p>
            <p className={styles.muted} style={{ marginTop: 8, marginBottom: 0 }}>
              Scheduled: {assigning.item.scheduledStart ? new Date(assigning.item.scheduledStart).toLocaleString('en-NZ') : '—'}
            </p>

            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Salesperson</label>
              <select
                className={styles.input}
                value={assigning.salespersonId}
                onChange={(e) => setAssigning((p) => (p ? { ...p, salespersonId: e.target.value } : p))}
              >
                {salesPeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.actions} style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setAssigning(null)}>
                Cancel
              </button>
              <button type="button" className={styles.buttonSecondary} onClick={() => void assignSalesperson(assigning.item, assigning.salespersonId)}>
                Assign
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

    </section>
  );
}
