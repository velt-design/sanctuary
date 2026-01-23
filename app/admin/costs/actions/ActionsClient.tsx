'use client';

import { useId, useMemo, useState } from 'react';
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
}: {
  loadedFrom: string;
  sourceFile: string;
  actions: InstallAction[];
}) {
  const inputId = useId();
  const [query, setQuery] = useState('');

  const indexed = useMemo(() => {
    return actions.map((action) => {
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
  }, [actions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return indexed;
    return indexed.filter((row) => row.search.includes(q));
  }, [indexed, query]);

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

        <AdminCostsNav />

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
                  <td className={styles.json}>{safeJson(action.base_minutes)}</td>
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

