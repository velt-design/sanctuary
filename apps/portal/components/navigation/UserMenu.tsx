'use client';

import { CircleUser, LogOut, Palette, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './UserMenu.module.css';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { applyPortalThemeToDocument } from '@/lib/theme/client';
import { PORTAL_THEME_PRESETS, PORTAL_DEFAULT_THEME_PRESET_ID } from '@/lib/theme/presets';
import type { PortalResolvedTheme, PortalThemeOverrideKey, PortalThemePresetId, PortalThemeTokens } from '@/lib/theme/types';
import { hexToRgbCsv, normalizeHexColor } from '@/lib/theme/utils';

type ThemeSystemPreset = {
  id: PortalThemePresetId;
  label: string;
  tokens: PortalThemeTokens;
  immutable?: boolean;
};

type ThemeUserPreset = {
  id: string;
  name: string;
  tokens: PortalThemeTokens;
  created_at?: string | null;
  updated_at?: string | null;
};

type ThemeOption = {
  key: string;
  kind: 'system' | 'user';
  id: string;
  label: string;
  tokens: PortalThemeTokens;
  immutable: boolean;
};

type ThemeApiPayload = {
  ok: boolean;
  presets?: ThemeSystemPreset[];
  system_presets?: ThemeSystemPreset[];
  user_presets?: ThemeUserPreset[];
  theme?: PortalResolvedTheme;
  missing_table?: boolean;
  error?: string;
};

type ThemePresetMutationPayload = {
  ok: boolean;
  preset?: ThemeUserPreset;
  deleted_id?: string;
  error?: string;
};

const TOKEN_FIELDS: Array<{ key: PortalThemeOverrideKey; label: string }> = [
  { key: 'accent', label: 'Accent' },
  { key: 'text', label: 'Text' },
  { key: 'text_muted', label: 'Muted text' },
  { key: 'text_inverse', label: 'Inverse text' },
  { key: 'bg_page', label: 'Page background' },
  { key: 'bg_surface', label: 'Surface / bubble' },
  { key: 'border', label: 'Border' },
];

const DEFAULT_SYSTEM_PRESETS: ThemeSystemPreset[] = PORTAL_THEME_PRESETS.map((preset) => ({ ...preset, immutable: true }));
const DEFAULT_THEME_SYSTEM_PRESET: ThemeSystemPreset =
  DEFAULT_SYSTEM_PRESETS.find((preset) => preset.id === PORTAL_DEFAULT_THEME_PRESET_ID) ?? DEFAULT_SYSTEM_PRESETS[0];

function systemKey(id: string): string {
  return `system:${id}`;
}

function userKey(id: string): string {
  return `user:${id}`;
}

function toSystemPresetList(raw: unknown): ThemeSystemPreset[] {
  const source = Array.isArray(raw) && raw.length ? raw : DEFAULT_SYSTEM_PRESETS;
  const next: ThemeSystemPreset[] = [];

  for (const item of source as any[]) {
    const id = typeof item?.id === 'string' ? item.id : '';
    const label = typeof item?.label === 'string' ? item.label : '';
    const tokens = item?.tokens ?? null;
    if (!id || !label || !tokens || typeof tokens !== 'object') continue;

    const normalizedTokens: Partial<PortalThemeTokens> = {};
    let ok = true;
    for (const field of TOKEN_FIELDS) {
      const value = normalizeHexColor((tokens as any)[field.key]);
      if (!value) {
        ok = false;
        break;
      }
      normalizedTokens[field.key] = value;
    }
    if (!ok) continue;

    next.push({
      id: id as PortalThemePresetId,
      label,
      tokens: normalizedTokens as PortalThemeTokens,
      immutable: true,
    });
  }

  return next.length ? next : DEFAULT_SYSTEM_PRESETS;
}

function toUserPresetList(raw: unknown): ThemeUserPreset[] {
  if (!Array.isArray(raw) || !raw.length) return [];

  const next: ThemeUserPreset[] = [];
  for (const item of raw as any[]) {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const tokens = item?.tokens ?? null;
    if (!id || !name || !tokens || typeof tokens !== 'object') continue;

    const normalizedTokens: Partial<PortalThemeTokens> = {};
    let ok = true;
    for (const field of TOKEN_FIELDS) {
      const value = normalizeHexColor((tokens as any)[field.key]);
      if (!value) {
        ok = false;
        break;
      }
      normalizedTokens[field.key] = value;
    }
    if (!ok) continue;

    next.push({
      id,
      name,
      tokens: normalizedTokens as PortalThemeTokens,
      created_at: typeof item?.created_at === 'string' ? item.created_at : null,
      updated_at: typeof item?.updated_at === 'string' ? item.updated_at : null,
    });
  }

  return next;
}

function normalizeDraftTokens(raw: unknown, fallback: PortalThemeTokens): PortalThemeTokens {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Partial<PortalThemeTokens> = {};
  for (const field of TOKEN_FIELDS) {
    out[field.key] = normalizeHexColor(source[field.key]) || fallback[field.key];
  }
  return out as PortalThemeTokens;
}

function buildThemeOptions(systemPresets: ThemeSystemPreset[], userPresets: ThemeUserPreset[]): ThemeOption[] {
  return [
    ...systemPresets.map((preset) => ({
      key: systemKey(preset.id),
      kind: 'system' as const,
      id: preset.id,
      label: preset.label,
      tokens: preset.tokens,
      immutable: true,
    })),
    ...userPresets.map((preset) => ({
      key: userKey(preset.id),
      kind: 'user' as const,
      id: preset.id,
      label: preset.name,
      tokens: preset.tokens,
      immutable: false,
    })),
  ];
}

function validatePresetName(value: string): string {
  return value.trim().slice(0, 48);
}

export default function UserMenu({ email, roleLabel }: { email?: string; roleLabel?: string }) {
  const { signOut } = usePortalSession();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [loadingTheme, setLoadingTheme] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const [systemPresets, setSystemPresets] = useState<ThemeSystemPreset[]>(DEFAULT_SYSTEM_PRESETS);
  const [userPresets, setUserPresets] = useState<ThemeUserPreset[]>([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>(systemKey(PORTAL_DEFAULT_THEME_PRESET_ID));
  const [presetName, setPresetName] = useState('');
  const [draftTokens, setDraftTokens] = useState<PortalThemeTokens>(DEFAULT_THEME_SYSTEM_PRESET.tokens);

  const options = useMemo(() => buildThemeOptions(systemPresets, userPresets), [systemPresets, userPresets]);
  const selectedPreset = useMemo(
    () => options.find((option) => option.key === selectedPresetKey) ?? options[0] ?? buildThemeOptions(DEFAULT_SYSTEM_PRESETS, [])[0],
    [options, selectedPresetKey],
  );

  const hasCustomizations = useMemo(() => {
    for (const field of TOKEN_FIELDS) {
      if (normalizeHexColor(draftTokens[field.key]) !== normalizeHexColor(selectedPreset.tokens[field.key])) {
        return true;
      }
    }
    return false;
  }, [draftTokens, selectedPreset.tokens]);

  const isSelectedUserPreset = selectedPreset?.kind === 'user';

  const applyThemeResponse = useCallback((json: ThemeApiPayload) => {
    const nextSystemPresets = toSystemPresetList(json.system_presets ?? json.presets ?? DEFAULT_SYSTEM_PRESETS);
    const nextUserPresets = toUserPresetList(json.user_presets);
    const nextOptions = buildThemeOptions(nextSystemPresets, nextUserPresets);
    const fallbackOption = nextOptions[0] ?? buildThemeOptions(DEFAULT_SYSTEM_PRESETS, [])[0];

    let nextSelectedKey = fallbackOption.key;
    if (json.theme?.active_preset_kind === 'user' && json.theme.user_preset_id) {
      const key = userKey(json.theme.user_preset_id);
      if (nextOptions.some((option) => option.key === key)) nextSelectedKey = key;
    } else if (json.theme?.preset_id) {
      const key = systemKey(json.theme.preset_id);
      if (nextOptions.some((option) => option.key === key)) nextSelectedKey = key;
    }

    const nextSelected = nextOptions.find((option) => option.key === nextSelectedKey) ?? fallbackOption;
    const nextTokens = normalizeDraftTokens(json.theme?.tokens, nextSelected.tokens);

    setSystemPresets(nextSystemPresets);
    setUserPresets(nextUserPresets);
    setSelectedPresetKey(nextSelected.key);
    setPresetName(nextSelected.kind === 'user' ? nextSelected.label : '');
    setDraftTokens(nextTokens);

    if (json.theme) {
      applyPortalThemeToDocument(json.theme);
    } else {
      applyPortalThemeToDocument({
        tokens: nextTokens,
        accent_rgb_csv: hexToRgbCsv(nextTokens.accent) || hexToRgbCsv(DEFAULT_THEME_SYSTEM_PRESET.tokens.accent),
      });
    }
  }, []);

  const loadTheme = useCallback(async () => {
    setLoadingTheme(true);
    try {
      const res = await fetch('/api/staff/v1/theme', { method: 'GET', cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as ThemeApiPayload;
      if (!res.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load theme settings.');
      }
      if (json.missing_table) {
        toast.error('Theme settings tables are missing. Run latest migrations to enable saved presets.');
      }
      applyThemeResponse(json);
      setLoadedOnce(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load theme settings.');
    } finally {
      setLoadingTheme(false);
    }
  }, [applyThemeResponse, toast]);

  useEffect(() => {
    if (!open || loadedOnce || loadingTheme) return;
    void loadTheme();
  }, [loadedOnce, loadingTheme, loadTheme, open]);

  const persistTheme = useCallback(
    async (payload: { mode: 'replace' | 'reset'; preset_id?: PortalThemePresetId; user_preset_id?: string; overrides?: Record<string, string> }) => {
      setSavingTheme(true);
      try {
        const res = await fetch('/api/staff/v1/theme', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = (await res.json().catch(() => ({}))) as ThemeApiPayload;
        if (!res.ok) {
          throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to save theme settings.');
        }
        applyThemeResponse(json);
        return json;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save theme settings.');
        return null;
      } finally {
        setSavingTheme(false);
      }
    },
    [applyThemeResponse, toast],
  );

  const selectorPayload = useMemo(() => {
    if (selectedPreset.kind === 'system') {
      return { preset_id: selectedPreset.id as PortalThemePresetId };
    }
    return { user_preset_id: selectedPreset.id };
  }, [selectedPreset]);

  const applyPreset = useCallback(async () => {
    await persistTheme({
      mode: 'reset',
      ...selectorPayload,
    });
  }, [persistTheme, selectorPayload]);

  const resetCustomizations = useCallback(async () => {
    await persistTheme({
      mode: 'reset',
      ...selectorPayload,
    });
  }, [persistTheme, selectorPayload]);

  const saveCustomTheme = useCallback(async () => {
    const overrides: Record<string, string> = {};
    for (const field of TOKEN_FIELDS) {
      const normalized = normalizeHexColor(draftTokens[field.key]);
      if (!normalized) {
        toast.error(`Invalid color for ${field.label.toLowerCase()}.`);
        return;
      }
      if (normalized !== normalizeHexColor(selectedPreset.tokens[field.key])) {
        overrides[field.key] = normalized;
      }
    }

    await persistTheme({
      mode: 'replace',
      ...selectorPayload,
      overrides,
    });
  }, [draftTokens, persistTheme, selectedPreset.tokens, selectorPayload, toast]);

  const saveAsPreset = useCallback(async () => {
    const name = validatePresetName(presetName);
    if (name.length < 2) {
      toast.error('Preset name must be at least 2 characters.');
      return;
    }

    const tokens: Record<string, string> = {};
    for (const field of TOKEN_FIELDS) {
      const normalized = normalizeHexColor(draftTokens[field.key]);
      if (!normalized) {
        toast.error(`Invalid color for ${field.label.toLowerCase()}.`);
        return;
      }
      tokens[field.key] = normalized;
    }

    setSavingPreset(true);
    try {
      const res = await fetch('/api/staff/v1/theme/presets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, tokens }),
      });
      const json = (await res.json().catch(() => ({}))) as ThemePresetMutationPayload;
      if (!res.ok || !json.preset) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to create preset.');
      }

      await persistTheme({ mode: 'reset', user_preset_id: json.preset.id });
      toast.success('Preset created.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create preset.');
    } finally {
      setSavingPreset(false);
    }
  }, [draftTokens, persistTheme, presetName, toast]);

  const updateSelectedPreset = useCallback(async () => {
    if (!isSelectedUserPreset) return;

    const name = validatePresetName(presetName || selectedPreset.label);
    if (name.length < 2) {
      toast.error('Preset name must be at least 2 characters.');
      return;
    }

    const tokens: Record<string, string> = {};
    for (const field of TOKEN_FIELDS) {
      const normalized = normalizeHexColor(draftTokens[field.key]);
      if (!normalized) {
        toast.error(`Invalid color for ${field.label.toLowerCase()}.`);
        return;
      }
      tokens[field.key] = normalized;
    }

    setSavingPreset(true);
    try {
      const res = await fetch(`/api/staff/v1/theme/presets/${encodeURIComponent(selectedPreset.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, tokens }),
      });
      const json = (await res.json().catch(() => ({}))) as ThemePresetMutationPayload;
      if (!res.ok || !json.preset) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to update preset.');
      }

      await persistTheme({ mode: 'reset', user_preset_id: selectedPreset.id });
      toast.success('Preset updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update preset.');
    } finally {
      setSavingPreset(false);
    }
  }, [draftTokens, isSelectedUserPreset, persistTheme, presetName, selectedPreset.id, selectedPreset.label, toast]);

  const deleteSelectedPreset = useCallback(async () => {
    if (!isSelectedUserPreset) return;
    if (!window.confirm(`Delete preset "${selectedPreset.label}"?`)) return;

    setSavingPreset(true);
    try {
      const res = await fetch(`/api/staff/v1/theme/presets/${encodeURIComponent(selectedPreset.id)}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => ({}))) as ThemePresetMutationPayload;
      if (!res.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to delete preset.');
      }

      await persistTheme({ mode: 'reset', preset_id: PORTAL_DEFAULT_THEME_PRESET_ID });
      toast.success('Preset deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete preset.');
    } finally {
      setSavingPreset(false);
    }
  }, [isSelectedUserPreset, persistTheme, selectedPreset.id, selectedPreset.label, toast]);

  const updateDraft = useCallback((key: PortalThemeOverrideKey, value: string) => {
    setDraftTokens((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const controlsDisabled = savingTheme || savingPreset || loadingTheme;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="User menu" className={styles.trigger}>
          <CircleUser aria-hidden="true" size={20} strokeWidth={2} className={styles.icon} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className={styles.menuContent}>
        <DropdownMenuLabel>
          <div className={styles.labelContent}>
            <span className={styles.email} title={email ?? ''}>
              {email ?? 'Signed in'}
            </span>
            <span className={styles.role}>{roleLabel ?? 'Admin access'}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className={styles.themeSection} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className={styles.themeHeader}>
            <Palette aria-hidden="true" size={14} strokeWidth={2} />
            <span>Theme</span>
          </div>

          <label className={styles.themeLabel}>
            Preset
            <select
              className={styles.themeSelect}
              value={selectedPresetKey}
              onChange={(e) => {
                const nextKey = e.target.value;
                const nextPreset = options.find((item) => item.key === nextKey);
                if (!nextPreset) return;
                setSelectedPresetKey(nextKey);
                setDraftTokens(nextPreset.tokens);
                setPresetName(nextPreset.kind === 'user' ? nextPreset.label : '');
              }}
              disabled={controlsDisabled}
            >
              <optgroup label="System presets">
                {systemPresets.map((preset) => (
                  <option key={preset.id} value={systemKey(preset.id)}>
                    {preset.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="My presets">
                {userPresets.length ? (
                  userPresets.map((preset) => (
                    <option key={preset.id} value={userKey(preset.id)}>
                      {preset.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No custom presets
                  </option>
                )}
              </optgroup>
            </select>
          </label>

          <div className={styles.themeButtonRow}>
            <button type="button" className={styles.themeButton} onClick={() => void applyPreset()} disabled={controlsDisabled}>
              Use preset
            </button>
            <button type="button" className={styles.themeButton} onClick={() => void resetCustomizations()} disabled={controlsDisabled}>
              <RotateCcw aria-hidden="true" size={12} strokeWidth={2} />
              Reset
            </button>
          </div>

          <label className={styles.themeLabel}>
            Preset name
            <input
              className={styles.themeTextInput}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="My custom preset"
              disabled={controlsDisabled}
            />
          </label>

          <div className={styles.themeButtonRow}>
            <button type="button" className={styles.themeButton} onClick={() => void saveAsPreset()} disabled={controlsDisabled}>
              Save as preset
            </button>
            <button type="button" className={styles.themeButton} onClick={() => void updateSelectedPreset()} disabled={controlsDisabled || !isSelectedUserPreset}>
              Update preset
            </button>
          </div>

          <button
            type="button"
            className={`${styles.themeButton} ${styles.themeDangerButton}`}
            onClick={() => void deleteSelectedPreset()}
            disabled={controlsDisabled || !isSelectedUserPreset}
          >
            <Trash2 aria-hidden="true" size={12} strokeWidth={2} />
            Delete selected preset
          </button>

          <div className={styles.colorGrid}>
            {TOKEN_FIELDS.map((field) => (
              <label key={field.key} className={styles.colorField}>
                <span className={styles.colorLabel}>{field.label}</span>
                <div className={styles.colorInputRow}>
                  <input
                    className={styles.colorPicker}
                    type="color"
                    value={normalizeHexColor(draftTokens[field.key]) || '#000000'}
                    onChange={(e) => updateDraft(field.key, normalizeHexColor(e.target.value) || draftTokens[field.key])}
                    disabled={controlsDisabled}
                  />
                  <input
                    className={styles.colorText}
                    value={draftTokens[field.key]}
                    onChange={(e) => updateDraft(field.key, e.target.value)}
                    onBlur={(e) => updateDraft(field.key, normalizeHexColor(e.target.value) || selectedPreset.tokens[field.key])}
                    disabled={controlsDisabled}
                  />
                </div>
              </label>
            ))}
          </div>

          <button type="button" className={styles.themeSaveButton} onClick={() => void saveCustomTheme()} disabled={controlsDisabled}>
            <Save aria-hidden="true" size={13} strokeWidth={2} />
            Save custom colors
          </button>
          <div className={styles.themeHint}>
            {loadingTheme
              ? 'Loading theme...'
              : savingTheme || savingPreset
                ? 'Saving theme...'
                : hasCustomizations
                  ? 'Unsaved customizations.'
                  : selectedPreset.immutable
                    ? 'System preset selected.'
                    : 'Custom preset selected.'}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={styles.signOutItem}
          onSelect={() => {
            void signOut('/login');
          }}
        >
          <LogOut aria-hidden="true" className={styles.signOutIcon} size={16} strokeWidth={2} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
