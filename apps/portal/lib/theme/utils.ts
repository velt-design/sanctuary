import { PORTAL_THEME_OVERRIDE_KEYS } from './types';
import type { HexColor, PortalThemeOverrideKey, PortalThemeOverrides, PortalThemeTokens } from './types';

const OVERRIDE_KEY_SET = new Set<string>(PORTAL_THEME_OVERRIDE_KEYS);

export function normalizeHexColor(raw: unknown): HexColor | '' {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return '';
  const match = value.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return '';
  const body = match[1].toUpperCase();
  if (body.length === 3) {
    return `#${body
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}` as HexColor;
  }
  return `#${body}` as HexColor;
}

export function hexToRgbCsv(hex: string): string {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return '';
  const body = normalized.slice(1);
  const r = Number.parseInt(body.slice(0, 2), 16);
  const g = Number.parseInt(body.slice(2, 4), 16);
  const b = Number.parseInt(body.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function sanitizePortalThemeOverrides(raw: unknown): {
  overrides: PortalThemeOverrides;
  invalid_keys: string[];
  invalid_values: string[];
} {
  const overrides: PortalThemeOverrides = {};
  const invalidKeySet = new Set<string>();
  const invalidValueSet = new Set<string>();

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { overrides, invalid_keys: [], invalid_values: [] };
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!OVERRIDE_KEY_SET.has(key)) {
      invalidKeySet.add(key);
      continue;
    }
    const normalized = normalizeHexColor(value);
    if (!normalized) {
      invalidValueSet.add(key);
      continue;
    }
    overrides[key as PortalThemeOverrideKey] = normalized;
  }

  return {
    overrides,
    invalid_keys: Array.from(invalidKeySet),
    invalid_values: Array.from(invalidValueSet),
  };
}

export function sanitizePortalThemeTokens(raw: unknown): {
  tokens: Partial<PortalThemeTokens>;
  invalid_keys: string[];
  invalid_values: string[];
  missing_keys: string[];
} {
  const sanitized = sanitizePortalThemeOverrides(raw);
  const missingKeys = PORTAL_THEME_OVERRIDE_KEYS.filter((key) => !sanitized.overrides[key]);
  return {
    tokens: sanitized.overrides,
    invalid_keys: sanitized.invalid_keys,
    invalid_values: sanitized.invalid_values,
    missing_keys: missingKeys,
  };
}
