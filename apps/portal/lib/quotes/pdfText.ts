import type { PDFFont } from "pdf-lib";

function splitLongToken(
  font: PDFFont,
  token: string,
  size: number,
  maxWidth: number,
): string[] {
  if (font.widthOfTextAtSize(token, size) <= maxWidth) return [token];
  const fragments: string[] = [];
  let fragment = "";
  for (const char of token) {
    const candidate = `${fragment}${char}`;
    if (fragment && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      fragments.push(fragment);
      fragment = char;
    } else {
      fragment = candidate;
    }
  }
  if (fragment) fragments.push(fragment);
  return fragments;
}

export function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  if (maxWidth <= 0) return [text];
  const wrapped: string[] = [];
  for (const paragraph of String(text ?? "").split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrapped.push("");
      continue;
    }

    let line = "";
    for (const rawWord of words) {
      const parts = splitLongToken(font, rawWord, size, maxWidth);
      for (const part of parts) {
        const candidate = line ? `${line} ${part}` : part;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
        } else {
          if (line) wrapped.push(line);
          line = part;
        }
      }
    }
    if (line) wrapped.push(line);
  }
  return wrapped;
}
