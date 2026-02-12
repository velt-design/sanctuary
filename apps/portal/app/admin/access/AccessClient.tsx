'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/toast/ToastProvider';
import styles from './access.module.css';

type Role = 'admin' | 'staff';

type Result = {
  user_id: string;
  email: string;
  role: Role;
  existing: boolean;
};

type CrewRow = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  calendar_region: string;
  base_available_date: string | null;
  scheduled_item_count: number;
};

const DEFAULT_CREW_COLOR = '#7A3B3B';
const DEFAULT_CREW_REGION = 'Auckland';

function generatePassword(length = 14) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const buffer = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < length; i += 1) buffer[i] = Math.floor(Math.random() * charset.length);
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += charset[buffer[i] % charset.length];
  }
  return out;
}

function normalizeHexColor(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return '';

  const body = match[1].toUpperCase();
  if (body.length === 3) {
    return `#${body
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`;
  }
  return `#${body}`;
}

function colorForInput(raw: string | null | undefined): string {
  const normalized = normalizeHexColor(String(raw ?? ''));
  return normalized || DEFAULT_CREW_COLOR;
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function mapCrewRow(raw: any): CrewRow {
  return {
    id: typeof raw?.id === 'string' ? raw.id : '',
    name: typeof raw?.name === 'string' ? raw.name : '',
    color: normalizeHexColor(String(raw?.color ?? '')) || DEFAULT_CREW_COLOR,
    is_active: typeof raw?.is_active === 'boolean' ? raw.is_active : true,
    sort_order: typeof raw?.sort_order === 'number' && Number.isFinite(raw.sort_order) ? Math.trunc(raw.sort_order) : 0,
    calendar_region: typeof raw?.calendar_region === 'string' && raw.calendar_region.trim() ? raw.calendar_region.trim() : DEFAULT_CREW_REGION,
    base_available_date: typeof raw?.base_available_date === 'string' && raw.base_available_date.trim() ? raw.base_available_date.trim() : null,
    scheduled_item_count:
      typeof raw?.scheduled_item_count === 'number' && Number.isFinite(raw.scheduled_item_count) ? Math.max(0, Math.trunc(raw.scheduled_item_count)) : 0,
  };
}

function sortCrews(rows: CrewRow[]): CrewRow[] {
  return rows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((crew, index) => ({ ...crew, sort_order: index + 1 }));
}

export default function AccessClient() {
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const [crews, setCrews] = useState<CrewRow[]>([]);
  const [loadingCrews, setLoadingCrews] = useState(true);
  const [crewsError, setCrewsError] = useState<string | null>(null);
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewColor, setNewCrewColor] = useState(DEFAULT_CREW_COLOR);
  const [newCrewRegion, setNewCrewRegion] = useState(DEFAULT_CREW_REGION);
  const [newCrewBaseDate, setNewCrewBaseDate] = useState('');
  const [addingCrew, setAddingCrew] = useState(false);
  const [savingCrewId, setSavingCrewId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);

  const trimmedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const loadCrews = async () => {
    setLoadingCrews(true);
    try {
      const res = await fetch('/api/admin/crews', {
        method: 'GET',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? 'Failed to load crews.'));
      }

      const rows = Array.isArray(json?.crews) ? json.crews.map(mapCrewRow) : [];
      setCrews(sortCrews(rows));
      setCrewsError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load crews.';
      setCrewsError(message);
      toast.error(message);
    } finally {
      setLoadingCrews(false);
    }
  };

  useEffect(() => {
    void loadCrews();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!trimmedEmail) {
      toast.error('Email is required.');
      return;
    }
    if (!password || password.trim().length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, role, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(String(json?.error ?? 'Failed to set password.'));
      }
      setResult(json as Result);
      toast.success(json?.existing ? 'Password updated.' : 'User created with temp password.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set temp password.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateCrewDraft = (crewId: string, patch: Partial<CrewRow>) => {
    setCrews((prev) => prev.map((crew) => (crew.id === crewId ? { ...crew, ...patch } : crew)));
  };

  const addCrew = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addingCrew) return;

    const name = newCrewName.trim();
    if (!name) {
      toast.error('Crew name is required.');
      return;
    }

    const color = normalizeHexColor(newCrewColor) || DEFAULT_CREW_COLOR;
    const region = newCrewRegion.trim() || DEFAULT_CREW_REGION;
    const baseDate = newCrewBaseDate.trim();

    if (baseDate && !isYmd(baseDate)) {
      toast.error('Base available date must be YYYY-MM-DD.');
      return;
    }

    setAddingCrew(true);
    try {
      const res = await fetch('/api/admin/crews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          color,
          calendar_region: region,
          base_available_date: baseDate || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? 'Failed to add crew.'));
      }

      const added = mapCrewRow(json?.crew ?? {});
      setCrews((prev) => sortCrews([...prev, added]));
      setNewCrewName('');
      setNewCrewColor(DEFAULT_CREW_COLOR);
      setNewCrewRegion(DEFAULT_CREW_REGION);
      setNewCrewBaseDate('');
      setCrewsError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add crew.';
      toast.error(message);
    } finally {
      setAddingCrew(false);
    }
  };

  const saveCrewRow = async (crewId: string) => {
    const row = crews.find((crew) => crew.id === crewId) ?? null;
    if (!row) {
      toast.error('Crew not found. Refresh and try again.');
      return;
    }
    if (savingCrewId || reorderBusy) return;

    const name = row.name.trim();
    if (!name) {
      toast.error('Crew name is required.');
      return;
    }

    const color = normalizeHexColor(row.color);
    if (!color) {
      toast.error('Crew color must be a valid hex value.');
      return;
    }

    const region = row.calendar_region.trim() || DEFAULT_CREW_REGION;
    const baseDate = row.base_available_date?.trim() ?? '';
    if (baseDate && !isYmd(baseDate)) {
      toast.error('Base available date must be YYYY-MM-DD.');
      return;
    }

    setSavingCrewId(crewId);
    try {
      const res = await fetch(`/api/admin/crews/${encodeURIComponent(crewId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          color,
          calendar_region: region,
          base_available_date: baseDate || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? 'Failed to save crew.'));
      }

      const updated = mapCrewRow(json?.crew ?? row);
      setCrews((prev) => sortCrews(prev.map((crew) => (crew.id === crewId ? updated : crew))));
      setCrewsError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save crew.';
      toast.error(message);
    } finally {
      setSavingCrewId(null);
    }
  };

  const toggleCrewActive = async (crew: CrewRow) => {
    if (savingCrewId || reorderBusy) return;
    if (crew.is_active && crew.scheduled_item_count > 0) return;

    const nextActive = !crew.is_active;
    const previous = crews;
    setCrews((prev) => prev.map((row) => (row.id === crew.id ? { ...row, is_active: nextActive } : row)));
    setSavingCrewId(crew.id);

    try {
      const res = await fetch(`/api/admin/crews/${encodeURIComponent(crew.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? 'Failed to update crew status.'));
      }

      const updated = mapCrewRow(json?.crew ?? { ...crew, is_active: nextActive });
      setCrews((prev) => sortCrews(prev.map((row) => (row.id === crew.id ? updated : row))));
      setCrewsError(null);
    } catch (err) {
      setCrews(previous);
      const message = err instanceof Error ? err.message : 'Failed to update crew status.';
      toast.error(message);
    } finally {
      setSavingCrewId(null);
    }
  };

  const moveCrew = async (index: number, direction: -1 | 1) => {
    if (reorderBusy || savingCrewId) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= crews.length) return;

    const previous = crews;
    const reordered = crews.slice();
    const current = reordered[index];
    reordered[index] = reordered[nextIndex];
    reordered[nextIndex] = current;
    const nextOrdered = sortCrews(reordered);

    setCrews(nextOrdered);
    setReorderBusy(true);

    try {
      const res = await fetch('/api/admin/crews/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_ids: nextOrdered.map((crew) => crew.id) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? 'Failed to reorder crews.'));
      }
    } catch (err) {
      setCrews(previous);
      const message = err instanceof Error ? err.message : 'Failed to reorder crews.';
      toast.error(message);
    } finally {
      setReorderBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Access" />
      <div className={styles.card}>
        <p className={styles.intro}>
          Create a portal user (or update an existing one) with a temporary password. The user can log in immediately.
        </p>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@sanctuarypergolas.co.nz"
                autoComplete="username"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Role</span>
              <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Temporary password</span>
            <div className={styles.passwordRow}>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button type="button" className={styles.buttonSecondary} onClick={() => setPassword(generatePassword())}>
                Generate
              </button>
              <button type="button" className={styles.buttonSecondary} onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className={styles.helper}>Use at least 8 characters. You can change it later.</span>
          </label>

          <div className={styles.actions}>
            <button className={styles.buttonPrimary} type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Set temp password'}
            </button>
            <span className={styles.helper}>Creates the user if missing and assigns portal role.</span>
          </div>
        </form>

        {result ? (
          <div className={styles.result}>
            <strong>{result.existing ? 'Updated existing user' : 'Created new user'}</strong>
            <div>
              {result.email} → {result.role}
            </div>
            <div className={styles.code}>user_id: {result.user_id}</div>
          </div>
        ) : null}
      </div>

      <div className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Schedule crews</h2>
          <p className={styles.sectionHelper}>
            Manage the crews shown in Schedule (Board/Gantt). Deactivating hides a crew but keeps history.
          </p>
        </div>

        <form className={styles.crewAddForm} onSubmit={addCrew}>
          <label className={styles.field}>
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              type="text"
              value={newCrewName}
              onChange={(e) => setNewCrewName(e.target.value)}
              placeholder="Crew name"
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Color</span>
            <div className={styles.colorInputRow}>
              <input
                className={styles.colorPicker}
                type="color"
                value={colorForInput(newCrewColor)}
                onChange={(e) => setNewCrewColor(e.target.value)}
                aria-label="Pick crew color"
              />
              <input
                className={styles.input}
                type="text"
                value={newCrewColor}
                onChange={(e) => setNewCrewColor(e.target.value)}
                onBlur={(e) => {
                  const normalized = normalizeHexColor(e.target.value);
                  if (normalized) setNewCrewColor(normalized);
                }}
                placeholder="#7A3B3B"
              />
            </div>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Region</span>
            <input
              className={styles.input}
              type="text"
              value={newCrewRegion}
              onChange={(e) => setNewCrewRegion(e.target.value)}
              placeholder="Auckland"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Base available date</span>
            <input className={styles.input} type="date" value={newCrewBaseDate} onChange={(e) => setNewCrewBaseDate(e.target.value)} />
          </label>
          <div className={styles.addCrewActions}>
            <button className={styles.buttonPrimary} type="submit" disabled={addingCrew}>
              {addingCrew ? 'Adding...' : 'Add crew'}
            </button>
          </div>
        </form>

        {loadingCrews ? <p className={styles.helper}>Loading crews…</p> : null}
        {!loadingCrews && crewsError ? <p className={styles.errorText}>{crewsError}</p> : null}

        {!loadingCrews ? (
          <div className={styles.crewTableWrap} role="region" aria-label="Schedule crews table">
            <table className={styles.crewTable}>
              <thead>
                <tr>
                  <th>Reorder</th>
                  <th>Color</th>
                  <th>Name</th>
                  <th>Region</th>
                  <th>Base available</th>
                  <th>Active</th>
                  <th>Scheduled items</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {crews.map((crew, index) => {
                  const disabledDeactivate = crew.is_active && crew.scheduled_item_count > 0;
                  const rowBusy = savingCrewId === crew.id || reorderBusy;
                  return (
                    <tr key={crew.id} className={!crew.is_active ? styles.crewRowInactive : undefined}>
                      <td>
                        <div className={styles.reorderButtons}>
                          <button
                            type="button"
                            className={styles.smallButton}
                            onClick={() => void moveCrew(index, -1)}
                            disabled={rowBusy || index === 0}
                            aria-label={`Move ${crew.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={styles.smallButton}
                            onClick={() => void moveCrew(index, 1)}
                            disabled={rowBusy || index === crews.length - 1}
                            aria-label={`Move ${crew.name} down`}
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className={styles.colorField}>
                          <span className={styles.colorDot} style={{ backgroundColor: colorForInput(crew.color) }} aria-hidden />
                          <input
                            className={styles.colorPicker}
                            type="color"
                            value={colorForInput(crew.color)}
                            onChange={(e) => updateCrewDraft(crew.id, { color: e.target.value })}
                            aria-label={`Pick color for ${crew.name}`}
                          />
                          <input
                            className={styles.colorHexInput}
                            type="text"
                            value={crew.color}
                            onChange={(e) => updateCrewDraft(crew.id, { color: e.target.value })}
                            onBlur={(e) => {
                              const normalized = normalizeHexColor(e.target.value);
                              if (normalized) updateCrewDraft(crew.id, { color: normalized });
                            }}
                            placeholder="#7A3B3B"
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={crew.name}
                          onChange={(e) => updateCrewDraft(crew.id, { name: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={crew.calendar_region}
                          onChange={(e) => updateCrewDraft(crew.id, { calendar_region: e.target.value })}
                          placeholder="Auckland"
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="date"
                          value={crew.base_available_date ?? ''}
                          onChange={(e) => updateCrewDraft(crew.id, { base_available_date: e.target.value || null })}
                        />
                      </td>
                      <td>
                        <label className={styles.activeToggle}>
                          <input
                            type="checkbox"
                            checked={crew.is_active}
                            disabled={rowBusy || disabledDeactivate}
                            onChange={() => void toggleCrewActive(crew)}
                          />
                          <span>{crew.is_active ? 'Active' : 'Inactive'}</span>
                        </label>
                      </td>
                      <td>
                        <span className={styles.countBadge}>{crew.scheduled_item_count}</span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => void saveCrewRow(crew.id)}
                            disabled={rowBusy}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => void toggleCrewActive(crew)}
                            disabled={rowBusy || disabledDeactivate}
                          >
                            {crew.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                          {disabledDeactivate ? <span className={styles.deactivateHelper}>Move/unschedule items before deactivating.</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!crews.length ? (
                  <tr>
                    <td colSpan={8}>No crews found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
