'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { DndContext, PointerSensor, useDroppable, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import styles from './schedule.module.css';
import type { SiteVisitCalendarItem, SiteVisitsSnapshotV1 } from '@/lib/types/siteVisits';
import { siteVisitsSnapshotSWRKey } from '@/lib/cache/siteVisitsCache';
import { apiJson } from '@/lib/repo/apiClient';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import Modal from '@/components/ui/modal/Modal';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { ApiError } from '@/lib/repo/apiClient';
import { SALES_PEOPLE } from '@/src/config/salesPeople';

const SLOT_MINUTES = 30;
const SLOT_PX = 22;
const START_HOUR = 8;
const END_HOUR = 18;

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
  return Math.ceil(((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES);
}

function slotStartIso(ymd: string, slotIdx: number): string {
  const base = toLocalDateFromYmd(ymd) ?? new Date();
  const mins = START_HOUR * 60 + slotIdx * SLOT_MINUTES;
  const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  dt.setMinutes(mins);
  return dt.toISOString();
}

function addMinutesIso(iso: string, minutes: number): string {
  const dt = new Date(iso);
  dt.setMinutes(dt.getMinutes() + minutes);
  return dt.toISOString();
}

function formatTimeLabel(slotIdx: number): string {
  const mins = START_HOUR * 60 + slotIdx * SLOT_MINUTES;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' });
  return label;
}

function fmtDayLabel(ymd: string): string {
  const dt = toLocalDateFromYmd(ymd);
  if (!dt) return ymd;
  return new Intl.DateTimeFormat('en-NZ', { weekday: 'short', day: '2-digit', month: 'short' }).format(dt);
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

function toLocalDayKey(iso: string | null): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return null;
  return toYmdLocal(dt);
}

function minutesSinceStart(iso: string): number {
  const dt = new Date(iso);
  const start = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), START_HOUR, 0, 0, 0);
  return Math.round((dt.getTime() - start.getTime()) / 60000);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function DraggableCard({ item, onBook }: { item: SiteVisitCalendarItem; onBook: () => void }) {
  const id = `unscheduled:${item.id}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { kind: 'unscheduled', itemId: item.id },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.6 : 1 } : undefined;
  const title = (item.project.name || '').trim() || item.projectId || 'Untitled project';

  return (
    <div ref={setNodeRef} className={styles.siteVisitCard} style={style}>
      <div
        ref={setActivatorNodeRef}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
        {...attributes}
        {...listeners}
      >
        <div className={styles.siteVisitCardTitle}>{title}</div>
        <div className={styles.muted} style={{ fontSize: 12, cursor: 'grab', userSelect: 'none' }}>
          Drag
        </div>
      </div>
      <div className={styles.siteVisitCardMeta}>
        <span className={styles.muted}>{item.project.region || '—'}</span>
        {item.project.siteAddress ? <span className={styles.muted}> · {item.project.siteAddress}</span> : null}
      </div>
      <div className={styles.siteVisitCardMeta} style={{ marginTop: 6 }}>
        <span className={styles.muted}>{item.contact.name || '—'}</span>
        {item.contact.phone ? <span className={styles.muted}> · {item.contact.phone}</span> : null}
      </div>
      <div className={styles.siteVisitCardMeta} style={{ marginTop: 6 }}>
        {(() => {
          const created = item.createdAt ? new Date(item.createdAt) : null;
          const ageDays = created && Number.isFinite(created.getTime()) ? Math.floor((Date.now() - created.getTime()) / 86400000) : null;
          const label = typeof ageDays === 'number' && ageDays >= 0 ? `${ageDays}d waiting` : '—';
          return <span className={styles.muted}>Waiting {label}</span>;
        })()}
      </div>
      <div className={styles.siteVisitCardActions}>
        <button
          type="button"
          className={styles.buttonSecondary}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onBook();
          }}
        >
          Book…
        </button>
      </div>
    </div>
  );
}

function DroppableSlot({ id, children }: { id: string; children?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver ? styles.siteVisitSlotOver : styles.siteVisitSlot}>
      {children}
    </div>
  );
}

function DraggableEvent({ item, onClick }: { item: SiteVisitCalendarItem; onClick: () => void }) {
  const id = `event:${item.id}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { kind: 'event', itemId: item.id },
  });

  const style = transform
    ? { position: 'relative' as const, transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.65 : 1 }
    : { position: 'relative' as const, opacity: isDragging ? 0.65 : 1 };

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`${styles.siteVisitEvent} ${eventStatusClass(item.status)}`}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onPointerDownCapture={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          width: 12,
          height: 12,
          borderRadius: 6,
          background: 'rgba(255,255,255,0.35)',
          cursor: 'grab',
        }}
        aria-hidden
      />
      <div className={styles.siteVisitEventTitle}>{(item.project.name || '').trim() || item.projectId || 'Untitled'}</div>
      <div className={styles.siteVisitEventSub}>{item.project.siteAddress || item.project.region || '—'}</div>
    </button>
  );
}

