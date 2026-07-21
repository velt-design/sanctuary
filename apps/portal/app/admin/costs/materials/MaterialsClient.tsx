'use client';

import { useId, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast/ToastProvider';
import AdminCostsNav from '../_components/AdminCostsNav';
import styles from '../adminCosts.module.css';

type MaterialItem = {
  id: string;
  category?: string;
  unit?: string;
  name?: string;
  cost_ex_gst?: number;
  attributes?: Record<string, unknown> | null;
};

function formatMoney(n: unknown): string {
  return typeof n === 'number' && Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function MaterialsClient({
  loadedFrom,
  sourceFile,
  items,
  overrides,
  isAdmin = false,
  showNav = true,
}: {
  loadedFrom: string;
  sourceFile: string;
  items: MaterialItem[];
  overrides: Record<string, number>;
  isAdmin?: boolean;
  showNav?: boolean;
}) {
  const inputId = useId();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(items);
  const [overrideMap, setOverrideMap] = useState<Record<string, number>>(overrides ?? {});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const indexed = useMemo(() => {
    return rows.map((item) => {
      const attrs = item.attributes ?? {};
      const profile = typeof (attrs as any).profile === 'string' ? (attrs as any).profile : '';
      const colour = typeof (attrs as any).colour === 'string' ? (attrs as any).colour : '';
      const length = typeof (attrs as any).length_m === 'number' ? String((attrs as any).length_m) : '';

      const search = [
        item.id,
        item.category ?? '',
        item.unit ?? '',
        item.name ?? '',
        profile,
        colour,
        length,
        safeJson(attrs),
      ]
        .join(' ')
        .toLowerCase();

      return { item, search, profile, colour, length_m: length };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return indexed;
    return indexed.filter((row) => row.search.includes(q));
  }, [indexed, query]);

  const beginEdit = (item: MaterialItem) => {
    if (!isAdmin) return;
    if (savingId) return;
    setEditingId(item.id);
    const cost = typeof item.cost_ex_gst === 'number' && Number.isFinite(item.cost_ex_gst) ? item.cost_ex_gst : 0;
    setDraftValue(cost.toFixed(2));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftValue('');
  };

  const commitEdit = async (item: MaterialItem) => {
    if (!isAdmin || savingId) return;
    const raw = draftValue.trim();
    const parsed = raw === '' ? NaN : Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Cost must be a number ≥ 0.');
      return;
    }
    const nextValue = Math.round(parsed * 100) / 100;

    setSavingId(item.id);
    try {
      const res = await fetch(`/api/admin/materials/${encodeURIComponent(item.id)}/cost`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cost_ex_gst: nextValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json?.error ?? 'Failed to update cost'));

      setRows((prev) => prev.map((row) => (row.id === item.id ? { ...row, cost_ex_gst: nextValue } : row)));
      setOverrideMap((prev) => ({ ...prev, [item.id]: nextValue }));
      toast.success('Material cost updated.');
      cancelEdit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update cost.';
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className={styles.page} data-ui-foundation-consumer="admin-costs">
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Materials</h1>
          <div className={styles.count}>{filtered.length} rows</div>
        </div>

        <div className={styles.meta}>
          <div>
            Loaded from: <code>{loadedFrom}</code>
          </div>
          <div>
            Source file: <code>{sourceFile}</code>
          </div>
        </div>

        {showNav ? <AdminCostsNav /> : null}

        <div className={styles.searchRow}>
          <label className={styles.searchLabel} htmlFor={inputId}>
            Search
            <input
              id={inputId}
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id/name/profile/colour…"
              autoComplete="off"
            />
          </label>
        </div>

        <div className={styles.tableWrap} role="region" aria-label="Materials table">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Name</th>
                <th>Cost (ex‑GST)</th>
                <th>Profile</th>
                <th>Colour</th>
                <th>Length (m)</th>
                <th>Attributes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ item, profile, colour, length_m }) => (
                <tr key={item.id}>
                  <td className={styles.mono}>{item.id}</td>
                  <td>{item.category ?? '—'}</td>
                  <td>{item.unit ?? '—'}</td>
                  <td>{item.name ?? '—'}</td>
                  <td>
                    <div className={styles.editCell}>
                      {editingId === item.id && isAdmin ? (
                        <input
                          className={styles.editInput}
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitEdit(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(item);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          inputMode="decimal"
                          aria-label={`Edit cost for ${item.name ?? item.id}`}
                          autoFocus
                        />
                      ) : isAdmin ? (
                        <button type="button" className={styles.editButton} onClick={() => beginEdit(item)}>
                          {formatMoney(item.cost_ex_gst)}
                        </button>
                      ) : (
                        <span>{formatMoney(item.cost_ex_gst)}</span>
                      )}
                      {overrideMap[item.id] !== undefined ? <span className={styles.overrideBadge}>Overridden</span> : null}
                      {savingId === item.id ? <span className={styles.saving}>Saving…</span> : null}
                    </div>
                  </td>
                  <td className={styles.mono}>{profile || '—'}</td>
                  <td className={styles.mono}>{colour || '—'}</td>
                  <td className={styles.mono}>{length_m || '—'}</td>
                  <td className={styles.json}>{safeJson(item.attributes ?? null)}</td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={9}>No matches.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
