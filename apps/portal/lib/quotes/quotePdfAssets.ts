import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function assetFilePath(assetUrl: URL): string {
  const href = String(assetUrl.href);
  if (href.startsWith('file:')) return fileURLToPath(href);

  const pathname = String(assetUrl.pathname);
  if (!pathname.startsWith('/_next/static/media/')) {
    throw new Error(`Unsupported quote PDF asset URL ${href}`);
  }

  const configuredDistDir =
    process.env.PORTAL_PLAYWRIGHT_DIST_DIR?.trim() || '.next';
  const serverOutputRoot =
    process.env.NODE_ENV === 'development'
      ? path.resolve(
          /*turbopackIgnore: true*/ process.cwd(),
          configuredDistDir,
          'dev',
          'server',
        )
      : path.resolve(
          /*turbopackIgnore: true*/ process.cwd(),
          configuredDistDir,
          'server',
        );
  return path.join(
    serverOutputRoot,
    'static',
    'media',
    path.posix.basename(pathname),
  );
}

export async function readQuotePdfFont(filename: string): Promise<Uint8Array> {
  const cached = fontCache.get(filename);
  if (cached) return cached;

  const assetUrl = fontAssetUrl(filename);
  if (!assetUrl) throw new Error(`Missing font asset mapping for ${filename}`);

  try {
    const bytes = await readFile(
      /*turbopackIgnore: true*/ assetFilePath(assetUrl),
    );
    fontCache.set(filename, bytes);
    return bytes;
  } catch (error) {
    throw new Error(
      `Missing font file ${filename} at ${String(assetUrl.href)}. Last error: ${String(error)}`,
    );
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
    const bytes = await readFile(
      /*turbopackIgnore: true*/ assetFilePath(assetUrl),
    );
    imageCache.set(filename, bytes);
    return bytes;
  } catch {
    imageCache.set(filename, null);
    return null;
  }
}