type BookingDraft = {
  projectId: string;
  projectName: string;
  salespersonId: string;
  startIso: string;
  durationMins: number;
  notes: string;
  tentative: boolean;
};

function toLocalHm(iso: string): string | null {
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return null;
  const h = String(dt.getHours()).padStart(2, '0');
  const m = String(dt.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

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

export default function SiteVisitsView() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()), []);
  const snapshotKey = useMemo(() => siteVisitsSnapshotSWRKey(), []);
  const { data: cachedSnapshot, mutate: mutateSnapshot } = useSWR<SiteVisitsSnapshotV1>(snapshotKey, null);

  useEffect(() => setMounted(true), []);

  const viewWeek = useMemo(() => {
    const raw = (searchParams.get('week') || '').trim();
    const today = toYmdLocal(new Date());
    return startOfWeekMonday(raw || today);
  }, [searchParams]);

  const salesOwnerIdRaw = useMemo(() => (searchParams.get('salesOwnerId') || '').trim() || null, [searchParams]);
  const highlightId = useMemo(() => (searchParams.get('highlightSiteVisitId') || '').trim() || null, [searchParams]);

  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [snapshot, setSnapshot] = useState<SiteVisitsSnapshotV1 | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [booking, setBooking] = useState<BookingDraft | null>(null);
  const [assigning, setAssigning] = useState<{ item: SiteVisitCalendarItem; salespersonId: string } | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState<
    null | { item: SiteVisitCalendarItem; nextStart: string; nextEnd: string; nextSalespersonId: string; notify: boolean }
  >(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysLocal(viewWeek, i)), [viewWeek]);

  const slotIndices = useMemo(() => Array.from({ length: slotCount() }, (_, i) => i), []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Sales lanes are authoritative from config (Steve/Bruce), not from cached snapshots.
  // This avoids stale lane headers/IDs breaking drag+drop and salesperson assignment.
  const salesPeople = useMemo(() => SALES_PEOPLE, []);

  const laneIds = useMemo(() => salesPeople.map((p) => p.id), [salesPeople]);
  const salesOwnerId = useMemo(() => (salesOwnerIdRaw && laneIds.includes(salesOwnerIdRaw) ? salesOwnerIdRaw : null), [laneIds, salesOwnerIdRaw]);
  const defaultSalespersonId = useMemo(() => salesOwnerId ?? laneIds[0] ?? '', [laneIds, salesOwnerId]);

  useEffect(() => {
    if (snapshot) return;
    if (cachedSnapshot) setSnapshot(cachedSnapshot);
  }, [cachedSnapshot, snapshot]);

  const fetchFresh = async () => {
    const from = new Date(slotStartIso(days[0], 0)).toISOString();
    const to = new Date(addMinutesIso(slotStartIso(days[6], slotCount() - 1), SLOT_MINUTES)).toISOString();

    const qs = new URLSearchParams();
    qs.set('from', from);
    qs.set('to', to);
    if (salesOwnerId) qs.set('salesOwnerId', salesOwnerId);

    setSyncing(true);
    try {
      const res = await apiJson<{ unscheduled: SiteVisitCalendarItem[]; events: SiteVisitCalendarItem[]; salesPeople: any[]; generatedAt: string }>(
        `/api/staff/v1/site-visits?${qs.toString()}`,
      );
      const next: SiteVisitsSnapshotV1 = {
        host: host ?? null,
        rangeFrom: from,
        rangeTo: to,
        salesOwnerId,
        generatedAt: res.generatedAt,
        unscheduled: res.unscheduled,
        events: res.events,
        salesPeople: res.salesPeople,
      };
      setSnapshot(next);
      await mutateSnapshot(next, { revalidate: false });
      setSyncing(false);
    } catch (err) {
      setSyncing(false);
      if (snapshot?.unscheduled?.length || snapshot?.events?.length || cachedSnapshot?.unscheduled?.length || cachedSnapshot?.events?.length) {
        toast.error("Couldn't refresh site visits (showing last saved).");
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to load site visits.';
      toast.error(msg);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    void fetchFresh();
  }, [mounted, viewWeek, salesOwnerId]);

  const data = snapshot ?? cachedSnapshot;
  const unscheduled = data?.unscheduled ?? [];
  const events = data?.events ?? [];

  const orphanEventCandidates = useMemo(() => events.filter((ev) => !(ev.project.name || '').trim()), [events]);
  const renderableEvents = useMemo(() => events.filter((ev) => (ev.project.name || '').trim()), [events]);
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
    setSnapshot(next);
    void mutateSnapshot(next, { revalidate: false });
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

  const activeEvent = useMemo(() => (activeEventId ? events.find((e) => e.id === activeEventId) ?? null : null), [activeEventId, events]);

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

  const bookFromDraft = async (draft: BookingDraft) => {
    try {
      setActionError(null);
      const salespersonId = draft.salespersonId.trim();
      if (!salespersonId) {
        toast.error('Salesperson is required.');
        return;
      }
      if (!laneIds.includes(salespersonId)) {
        toast.error('Invalid salesperson.');
        return;
      }
      const endIso = addMinutesIso(draft.startIso, draft.durationMins);
      const body = {
        start: draft.startIso,
        end: endIso,
        salespersonId,
        tentative: draft.tentative,
        notes: draft.notes,
      };

      const res = await apiJson<any>(`/api/staff/v1/projects/${encodeURIComponent(draft.projectId)}/action/site-visit/book`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const base = snapshot ?? cachedSnapshot;
      if (base) {
        const now = new Date().toISOString();
        const returnedId = typeof res?.siteVisitEventId === 'string' && res.siteVisitEventId.trim() ? res.siteVisitEventId.trim() : null;
        const fromUnscheduled = (base.unscheduled ?? []).find((u) => u.projectId === draft.projectId) ?? null;
        const existingEvent = (base.events ?? []).find((e) => e.projectId === draft.projectId) ?? null;
        const id = returnedId ?? fromUnscheduled?.id ?? existingEvent?.id ?? null;
        if (id) {
          const seed = fromUnscheduled ?? existingEvent;
          const booked: SiteVisitCalendarItem = {
            ...(seed as any),
            id,
            projectId: draft.projectId,
            status: draft.tentative ? 'TENTATIVE' : 'CONFIRMED',
            scheduledStart: draft.startIso,
            scheduledEnd: endIso,
            salespersonId: body.salespersonId,
            notes: body.notes || null,
            customerNotified: !draft.tentative,
            lastNotifiedAt: !draft.tentative ? now : seed?.lastNotifiedAt ?? null,
            cancelReason: null,
            updatedAt: now,
            createdAt: seed?.createdAt ?? now,
            project: seed?.project ?? { id: draft.projectId, name: draft.projectName, region: null, siteAddress: null, pipelineStage: 'SITE_VISIT' },
            contact: seed?.contact ?? { id: null, name: null, email: null, phone: null },
          };
          applyOptimisticBooking({ base, fromUnscheduledId: fromUnscheduled?.id ?? null, booked });
        }
      }

      toast.success('Booked.');
      setBooking(null);
      await fetchFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to book site visit.';
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

      const base = snapshot ?? cachedSnapshot;
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

  const confirmBooking = async (item: SiteVisitCalendarItem) => {
    try {
      setActionError(null);
      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(item.projectId)}/action/site-visit/confirm`, {
        method: 'POST',
        body: JSON.stringify({ siteVisitEventId: item.id }),
      });
      toast.success('Booking confirmed.');
      setActiveEventId(null);
      highlight(null);
      await fetchFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm booking.';
      const extra =
        err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in (err.body as any) ? String((err.body as any).error) : '';
      setActionError(extra && extra !== msg ? `${msg}\n${extra}` : msg);
      toast.error(msg);
    }
  };

  const cancelBooking = async (item: SiteVisitCalendarItem, notifyCustomer: boolean, reason: string) => {
    try {
      setActionError(null);
      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(item.projectId)}/action/site-visit/cancel`, {
        method: 'POST',
        body: JSON.stringify({ siteVisitEventId: item.id, notifyCustomer, reason }),
      });
      toast.success('Booking cancelled.');
      setActiveEventId(null);
      highlight(null);
      await fetchFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel booking.';
      const extra =
        err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in (err.body as any) ? String((err.body as any).error) : '';
      setActionError(extra && extra !== msg ? `${msg}\n${extra}` : msg);
      toast.error(msg);
    }
  };

  const rescheduleBooking = async (
    item: SiteVisitCalendarItem,
    startIso: string,
    endIso: string,
    notifyCustomer: boolean,
    salespersonIdRaw?: string,
  ) => {
    try {
      setActionError(null);
      const salespersonId = typeof salespersonIdRaw === 'string' ? salespersonIdRaw.trim() : '';
      if (salespersonId && !laneIds.includes(salespersonId)) {
        toast.error('Invalid salesperson.');
        return;
      }
      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(item.projectId)}/action/site-visit/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ siteVisitEventId: item.id, start: startIso, end: endIso, notifyCustomer, ...(salespersonId ? { salespersonId } : {}) }),
      });
      toast.success('Booking updated.');
      setConfirmMove(null);
      setActiveEventId(null);
      highlight(null);
      await fetchFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reschedule booking.';
      const extra =
        err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in (err.body as any) ? String((err.body as any).error) : '';
      setActionError(extra && extra !== msg ? `${msg}\n${extra}` : msg);
      toast.error(msg);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (!overId) return;

    const overMatch = overId.match(/^slot:(\d{4}-\d{2}-\d{2})::([^:]+)::(\d+)$/);
    if (!overMatch) return;

    const day = overMatch[1];
    const lane = overMatch[2];
    const slotIdx = Number(overMatch[3]);
    if (!laneIds.includes(lane)) return;
    const startIso = slotStartIso(day, clamp(slotIdx, 0, slotCount() - 1));

    if (activeId.startsWith('unscheduled:')) {
      const itemId = activeId.slice('unscheduled:'.length);
      const item = unscheduled.find((u) => u.id === itemId) ?? null;
      if (!item) return;
      void (async () => {
        try {
          setActionError(null);
          const res = await apiJson<{ ok: boolean; siteVisitEventId: string | null }>(`/api/staff/v1/projects/${encodeURIComponent(item.projectId)}/action/site-visit/book`, {
            method: 'POST',
            body: JSON.stringify({
              start: startIso,
              end: addMinutesIso(startIso, 60),
              salespersonId: lane,
              tentative: true,
              notes: '',
            }),
          });

          const base = snapshot ?? cachedSnapshot;
          if (base) {
            const now = new Date().toISOString();
            const booked: SiteVisitCalendarItem = {
              ...item,
              id: res?.siteVisitEventId || item.id,
              status: 'TENTATIVE',
              scheduledStart: startIso,
              scheduledEnd: addMinutesIso(startIso, 60),
              salespersonId: lane,
              notes: null,
              updatedAt: now,
            };
            applyOptimisticBooking({ base, fromUnscheduledId: item.id, booked });
          }

          toast.success('Booked.');
          await fetchFresh();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to book site visit.';
          const extra =
            err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in (err.body as any)
              ? String((err.body as any).error)
              : '';
          setActionError(extra && extra !== msg ? `${msg}\n${extra}` : msg);
          toast.error(msg);
        }
      })();
      return;
    }

    if (activeId.startsWith('event:')) {
      const itemId = activeId.slice('event:'.length);
      const item = renderableEvents.find((e) => e.id === itemId) ?? null;
      if (!item) return;
      const endIso = addMinutesIso(startIso, 60);
      const nextSalespersonId = lane;

      const isConfirmed = String(item.status).toUpperCase() === 'CONFIRMED';
      if (!isConfirmed) {
        void rescheduleBooking(item, startIso, endIso, false, nextSalespersonId);
        return;
      }

      setConfirmMove({ item, nextStart: startIso, nextEnd: endIso, nextSalespersonId, notify: false });
      return;
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
      style={{ ['--site-visits-lane-count' as any]: laneIds.length }}
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

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className={styles.siteVisitsPanels}>
        <aside className={styles.siteVisitsQueue} aria-label="Unscheduled site visits">
          <div className={styles.siteVisitsQueueHeader}>
            <div>
              <div className={styles.siteVisitsQueueTitle}>Unscheduled site visits</div>
              <div className={styles.muted}>{unscheduledFiltered.length} waiting</div>
            </div>
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
            {unscheduledFiltered.length ? (
              unscheduledFiltered.map((item) => (
                <DraggableCard
                  key={item.id}
                  item={item}
                  onBook={() =>
                    setBooking({
                      projectId: item.projectId,
                      projectName: (item.project.name || '').trim() || item.projectId || 'Untitled project',
                      salespersonId: item.salespersonId && laneIds.includes(item.salespersonId) ? item.salespersonId : defaultSalespersonId,
                      startIso: new Date().toISOString(),
                      durationMins: 60,
                      notes: '',
                      tentative: true,
                    })
                  }
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
                {slotIndices.map((slotIdx) => (
                  <div key={slotIdx} className={styles.siteVisitsTimeCell} style={{ height: SLOT_PX }}>
                    {slotIdx % 2 === 0 ? formatTimeLabel(slotIdx) : ''}
                  </div>
                ))}
              </div>

              {days.map((day) => (
                <div key={day} className={styles.siteVisitsDayColumn}>
                  <div className={styles.siteVisitsLaneGrid}>
                    {laneIds.map((laneId) => (
                      <div key={`${day}:${laneId}`} className={styles.siteVisitsLaneColumn}>
                        {slotIndices.map((slotIdx) => (
                          <DroppableSlot key={slotIdx} id={`slot:${day}::${laneId}::${slotIdx}`} />
                        ))}

                        <div className={styles.siteVisitsLaneEvents} style={{ height: slotCount() * SLOT_PX }}>
                          {(eventsByLaneDay.get(`${day}::${laneId}`) ?? []).map((item) => {
                            if (!item.scheduledStart) return null;
                            const mins = clamp(minutesSinceStart(item.scheduledStart), 0, (END_HOUR - START_HOUR) * 60);
                            const top = (mins / SLOT_MINUTES) * SLOT_PX;
                            const endIso = item.scheduledEnd ?? addMinutesIso(item.scheduledStart, 60);
                            const durMins = clamp(minutesSinceStart(endIso) - minutesSinceStart(item.scheduledStart), SLOT_MINUTES, (END_HOUR - START_HOUR) * 60);
                            const height = (durMins / SLOT_MINUTES) * SLOT_PX;

                            const isHighlighted = highlightId === item.id;

                            return (
                              <div
                                key={item.id}
                                className={isHighlighted ? styles.siteVisitEventHighlight : undefined}
                                style={{ position: 'absolute', left: 4, right: 4, top, height }}
                              >
                                <DraggableEvent
                                  item={item}
                                  onClick={() => {
                                    setActiveEventId(item.id);
                                    highlight(item.id);
                                  }}
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
        </main>
      </div>
      </DndContext>

      {booking ? (
        <Modal
          open
          ariaLabel="Book site visit"
          onClose={() => setBooking(null)}
          maxWidthPx={620}
        >
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Book site visit</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setBooking(null)}>
                Close
              </button>
            </div>

            <p className={styles.hint} style={{ marginTop: 10 }}>
              Project: <strong>{booking.projectName}</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Salesperson</label>
                <select
                  className={styles.input}
                  value={booking.salespersonId}
                  onChange={(e) => setBooking((p) => (p ? { ...p, salespersonId: e.target.value } : p))}
                >
                  {salesPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Date</label>
                <input
                  type="date"
                  className={styles.input}
                  value={toLocalDayKey(booking.startIso) ?? ''}
                  onChange={(e) => {
                    const nextYmd = e.target.value;
                    setBooking((p) => {
                      if (!p) return p;
                      const hm = toLocalHm(p.startIso) ?? `${String(START_HOUR).padStart(2, '0')}:00`;
                      const nextIso = isoFromLocalInputs(nextYmd, hm);
                      if (!nextIso) return p;
                      return { ...p, startIso: nextIso };
                    });
                  }}
                />
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Time</label>
                <input
                  type="time"
                  step={SLOT_MINUTES * 60}
                  className={styles.input}
                  value={toLocalHm(booking.startIso) ?? ''}
                  onChange={(e) => {
                    const nextHm = e.target.value;
                    setBooking((p) => {
                      if (!p) return p;
                      const ymd = toLocalDayKey(p.startIso) ?? toYmdLocal(new Date());
                      const nextIso = isoFromLocalInputs(ymd, nextHm);
                      if (!nextIso) return p;
                      return { ...p, startIso: nextIso };
                    });
                  }}
                />
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Duration</label>
                <select
                  className={styles.input}
                  value={String(booking.durationMins)}
                  onChange={(e) => setBooking((p) => (p ? { ...p, durationMins: Number(e.target.value) } : p))}
                >
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Notes</label>
                <textarea
                  className={styles.input}
                  value={booking.notes}
                  onChange={(e) => setBooking((p) => (p ? { ...p, notes: e.target.value } : p))}
                  rows={3}
                />
              </div>
            </div>

            <div className={styles.actions} style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => void bookFromDraft({ ...booking, tentative: true })}>
                Save tentative
              </button>
              <button type="button" className={styles.buttonSecondary} onClick={() => void bookFromDraft({ ...booking, tentative: false })}>
                Save &amp; confirm
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

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

      {activeEvent ? (
        <Modal
          open
          ariaLabel="Site visit details"
          onClose={() => {
            setActiveEventId(null);
            highlight(null);
          }}
          maxWidthPx={680}
        >
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Site visit</h2>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  setActiveEventId(null);
                  highlight(null);
                }}
              >
                Close
              </button>
            </div>

            <p className={styles.hint} style={{ marginTop: 10 }}>
              <strong>{activeEvent.project.name || 'Untitled project'}</strong> · {String(activeEvent.status).toUpperCase()}
            </p>
            <p className={styles.muted} style={{ marginTop: 8, marginBottom: 0 }}>
              {activeEvent.scheduledStart ? new Date(activeEvent.scheduledStart).toLocaleString('en-NZ') : '—'} →{' '}
              {activeEvent.scheduledEnd ? new Date(activeEvent.scheduledEnd).toLocaleString('en-NZ') : '—'}
            </p>

            <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => router.push(`/staff/projects/${encodeURIComponent(activeEvent.projectId)}`)}>
                Open project
              </button>
              {String(activeEvent.status).toUpperCase() === 'TENTATIVE' ? (
                <button type="button" className={styles.buttonSecondary} onClick={() => void confirmBooking(activeEvent)}>
                  Confirm booking
                </button>
              ) : null}
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  if (!activeEvent.scheduledStart) return;
                  setBooking({
                    projectId: activeEvent.projectId,
                    projectName: activeEvent.project.name || 'Untitled project',
                    salespersonId:
                      activeEvent.salespersonId && laneIds.includes(activeEvent.salespersonId) ? activeEvent.salespersonId : defaultSalespersonId,
                    startIso: activeEvent.scheduledStart,
                    durationMins: 60,
                    notes: activeEvent.notes ?? '',
                    tentative: String(activeEvent.status).toUpperCase() !== 'CONFIRMED',
                  });
                }}
              >
                Reschedule…
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  if (typeof window === 'undefined') return;
                  const notify = window.confirm('Notify customer? OK = Yes, Cancel = No');
                  const reason = window.prompt('Cancel reason (optional):', '') ?? '';
                  void cancelBooking(activeEvent, notify, reason);
                }}
              >
                Cancel…
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {confirmMove ? (
        <Modal
          open
          ariaLabel="Reschedule confirmed site visit"
          onClose={() => setConfirmMove(null)}
          maxWidthPx={560}
        >
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Reschedule</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setConfirmMove(null)}>
                Close
              </button>
            </div>
            <p className={styles.hint} style={{ marginTop: 10 }}>
              <strong>{confirmMove.item.project.name}</strong>
            </p>
            <p className={styles.muted} style={{ marginTop: 8, marginBottom: 0 }}>
              New time: {new Date(confirmMove.nextStart).toLocaleString('en-NZ')}
            </p>
            <div className={styles.actions} style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => void rescheduleBooking(confirmMove.item, confirmMove.nextStart, confirmMove.nextEnd, false, confirmMove.nextSalespersonId)}
              >
                Reschedule (internal)
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => void rescheduleBooking(confirmMove.item, confirmMove.nextStart, confirmMove.nextEnd, true, confirmMove.nextSalespersonId)}
              >
                Reschedule + notify
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
