import { BRAND_ACCENT_HEX, BRAND_ACCENT_PDF_RGB } from '@sp/theme';

export const SANCTUARY_ARTIFACT_BRAND = {
  colors: {
    accent: BRAND_ACCENT_HEX,
    canvas: '#F4F1EA',
    paper: '#FBFAF7',
    paperStrong: '#FFFFFF',
    ink: '#20221F',
    inkMuted: '#666960',
    rule: '#D8D4C9',
    ruleStrong: '#A9AA9F',
    positive: '#355C3D',
    warning: '#7B4B31',
  },
  pdf: {
    accent: BRAND_ACCENT_PDF_RGB,
  },
  fonts: {
    display: '"Instrument Sans Variable", "Instrument Sans", "Helvetica Neue", Arial, sans-serif',
    body: '"Inter Variable", Inter, Arial, sans-serif',
  },
} as const;
