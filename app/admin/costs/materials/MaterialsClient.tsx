'use client';

import { useId, useMemo, useState } from 'react';
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
}: {
  loadedFrom: string;
  sourceFile: string;
  items: MaterialItem[];
}) {
  const inputId = useId();
  const [query, setQuery] = useState('');

  const indexed = useMemo(() => {
    return items.map((item) => {
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
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return indexed;
    return indexed.filter((row) => row.search.includes(q));
  }, [indexed, query]);

  return (
    <div className={styles.page}>
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

        <AdminCostsNav />

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
                  <td>{formatMoney(item.cost_ex_gst)}</td>
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

