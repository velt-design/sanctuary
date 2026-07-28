import { readFile } from 'node:fs/promises';

export const QUOTE_PDF_FONT_FILES = {
  regular: 'Inter-Regular.ttf',
  medium: 'Inter-Medium.ttf',
  semibold: 'Inter-SemiBold.ttf',
} as const;

export const QUOTE_PDF_LOGO_FILE = 'sp_dark_icon.png';

const fontCache = new Map<string, Uint8Array>();
const imageCache = new Map<string, Uint8Array | null>();

function fontAssetUrl(filename: string): URL | null {
  switch (filename) {
    case QUOTE_PDF_FONT_FILES.regular:
      return new URL('../../assets/fonts/Inter-Regular.ttf', import.meta.url);
    case QUOTE_PDF_FONT_FILES.medium:
      return new URL('../../assets/fonts/Inter-Medium.ttf', import.meta.url);
    case QUOTE_PDF_FONT_FILES.semibold:
      return new URL('../../assets/fonts/Inter-SemiBold.ttf', import.meta.url);
    default:
      return null;
  }
}

function imageAssetUrl(filename: string): URL | null {
  switch (filename) {
    case QUOTE_PDF_LOGO_FILE:
      return new URL('../../public/images/sp_dark_icon.png', import.meta.url);
    default:
      return null;
  }
}

export async function readQuotePdfFont(filename: string): Promise<Uint8Array> {
  const cached = fontCache.get(filename);
  if (cached) return cached;

  const assetUrl = fontAssetUrl(filename);
  if (!assetUrl) throw new Error(`Missing font asset mapping for ${filename}`);

  try {
    const bytes = await readFile(assetUrl);
    fontCache.set(filename, bytes);
    return bytes;
  } catch (error) {
    throw new Error(`Missing font file ${filename}. Last error: ${String(error)}`);
  }
}

export async function readQuotePdfImage(filename: string): Promise<Uint8Array | null> {
  if (imageCache.has(filename)) return imageCache.get(filename) ?? null;

  const assetUrl = imageAssetUrl(filename);
  if (!assetUrl) {
    imageCache.set(filename, null);
    return null;
  }

  try {
    const bytes = await readFile(assetUrl);
    imageCache.set(filename, bytes);
    return bytes;
  } catch {
    imageCache.set(filename, null);
    return null;
  }
}
