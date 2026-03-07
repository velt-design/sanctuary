'use client';

import { CircleUser, LogOut, Palette, RotateCcw, Save } from 'lucide-react';
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
import { PORTAL_THEME_PRESETS } from '@/lib/theme/presets';
import type { PortalResolvedTheme, PortalThemeOverrideKey, PortalThemePresetId, PortalThemeTokens } from '@/lib/theme/types';
import { normalizeHexColor } from '@/lib/theme/utils';

type ThemePreset = {
  id: PortalThemePresetId;
  label: string;
  tokens: PortalThemeTokens;
};

type ThemeApiPayload = {
  ok: boolean;
  presets?: ThemePreset[];
  theme?: PortalResolvedTheme;
  missing_table?: boolean;
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

const DEFAULT_PRESETS: ThemePreset[] = PORTAL_THEME_PRESETS.map((preset) => ({ ...preset }));

function toPresetList(raw: unknown): ThemePreset[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_PRESETS;
  const next: ThemePreset[] = [];
  for (const item of raw as any[]) {
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
    });
  }
  return next.length ? next : DEFAULT_PRESETS;
}

function normalizeDraftTokens(raw: unknown, fallback: PortalThemeTokens): PortalThemeTokens {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Partial<PortalThemeTokens> = {};
  for (const field of TOKEN_FIELDS) {
    out[field.key] = normalizeHexColor(source[field.key]) || fallback[field.key];
  }
  return out as PortalThemeTokens;
}

export default function UserMenu({ email, roleLabel }: { email?: string; roleLabel?: string }) {
  const { signOut } = usePortalSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loadingTheme, setLoadingTheme] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [presets, setPresets] = useState<ThemePreset[]>(DEFAULT_PRESETS);
  const [presetId, setPresetId] = useState<PortalThemePresetId>('sanctuary-burgundy');
  const [draftTokens, setDraftTokens] = useState<PortalThemeTokens>(DEFAULT_PRESETS[0].tokens);

  const selectedPreset = useMemo(() => presets.find((preset) => preset.id === presetId) ?? presets[0] ?? DEFAULT_PRESETS[0], [presetId, presets]);

  const hasCustomizations = useMemo(() => {
    for (const field of TOKEN_FIELDS) {
      if (normalizeHexColor(draftTokens[field.key]) !== normalizeHexColor(selectedPreset.tokens[field.key])) {
        return true;
      }
    }
    return false;
  }, [draftTokens, selectedPreset.tokens]);

  const applyThemeResponse = useCallback((json: ThemeApiPayload) => {
    const nextPresets = toPresetList(json.presets);
    const fallbackPreset = nextPresets[0] ?? DEFAULT_PRESETS[0];
    const nextPresetId = (json.theme?.preset_id as PortalThemePresetId) || fallbackPreset.id;
    const nextSelectedPreset = nextPresets.find((preset) => preset.id === nextPresetId) ?? fallbackPreset;
    const nextTokens = normalizeDraftTokens(json.theme?.tokens, nextSelectedPreset.tokens);

    setPresets(nextPresets);
    setPresetId(nextSelectedPreset.id);
    setDraftTokens(nextTokens);

    if (json.theme) {
      applyPortalThemeToDocument(json.theme);
    } else {
      applyPortalThemeToDocument({
        tokens: nextTokens,
        accent_rgb_csv: '129, 63, 57',
      });
    }
  }, []);

  const loadTheme = useCallback(async () => {
    setLoadingTheme(true);
    try {
      const res = await fetch('/api/staff/v1/theme', {
        method: 'GET',
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as ThemeApiPayload;
      if (!res.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load theme settings.');
      }
      if (json.missing_table) {
        toast.error('Theme settings table is missing. Run latest migrations to save per-user themes.');
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
    async (payload: { mode: 'replace' | 'reset'; preset_id?: PortalThemePresetId; overrides?: Record<string, string> }) => {
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save theme settings.');
      } finally {
        setSavingTheme(false);
      }
    },
    [applyThemeResponse, toast],
  );

  const applyPreset = useCallback(async () => {
    await persistTheme({
      mode: 'reset',
      preset_id: presetId,
    });
  }, [persistTheme, presetId]);

  const resetCustomizations = useCallback(async () => {
    await persistTheme({
      mode: 'reset',
      preset_id: presetId,
    });
  }, [persistTheme, presetId]);

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
      preset_id: presetId,
      overrides,
    });
  }, [draftTokens, persistTheme, presetId, selectedPreset.tokens, toast]);

  const updateDraft = useCallback((key: PortalThemeOverrideKey, value: string) => {
    setDraftTokens((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="User menu" className={styles.trigger}>
          <CircleUser aria-hidden="true" size={22} strokeWidth={2} className={styles.icon} />
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
              value={presetId}
              onChange={(e) => {
                const next = e.target.value as PortalThemePresetId;
                setPresetId(next);
                const preset = presets.find((item) => item.id === next);
                if (preset) setDraftTokens(preset.tokens);
              }}
              disabled={savingTheme || loadingTheme}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.themeButtonRow}>
            <button type="button" className={styles.themeButton} onClick={() => void applyPreset()} disabled={savingTheme || loadingTheme}>
              Use preset
            </button>
            <button type="button" className={styles.themeButton} onClick={() => void resetCustomizations()} disabled={savingTheme || loadingTheme}>
              <RotateCcw aria-hidden="true" size={12} strokeWidth={2} />
              Reset
            </button>
          </div>

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
                    disabled={savingTheme || loadingTheme}
                  />
                  <input
                    className={styles.colorText}
                    value={draftTokens[field.key]}
                    onChange={(e) => updateDraft(field.key, e.target.value)}
                    onBlur={(e) => updateDraft(field.key, normalizeHexColor(e.target.value) || selectedPreset.tokens[field.key])}
                    disabled={savingTheme || loadingTheme}
                  />
                </div>
              </label>
            ))}
          </div>

          <button type="button" className={styles.themeSaveButton} onClick={() => void saveCustomTheme()} disabled={savingTheme || loadingTheme}>
            <Save aria-hidden="true" size={13} strokeWidth={2} />
            Save custom colors
          </button>
          <div className={styles.themeHint}>
            {loadingTheme ? 'Loading theme...' : savingTheme ? 'Saving theme...' : hasCustomizations ? 'Unsaved customizations.' : 'Preset applied.'}
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
