'use client';

import { useId, useMemo, useState } from 'react';
import AdminCostsNav from '../_components/AdminCostsNav';
import styles from '../adminCosts.module.css';

type FlatRow = { path: string; value: string };

function stringifyPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NaN';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function flatten(value: unknown, prefix = ''): FlatRow[] {
  const rows: FlatRow[] = [];

  const walk = (node: unknown, path: string) => {
    if (node === null || node === undefined) {
      rows.push({ path, value: stringifyPrimitive(node) });
      return;
    }

    if (Array.isArray(node)) {
      if (node.length === 0) rows.push({ path, value: '[]' });
      node.forEach((child, idx) => walk(child, `${path}[${idx}]`));
      return;
    }

    if (typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>);
      if (entries.length === 0) rows.push({ path, value: '{}' });
      for (const [key, child] of entries) {
        walk(child, path ? `${path}.${key}` : key);
      }
      return;
    }

    rows.push({ path, value: stringifyPrimitive(node) });
  };

  walk(value, prefix);
  return rows;
}

export default function OverheadsClient({
  loadedFrom,
  sourceFile,
  overheads,
}: {
  loadedFrom: string;
  sourceFile: string;
  overheads: unknown;
}) {
  const inputId = useId();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => flatten(overheads), [overheads]);

  const indexed = useMemo(() => {
    return rows.map((row) => ({ row, search: `${row.path} ${row.value}`.toLowerCase() }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return indexed;
    return indexed.filter((r) => r.search.includes(q));
  }, [indexed, query]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Overheads</h1>
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
              placeholder="Search key/value…"
              autoComplete="off"
            />
          </label>
        </div>

        <div className={styles.tableWrap} role="region" aria-label="Overheads table">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Path</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ row }) => (
                <tr key={row.path}>
                  <td className={styles.mono}>{row.path}</td>
                  <td className={styles.json}>{row.value}</td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={2}>No matches.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

