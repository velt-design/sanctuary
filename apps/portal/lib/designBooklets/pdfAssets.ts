import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DESIGN_BOOKLET_PDF_FONT_FILES = {
  regular: "Inter-Regular.ttf",
  medium: "Inter-Medium.ttf",
  semibold: "Inter-SemiBold.ttf",
} as const;

const fontCache = new Map<string, Uint8Array>();
const imageCache = new Map<string, Uint8Array>();

function fontAssetUrl(filename: string): URL | null {
  switch (filename) {
    case DESIGN_BOOKLET_PDF_FONT_FILES.regular:
      return new URL("../../assets/fonts/Inter-Regular.ttf", import.meta.url);
    case DESIGN_BOOKLET_PDF_FONT_FILES.medium:
      return new URL("../../assets/fonts/Inter-Medium.ttf", import.meta.url);
    case DESIGN_BOOKLET_PDF_FONT_FILES.semibold:
      return new URL("../../assets/fonts/Inter-SemiBold.ttf", import.meta.url);
    default:
      return null;
  }
}

function imageAssetUrl(filename: string): URL | null {
  switch (filename) {
    case "booklet-toni-01.png":
      return new URL(
        "../../public/images/design-booklets/toni/booklet-toni-01.png",
        import.meta.url,
      );
    case "booklet-toni-02.png":
      return new URL(
        "../../public/images/design-booklets/toni/booklet-toni-02.png",
        import.meta.url,
      );
    case "booklet-toni-03.png":
      return new URL(
        "../../public/images/design-booklets/toni/booklet-toni-03.png",
        import.meta.url,
      );
    case "booklet-toni-plan.png":
      return new URL(
        "../../public/images/design-booklets/toni/booklet-toni-plan.png",
        import.meta.url,
      );
    default:
      return null;
  }
}

function assetFilePath(assetUrl: URL): string {
  const href = String(assetUrl.href);
  if (href.startsWith("file:")) return fileURLToPath(href);

  const pathname = String(assetUrl.pathname);
  if (!pathname.startsWith("/_next/static/media/")) {
    throw new Error(`Unsupported design booklet asset URL ${href}`);
  }

  const configuredDistDir =
    process.env.PORTAL_PLAYWRIGHT_DIST_DIR?.trim() || ".next";
  const serverOutputRoot =
    process.env.NODE_ENV === "development"
      ? path.resolve(
          /*turbopackIgnore: true*/ process.cwd(),
          configuredDistDir,
          "dev",
          "server",
        )
      : path.resolve(
          /*turbopackIgnore: true*/ process.cwd(),
          configuredDistDir,
          "server",
        );

  return path.join(
    serverOutputRoot,
    "static",
    "media",
    path.posix.basename(pathname),
  );
}

async function readMappedAsset(assetUrl: URL): Promise<Uint8Array> {
  return readFile(/*turbopackIgnore: true*/ assetFilePath(assetUrl));
}

export async function readDesignBookletPdfFont(
  filename: string,
): Promise<Uint8Array> {
  const cached = fontCache.get(filename);
  if (cached) return cached;

  const assetUrl = fontAssetUrl(filename);
  if (!assetUrl)
    throw new Error(`Missing design booklet font mapping ${filename}`);

  try {
    const bytes = await readMappedAsset(assetUrl);
    fontCache.set(filename, bytes);
    return bytes;
  } catch (error) {
    throw new Error(
      `Missing design booklet font ${filename} at ${String(assetUrl.href)}. Last error: ${String(error)}`,
    );
  }
}

export async function readDesignBookletDefaultImage(
  filename: string,
): Promise<Uint8Array> {
  const cached = imageCache.get(filename);
  if (cached) return cached;

  const assetUrl = imageAssetUrl(filename);
  if (!assetUrl) {
    throw new Error(`Missing bundled design booklet image mapping ${filename}`);
  }

  try {
    const bytes = await readMappedAsset(assetUrl);
    imageCache.set(filename, bytes);
    return bytes;
  } catch (error) {
    throw new Error(
      `Missing bundled design booklet image ${filename} at ${String(assetUrl.href)}. Last error: ${String(error)}`,
    );
  }
}
