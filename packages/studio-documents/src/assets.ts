import { readFile } from 'node:fs/promises';
import type { PDFDocument } from 'pdf-lib';
import fontkit from '../vendor/fontkit.umd.cjs';
import type { Fonts } from './layout';

const assetCache = new Map<string, Uint8Array>();
async function fontAsset(name: string) {
  const cached = assetCache.get(name);
  if (cached) return cached;
  let bytes: Uint8Array;
  try {
    bytes = await readFile(new URL(`../assets/fonts/${name}`, import.meta.url));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    bytes = await readFile(new URL(`./assets/fonts/${name}`, import.meta.url));
  }
  assetCache.set(name, bytes);
  return bytes;
}
/** Actual heading ink bounds keep leader tails close to glyphs rather than
 * the unused width of a label column. Uses the same packaged Inter asset. */
export async function headingInkBounds(value: string, size: number) {
  const font = fontkit.create(await fontAsset('Inter-Medium.ttf'));
  const run = font.layout(value);
  let advance = 0,
    left = Infinity,
    right = -Infinity;
  for (let index = 0; index < run.glyphs.length; index++) {
    const bounds = run.glyphs[index].bbox,
      position = run.positions[index];
    left = Math.min(left, advance + position.xOffset + bounds.minX);
    right = Math.max(right, advance + position.xOffset + bounds.maxX);
    advance += position.xAdvance;
  }
  return {
    left: (left / font.unitsPerEm) * size,
    right: (right / font.unitsPerEm) * size,
  };
}
export async function fonts(pdf: PDFDocument): Promise<Fonts> {
  pdf.registerFontkit(fontkit);
  const [regular, medium, semibold] = await Promise.all(
    ['Inter-Regular.ttf', 'Inter-Medium.ttf', 'Inter-SemiBold.ttf'].map(
      fontAsset,
    ),
  );
  return {
    regular: await pdf.embedFont(regular, { subset: true }),
    medium: await pdf.embedFont(medium, { subset: true }),
    semibold: await pdf.embedFont(semibold, { subset: true }),
  };
}
