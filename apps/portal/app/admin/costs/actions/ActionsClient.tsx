'use client';

import { useId, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast/ToastProvider';
import type { DriverCurvePoint } from '@/lib/costing/overrides';
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

type DriverCurveDefinition = {
  key: string;
  label: string;
  notes?: string;
  points: DriverCurvePoint[];
};

type DriverCurveDraftPoint = {
  length_m: string;
  minutes_per_m: string;
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toCurveDraftPoints(points: DriverCurvePoint[]): DriverCurveDraftPoint[] {
  return points.map((point) => ({
    length_m: String(point.length_m),
    minutes_per_m: String(point.minutes_per_m),
  }));
}

export default function ActionsClient({
  loadedFrom,
  sourceFile,
  actions,
  driverCurves,
  overrides,
  driverCurveOverrides,
  isAdmin = false,
  showNav = true,
}: {
  loadedFrom: string;
  sourceFile: string;
  actions: InstallAction[];
  driverCurves: Record<string, DriverCurveDefinition>;
  overrides: Record<string, number>;
  driverCurveOverrides: Record<string, DriverCurvePoint[]>;
  isAdmin?: boolean;
  showNav?: boolean;
}) {
  const inputId = useId();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(actions);
  const [curveMap, setCurveMap] = useState(driverCurves);
  const [overrideMap, setOverrideMap] = useState<Record<string, number>>(overrides ?? {});
  const [curveOverrideMap, setCurveOverrideMap] = useState<Record<string, DriverCurvePoint[]>>(driverCurveOverrides ?? {});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [curveDrafts, setCurveDrafts] = useState<Record<string, DriverCurveDraftPoint[]>>(() =>
    Object.fromEntries(Object.entries(driverCurves).map(([key, curve]) => [key, toCurveDraftPoints(curve.points)])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingCurveKey, setSavingCurveKey] = useState<string | null>(null);

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

  const curveEntries = useMemo(() => Object.values(curveMap), [curveMap]);

  const beginEdit = (action: InstallAction) => {
    if (!isAdmin) return;
    if (savingId || savingCurveKey) return;
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

  const setCurveDraftValue = (curveKey: string, pointIndex: number, field: keyof DriverCurveDraftPoint, value: string) => {
    setCurveDrafts((prev) => ({
      ...prev,
      [curveKey]: (prev[curveKey] ?? []).map((point, index) => (index === pointIndex ? { ...point, [field]: value } : point)),
    }));
  };

  const resetCurveDraft = (curveKey: string) => {
    const curve = curveMap[curveKey];
    if (!curve) return;
    setCurveDrafts((prev) => ({
      ...prev,
      [curveKey]: toCurveDraftPoints(curve.points),
    }));
  };

  const commitCurveEdit = async (curveKey: string) => {
    if (!isAdmin || savingId || savingCurveKey) return;
    const curve = curveMap[curveKey];
    if (!curve) return;

    const nextPoints = (curveDrafts[curveKey] ?? []).map((point) => ({
      length_m: Number.parseFloat(point.length_m.trim()),
      minutes_per_m: Number.parseFloat(point.minutes_per_m.trim()),
    }));

    if (
      nextPoints.length < 2 ||
      nextPoints.some((point) => !Number.isFinite(point.length_m) || !Number.isFinite(point.minutes_per_m) || point.length_m < 0 || point.minutes_per_m < 0)
    ) {
      toast.error('Each curve point needs valid length and minutes-per-m values greater than or equal to 0.');
      return;
    }

    setSavingCurveKey(curveKey);
    try {
      const res = await fetch(`/api/admin/costing/driver-curves/${encodeURIComponent(curveKey)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ points: nextPoints }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json?.error ?? 'Failed to update driver curve'));

      const savedPoints = Array.isArray(json?.points) ? (json.points as DriverCurvePoint[]) : [];
      setCurveMap((prev) => ({
        ...prev,
        [curveKey]: {
          ...curve,
          points: savedPoints,
        },
      }));
      setCurveDrafts((prev) => ({
        ...prev,
        [curveKey]: toCurveDraftPoints(savedPoints),
      }));
      setCurveOverrideMap((prev) => ({ ...prev, [curveKey]: savedPoints }));
      toast.success('Driver curve updated.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update driver curve.';
      toast.error(msg);
    } finally {
      setSavingCurveKey(null);
    }
  };

  return (
    <div className={styles.page} data-ui-foundation-consumer="admin-costs">
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

        {curveEntries.length ? (
          <div className={styles.stack}>
            {curveEntries.map((curve) => (
              <section key={curve.key} className={styles.subCard} aria-label={curve.label}>
                <div className={styles.titleRow}>
                  <div>
                    <h2 className={styles.subTitle}>{curve.label}</h2>
                    <div className={styles.helperText}>
                      <span className={styles.mono}>{curve.key}</span>
                      {curve.notes ? <span>{curve.notes}</span> : null}
                    </div>
                  </div>
                  <div className={styles.editCell}>
                    {curveOverrideMap[curve.key] ? <span className={styles.overrideBadge}>Overridden</span> : null}
                    {savingCurveKey === curve.key ? <span className={styles.saving}>Saving...</span> : null}
                  </div>
                </div>

                <div className={styles.tableWrap} role="region" aria-label={`${curve.label} table`}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Point</th>
                        <th>Length (m)</th>
                        <th>Minutes / m</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(curveDrafts[curve.key] ?? []).map((point, index) => (
                        <tr key={`${curve.key}-${index}`}>
                          <td className={styles.mono}>{index + 1}</td>
                          <td>
                            {isAdmin ? (
                              <input
                                className={styles.curveInput}
                                value={point.length_m}
                                onChange={(e) => setCurveDraftValue(curve.key, index, 'length_m', e.target.value)}
                                inputMode="decimal"
                                aria-label={`Length for ${curve.label} point ${index + 1}`}
                              />
                            ) : (
                              <span className={styles.mono}>{point.length_m}</span>
                            )}
                          </td>
                          <td>
                            {isAdmin ? (
                              <input
                                className={styles.curveInput}
                                value={point.minutes_per_m}
                                onChange={(e) => setCurveDraftValue(curve.key, index, 'minutes_per_m', e.target.value)}
                                inputMode="decimal"
                                aria-label={`Minutes per metre for ${curve.label} point ${index + 1}`}
                              />
                            ) : (
                              <span className={styles.mono}>{point.minutes_per_m}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isAdmin ? (
                  <div className={styles.buttonRow}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => resetCurveDraft(curve.key)}
                      disabled={savingCurveKey !== null || savingId !== null}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => commitCurveEdit(curve.key)}
                      disabled={savingCurveKey !== null || savingId !== null}
                    >
                      Save curve
                    </button>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        ) : null}

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
                        <button
                          type="button"
                          className={styles.editButton}
                          onClick={() => beginEdit(action)}
                          disabled={savingCurveKey !== null}
                        >
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
