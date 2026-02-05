'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import type { SiteVisitCalendarItem, SiteVisitCalendarPerson } from '@/lib/types/siteVisits';
import styles from '@/app/staff/schedule/schedule.module.css';
import { DEFAULT_DURATION_MINUTES, MINUTES_STEP } from '@/components/schedule/site-visits/siteVisits.constants';

export type SiteVisitModalFormValues = {
  salespersonId: string;
  date: string;
  time: string;
  durationMins: number;
  title: string;
  address: string;
  phone: string;
  notes: string;
};

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

function durationFromIso(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return DEFAULT_DURATION_MINUTES;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return DEFAULT_DURATION_MINUTES;
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  return mins > 0 ? mins : DEFAULT_DURATION_MINUTES;
}

export default function SiteVisitModal({
  open,
  mode,
  item,
  preset,
  salesPeople,
  defaultSalespersonId,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  item: SiteVisitCalendarItem | null;
  preset?: Partial<SiteVisitModalFormValues>;
  salesPeople: readonly SiteVisitCalendarPerson[];
  defaultSalespersonId?: string;
  onClose: () => void;
  onSave: (values: SiteVisitModalFormValues) => Promise<void> | void;
}) {
  const [form, setForm] = useState<SiteVisitModalFormValues>({
    salespersonId: '',
    date: '',
    time: '',
    durationMins: DEFAULT_DURATION_MINUTES,
    title: '',
    address: '',
    phone: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isLocal = Boolean(item?.id && item.id.startsWith('local:'));
  const showFreeformFields = mode === 'create' || isLocal;

  const linkedProjectLabel = useMemo(() => {
    if (!item) return '';
    const name = (item.project.name || '').trim() || item.projectId || 'Untitled project';
    return name;
  }, [item]);

  const linkedContactLabel = useMemo(() => {
    if (!item) return '';
    const name = item.contact.name || '';
    const phone = item.contact.phone || '';
    return [name, phone].filter(Boolean).join(' · ');
  }, [item]);

  useEffect(() => {
    if (!open) return;
    const base: SiteVisitModalFormValues = {
      salespersonId: item?.salespersonId ?? defaultSalespersonId ?? '',
      date: item?.scheduledStart ? toLocalDayKey(item.scheduledStart) : '',
      time: item?.scheduledStart ? toLocalHm(item.scheduledStart) : '',
      durationMins: durationFromIso(item?.scheduledStart ?? null, item?.scheduledEnd ?? null),
      title: item?.project?.name ?? '',
      address: item?.project?.siteAddress ?? '',
      phone: item?.contact?.phone ?? '',
      notes: item?.notes ?? '',
    };

    const next = { ...base, ...(preset ?? {}) };
    setForm(next);
    setError(null);
  }, [defaultSalespersonId, item, open, preset]);

  if (!open) return null;

  const handleSave = async () => {
    if (saving) return;
    const salespersonId = form.salespersonId.trim();
    if (!salespersonId) {
      setError('Salesperson is required.');
      return;
    }
    if (!form.date.trim() || !form.time.trim()) {
      setError('Date and start time are required.');
      return;
    }
    if ((mode === 'create' || isLocal) && !form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({ ...form, salespersonId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} ariaLabel={mode === 'edit' ? 'Edit site visit' : 'New site visit'} onClose={onClose} maxWidthPx={680}>
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {mode === 'edit' ? 'Edit site visit' : 'New site visit'}
          </h2>
          <button type="button" className={styles.buttonSecondary} onClick={onClose}>
            Close
          </button>
        </div>

        {mode === 'edit' && item && !isLocal ? (
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Linked project</div>
            <div style={{ fontSize: 13 }}>{linkedProjectLabel}</div>
            {linkedContactLabel ? <div style={{ fontSize: 12, color: 'rgba(15,15,16,0.6)' }}>{linkedContactLabel}</div> : null}
          </div>
        ) : null}

        {showFreeformFields ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Title</label>
              <input
                className={styles.input}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="New site visit"
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Address</label>
              <input
                className={styles.input}
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Address (optional)"
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Phone</label>
              <input
                className={styles.input}
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Phone (optional)"
              />
            </div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Salesperson</label>
            <select
              className={styles.input}
              value={form.salespersonId}
              onChange={(e) => setForm((p) => ({ ...p, salespersonId: e.target.value }))}
            >
              <option value="">Select…</option>
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
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Start time</label>
            <input
              type="time"
              step={MINUTES_STEP * 60}
              className={styles.input}
              value={form.time}
              onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Duration</label>
            <select
              className={styles.input}
              value={String(form.durationMins)}
              onChange={(e) => setForm((p) => ({ ...p, durationMins: Number(e.target.value) }))}
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Notes</label>
          <textarea
            className={styles.input}
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={3}
          />
        </div>

        {error ? <div style={{ fontSize: 12, color: 'rgb(185, 28, 28)' }}>{error}</div> : null}

        <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
          <button type="button" className={styles.buttonSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
