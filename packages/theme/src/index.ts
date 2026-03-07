export const BRAND_ACCENT_HEX = '#4f5748' as const;

export const BRAND_ACCENT_RGB = {
  r: 79,
  g: 87,
  b: 72,
} as const;

export const BRAND_ACCENT_RGB_CSV = `${BRAND_ACCENT_RGB.r}, ${BRAND_ACCENT_RGB.g}, ${BRAND_ACCENT_RGB.b}` as const;

export function brandAccentRgba(alpha: number): string {
  const clamped = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  return `rgba(${BRAND_ACCENT_RGB_CSV}, ${clamped})`;
}

export const BRAND_ACCENT_PDF_RGB = {
  r: BRAND_ACCENT_RGB.r / 255,
  g: BRAND_ACCENT_RGB.g / 255,
  b: BRAND_ACCENT_RGB.b / 255,
} as const;
