'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import type { SiteVisitCalendarItem, SiteVisitCalendarPerson } from '@/lib/types/siteVisits';
import sharedStyles from '@/app/staff/schedule/schedule.module.css';
import modalStyles from './SiteVisitEventModal.module.css';
import { DEFAULT_DURATION_MINUTES, MINUTES_STEP, WORK_END_HOUR, WORK_START_HOUR } from '@/components/schedule/site-visits/siteVisits.constants';

const LINK_NONE = '__none__';
const styles = { ...sharedStyles, ...modalStyles };

export type SiteVisitEventFormValues = {
  linkMode: 'unscheduled' | 'none';
  linkedUnscheduledId: string | null;
  salespersonId: string;
  date: string;
  startTime: string;
  endTime: string;
  address: string;
  phone: string;
  notes: string;
};

type SiteVisitEventModalPreset = Partial<Pick<SiteVisitEventFormValues, 'salespersonId' | 'date' | 'startTime' | 'endTime'>>;

function toLocalDayKey(iso: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalHm(iso: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return '';
  const h = String(dt.getHours()).padStart(2, '0');
  const m = String(dt.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function toMinutes(hm: string): number | null {
  const match = hm.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToHm(totalMinutes: number): string {
  const clamped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutesToHm(hm: string, minutes: number): string {
  const base = toMinutes(hm);
  if (base == null) return hm;
  return minutesToHm(base + minutes);
}

function formatUnscheduledLabel(item: SiteVisitCalendarItem): string {
  const project = (item.project.name || '').trim() || item.projectId || 'Untitled project';
  const detail = (item.project.region || item.project.siteAddress || '').trim();
  return detail ? `${project} — ${detail}` : project;
}

export default function SiteVisitEventModal({
  open,
  mode,
  item,
  unscheduled,
  salesPeople,
  preset,
  defaultSalespersonId,
  initialLinkValue,
  focusLinked,
  onClose,
  onSave,
  onUnschedule,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  item: SiteVisitCalendarItem | null;
  unscheduled: SiteVisitCalendarItem[];
  salesPeople: readonly SiteVisitCalendarPerson[];
  preset?: SiteVisitEventModalPreset;
  defaultSalespersonId?: string;
  initialLinkValue?: string;
  focusLinked?: boolean;
  onClose: () => void;
  onSave: (values: SiteVisitEventFormValues) => Promise<void> | void;
  onUnschedule?: () => Promise<void> | void;
}) {
  const linkedSelectRef = useRef<HTMLSelectElement | null>(null);
  const [form, setForm] = useState<SiteVisitEventFormValues>({
    linkMode: 'unscheduled',
    linkedUnscheduledId: null,
    salespersonId: '',
    date: '',
    startTime: '',
    endTime: '',
    address: '',
    phone: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SiteVisitEventFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmUnschedule, setConfirmUnschedule] = useState(false);

  const timeOptions = useMemo(() => {
    const minMins = WORK_START_HOUR * 60;
    const maxMins = WORK_END_HOUR * 60;
    const opts: string[] = [];
    for (let mins = minMins; mins <= maxMins; mins += MINUTES_STEP) {
      opts.push(minutesToHm(mins));
    }
    return opts;
  }, [MINUTES_STEP, WORK_END_HOUR, WORK_START_HOUR]);

  const linkedLabel = useMemo(() => {
    if (!item) return '';
    if (item.id.startsWith('local:')) return 'No linked project';
    return formatUnscheduledLabel(item);
  }, [item]);
  const linkedContact = useMemo(() => {
    if (!item) return '';
    const contactBits = [item.contact.name, item.contact.phone].filter(Boolean);
    return contactBits.join(' · ');
  }, [item]);

  const isEditMode = mode === 'edit' && Boolean(item);
  const isLocalItem = Boolean(item?.id && item.id.startsWith('local:'));
  const isLinkedLocked = Boolean(isEditMode);
  const canUnschedule = Boolean(onUnschedule && isEditMode && item && !isLocalItem && item.scheduledStart);

  useEffect(() => {
    if (!open) return;

    const baseLinked = isEditMode ? null : initialLinkValue ?? '';
    const linkMode =
      baseLinked === LINK_NONE
        ? 'none'
        : baseLinked && baseLinked !== LINK_NONE
          ? 'unscheduled'
          : 'unscheduled';

    const baseStart = item?.scheduledStart ? toLocalHm(item.scheduledStart) : preset?.startTime ?? '';
    const baseEnd = item?.scheduledEnd ? toLocalHm(item.scheduledEnd) : preset?.endTime ?? (baseStart ? addMinutesToHm(baseStart, DEFAULT_DURATION_MINUTES) : '');
    const baseDate = item?.scheduledStart ? toLocalDayKey(item.scheduledStart) : preset?.date ?? '';
    const baseSalesperson =
      item?.salespersonId ?? preset?.salespersonId ?? (isEditMode ? defaultSalespersonId ?? '' : '');

    let address = item?.project?.siteAddress ?? '';
    let phone = item?.contact?.phone ?? '';
    let notes = item?.notes ?? '';

    if (!isEditMode && baseLinked && baseLinked !== LINK_NONE) {
      const linkedItem = unscheduled.find((u) => u.id === baseLinked) ?? null;
      if (linkedItem) {
        address = linkedItem.project.siteAddress ?? '';
        phone = linkedItem.contact.phone ?? '';
        notes = linkedItem.notes ?? '';
      }
    }

    setForm({
      linkMode,
      linkedUnscheduledId: !isEditMode && baseLinked && baseLinked !== LINK_NONE ? baseLinked : null,
      salespersonId: baseSalesperson ?? '',
      date: baseDate,
      startTime: baseStart,
      endTime: baseEnd,
      address,
      phone,
      notes,
    });
    setErrors({});
    setConfirmUnschedule(false);
  }, [defaultSalespersonId, initialLinkValue, isEditMode, item, open, preset, unscheduled]);

  useEffect(() => {
    if (!open || !focusLinked) return;
    const t = window.setTimeout(() => linkedSelectRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [focusLinked, open]);

  if (!open) return null;

  const linkedValue = isEditMode
    ? ''
    : form.linkMode === 'none'
      ? LINK_NONE
      : form.linkedUnscheduledId ?? '';

  const isLinkedProject = (!isLocalItem && isEditMode) || (form.linkMode === 'unscheduled' && Boolean(form.linkedUnscheduledId));

  const validate = (): Partial<Record<keyof SiteVisitEventFormValues, string>> => {
    const next: Partial<Record<keyof SiteVisitEventFormValues, string>> = {};

    if (!form.salespersonId.trim()) next.salespersonId = 'Salesperson is required.';
    if (!form.date.trim()) next.date = 'Date is required.';
    if (!form.startTime.trim()) next.startTime = 'Start time is required.';
    if (!form.endTime.trim()) next.endTime = 'End time is required.';

    const startMins = toMinutes(form.startTime);
    const endMins = toMinutes(form.endTime);
    const minMins = WORK_START_HOUR * 60;
    const maxMins = WORK_END_HOUR * 60;
    if (startMins != null && (startMins < minMins || startMins > maxMins)) {
      next.startTime = `Start time must be between ${minutesToHm(minMins)} and ${minutesToHm(maxMins)}.`;
    }
    if (endMins != null && (endMins < minMins || endMins > maxMins)) {
      next.endTime = `End time must be between ${minutesToHm(minMins)} and ${minutesToHm(maxMins)}.`;
    }
    if (startMins != null && endMins != null) {
      if (endMins <= startMins) {
        next.endTime = 'End time must be after start time.';
      }
    }

    if (!isEditMode) {
      if (linkedValue === '') {
        next.linkedUnscheduledId = 'Select a visit/project or choose no project.';
      }
    }

    return next;
  };

  const handleSave = async () => {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave({
        linkMode: linkedValue === LINK_NONE ? 'none' : 'unscheduled',
        linkedUnscheduledId: linkedValue && linkedValue !== LINK_NONE ? linkedValue : null,
        salespersonId: form.salespersonId.trim(),
        date: form.date.trim(),
        startTime: form.startTime.trim(),
        endTime: form.endTime.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnschedule = async () => {
    if (!onUnschedule || saving) return;
    setSaving(true);
    try {
      await onUnschedule();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const heading = mode === 'edit' && item?.scheduledStart ? 'Site visit' : 'New site visit';

  return (
    <Modal
      open={open}
      ariaLabel={heading}
      onClose={onClose}
      maxWidthPx={720}
      overlayClassName={styles.eventModalOverlay}
      panelClassName={styles.eventModalPanel}
    >
      <div className={styles.eventModalHeader}>
        <div className={styles.eventModalActions}>
          {canUnschedule ? (
            <button type="button" className={styles.buttonDanger} onClick={() => setConfirmUnschedule(true)} disabled={saving || confirmUnschedule}>
              Unschedule
            </button>
          ) : null}
          <button type="button" className={styles.buttonPrimary} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={onClose} disabled={saving}>
            Discard
          </button>
        </div>
        <div>
          <div className={styles.eventModalTitle}>{heading}</div>
          {isEditMode && linkedContact ? <div className={styles.eventModalSubtitle}>{linkedContact}</div> : null}
        </div>
      </div>

      {confirmUnschedule ? (
        <div className={styles.eventModalConfirmation}>
          <AlertBanner
            tone="blocking"
            title="Unschedule this site visit?"
            action={
              <div className={styles.eventModalConfirmationActions}>
                <button type="button" className={styles.buttonSecondary} onClick={() => setConfirmUnschedule(false)} disabled={saving}>
                  Keep scheduled
                </button>
                <button type="button" className={styles.buttonDanger} onClick={handleUnschedule} disabled={saving}>
                  {saving ? 'Unscheduling…' : 'Confirm unschedule'}
                </button>
              </div>
            }
          >
            The visit will return to the Unscheduled list. No project or contact data will be deleted.
          </AlertBanner>
        </div>
      ) : null}

      <div className={styles.eventModalBody}>
        <div className={styles.eventModalSection}>
          <label className={styles.eventModalLabel}>Visit / Project</label>
          {isLinkedLocked ? (
            <div className={styles.eventModalReadOnly}>{linkedLabel}</div>
          ) : (
            <select
              ref={linkedSelectRef}
              className={styles.input}
              value={linkedValue}
              onChange={(e) => {
                const value = e.target.value;
                if (value === LINK_NONE) {
                  setForm((prev) => ({
                    ...prev,
                    linkMode: 'none',
                    linkedUnscheduledId: null,
                    address: '',
                    phone: '',
                    notes: '',
                  }));
                  return;
                }

                if (!value) {
                  setForm((prev) => ({ ...prev, linkMode: 'unscheduled', linkedUnscheduledId: null }));
                  return;
                }

                const linked = unscheduled.find((u) => u.id === value) ?? null;
                setForm((prev) => ({
                  ...prev,
                  linkMode: 'unscheduled',
                  linkedUnscheduledId: value,
                  address: linked?.project.siteAddress ?? '',
                  phone: linked?.contact.phone ?? '',
                  notes: linked?.notes ?? '',
                }));
              }}
            >
              <option value="">Select unscheduled visit…</option>
              {unscheduled.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUnscheduledLabel(u)}
                </option>
              ))}
              <option value={LINK_NONE}>Create site visit (no project)</option>
            </select>
          )}
          {errors.linkedUnscheduledId ? <div className={styles.eventModalError}>{errors.linkedUnscheduledId}</div> : null}
        </div>

        <div className={styles.eventModalGrid}>
          <div className={styles.eventModalField}>
            <label className={styles.eventModalLabel}>Salesperson</label>
            <select
              className={styles.input}
              value={form.salespersonId}
              onChange={(e) => setForm((prev) => ({ ...prev, salespersonId: e.target.value }))}
            >
              <option value="">Select…</option>
              {salesPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.salespersonId ? <div className={styles.eventModalError}>{errors.salespersonId}</div> : null}
          </div>

          <div className={styles.eventModalField}>
            <label className={styles.eventModalLabel}>Date</label>
            <input
              type="date"
              className={styles.input}
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
            />
            {errors.date ? <div className={styles.eventModalError}>{errors.date}</div> : null}
          </div>

          <div className={styles.eventModalField}>
            <label className={styles.eventModalLabel}>Start time</label>
            <select
              className={styles.input}
              value={form.startTime}
              onChange={(e) => {
                const nextStart = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  startTime: nextStart,
                  endTime: prev.endTime || (nextStart ? addMinutesToHm(nextStart, DEFAULT_DURATION_MINUTES) : ''),
                }));
              }}
            >
              <option value="">Select…</option>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            {errors.startTime ? <div className={styles.eventModalError}>{errors.startTime}</div> : null}
          </div>

          <div className={styles.eventModalField}>
            <label className={styles.eventModalLabel}>End time</label>
            <select
              className={styles.input}
              value={form.endTime}
              onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
            >
              <option value="">Select…</option>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            {errors.endTime ? <div className={styles.eventModalError}>{errors.endTime}</div> : null}
          </div>
        </div>

        <div className={styles.eventModalGrid}>
          <div className={styles.eventModalField}>
            <label className={styles.eventModalLabel}>Address</label>
            <input
              className={styles.input}
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder={isLinkedProject ? '' : 'Address (optional)'}
              disabled={isLinkedProject}
            />
          </div>

          <div className={styles.eventModalField}>
            <label className={styles.eventModalLabel}>Phone</label>
            <input
              className={styles.input}
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder={isLinkedProject ? '' : 'Phone (optional)'}
              disabled={isLinkedProject}
            />
          </div>
        </div>

        <div className={styles.eventModalField}>
          <label className={styles.eventModalLabel}>Notes</label>
          <textarea
            className={styles.input}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
          />
        </div>
      </div>
    </Modal>
  );
}

export { LINK_NONE };
