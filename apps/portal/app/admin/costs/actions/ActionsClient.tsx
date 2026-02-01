'use client';

import { useId, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast/ToastProvider';
import AdminCostsNav from '../_components/AdminCostsNav';
import styles from '../adminCosts.module.css';

type InstallAction = {
  id: string;
  category?: string;
  label?: string;
  unit?: string;
  scope?: string;
  quantity?: unknown;
  base_minutes?: unknown;
  applies_to?: unknown;
  apply_multipliers?: unknown;
  notes?: string;
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function ActionsClient({
  loadedFrom,
  sourceFile,
  actions,
  overrides,
  isAdmin = false,
  showNav = true,
}: {
  loadedFrom: string;
  sourceFile: string;
  actions: InstallAction[];
  overrides: Record<string, number>;
  isAdmin?: boolean;
  showNav?: boolean;
}) {
  const inputId = useId();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(actions);
  const [overrideMap, setOverrideMap] = useState<Record<string, number>>(overrides ?? {});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const indexed = useMemo(() => {
    return rows.map((action) => {
      const search = [
        action.id,
        action.category ?? '',
        action.label ?? '',
        action.unit ?? '',
        action.scope ?? '',
        safeJson(action.applies_to),
        safeJson(action.quantity),
        safeJson(action.base_minutes),
        safeJson(action.apply_multipliers),
      ]
        .join(' ')
        .toLowerCase();

      return { action, search };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return indexed;
    return indexed.filter((row) => row.search.includes(q));
  }, [indexed, query]);

  const beginEdit = (action: InstallAction) => {
    if (!isAdmin) return;
    if (savingId) return;
    setEditingId(action.id);
    const minutes = typeof action.base_minutes === 'number' && Number.isFinite(action.base_minutes) ? action.base_minutes : 0;
    setDraftValue(String(Math.round(minutes)));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftValue('');
  };

  const commitEdit = async (action: InstallAction) => {
    if (!isAdmin || savingId) return;
    const raw = draftValue.trim();
    const parsed = raw === '' ? NaN : Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Base minutes must be an integer ≥ 0.');
      return;
    }
    const nextValue = Math.round(parsed);

    setSavingId(action.id);
    try {
      const res = await fetch(`/api/admin/actions/${encodeURIComponent(action.id)}/minutes`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ base_minutes: nextValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json?.error ?? 'Failed to update base minutes'));

      setRows((prev) => prev.map((row) => (row.id === action.id ? { ...row, base_minutes: nextValue } : row)));
      setOverrideMap((prev) => ({ ...prev, [action.id]: nextValue }));
      toast.success('Install action minutes updated.');
      cancelEdit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update base minutes.';
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Install actions</h1>
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
              placeholder="Search id/label/applies_to…"
              autoComplete="off"
            />
          </label>
        </div>

        <div className={styles.tableWrap} role="region" aria-label="Install actions table">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Scope</th>
                <th>Category</th>
                <th>Label</th>
                <th>Unit</th>
                <th>Quantity</th>
                <th>Base minutes</th>
                <th>Multipliers</th>
                <th>Applies to</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ action }) => (
                <tr key={action.id}>
                  <td className={styles.mono}>{action.id}</td>
                  <td className={styles.mono}>{action.scope ?? 'module'}</td>
                  <td>{action.category ?? '—'}</td>
                  <td>{action.label ?? '—'}</td>
                  <td className={styles.mono}>{action.unit ?? '—'}</td>
                  <td className={styles.json}>{safeJson(action.quantity)}</td>
                  <td>
                    <div className={styles.editCell}>
                      {editingId === action.id && isAdmin ? (
                        <input
                          className={styles.editInput}
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitEdit(action)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(action);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          inputMode="numeric"
                          aria-label={`Edit minutes for ${action.label ?? action.id}`}
                          autoFocus
                        />
                      ) : isAdmin ? (
                        <button type="button" className={styles.editButton} onClick={() => beginEdit(action)}>
                          {safeJson(action.base_minutes)}
                        </button>
                      ) : (
                        <span className={styles.json}>{safeJson(action.base_minutes)}</span>
                      )}
                      {overrideMap[action.id] !== undefined ? <span className={styles.overrideBadge}>Overridden</span> : null}
                      {savingId === action.id ? <span className={styles.saving}>Saving…</span> : null}
                    </div>
                  </td>
                  <td className={styles.json}>{safeJson(action.apply_multipliers)}</td>
                  <td className={styles.json}>{safeJson(action.applies_to)}</td>
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
