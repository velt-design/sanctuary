const DESIGN_BOOKLET_BULLET_MARKER = "- ";
export const DESIGN_BOOKLET_BULLET_GLYPH = "\u2022";

export const DESIGN_BOOKLET_BULLET_GEOMETRY = {
  markerWidth: 8,
  markerGap: 3.5,
  textInset: 11.5,
} as const;

type DesignBookletEditorialBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] };

export type DesignBookletTextSelection = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const BULLET_LINE = /^\s*(?:[-*\u2022])(?:\s+|$)(.*)$/;

function normalizedLines(value: string): string[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function designBookletBulletItem(line: string): string | null {
  const match = BULLET_LINE.exec(line);
  return match ? match[1].trim() : null;
}

export function parseDesignBookletEditorialText(
  value: string,
): DesignBookletEditorialBlock[] {
  const blocks: DesignBookletEditorialBlock[] = [];

  for (const line of normalizedLines(value)) {
    const bullet = designBookletBulletItem(line);
    const previous = blocks.at(-1);
    if (bullet !== null) {
      if (previous?.kind === "bullets") {
        previous.items.push(bullet);
      } else {
        blocks.push({ kind: "bullets", items: [bullet] });
      }
      continue;
    }

    if (previous?.kind === "paragraph") {
      previous.text += `\n${line}`;
    } else {
      blocks.push({ kind: "paragraph", text: line });
    }
  }

  return blocks;
}

export function designBookletEditorialTextWeight(value: string): number {
  return (
    value.trim().length +
    normalizedLines(value).filter(
      (line) => designBookletBulletItem(line) !== null,
    ).length *
      10
  );
}

function selectedLineRange(
  value: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const safeStart = Math.max(0, Math.min(selectionStart, value.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, value.length));
  const start = value.lastIndexOf("\n", safeStart - 1) + 1;
  const effectiveEnd =
    safeEnd > safeStart && value[safeEnd - 1] === "\n" ? safeEnd - 1 : safeEnd;
  const nextBreak = value.indexOf("\n", effectiveEnd);
  const end = nextBreak === -1 ? value.length : nextBreak;
  return { start, end, safeStart, safeEnd };
}

function removeBulletMarker(line: string): string {
  return line.replace(/^(\s*)(?:[-*\u2022])(?:\s+|$)/, "$1");
}

export function toggleDesignBookletBullets(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  maxLength?: number,
): DesignBookletTextSelection {
  const range = selectedLineRange(value, selectionStart, selectionEnd);
  const selected = value.slice(range.start, range.end);
  const lines = selected.split("\n");
  const nonEmpty = lines.filter((line) => line.trim());
  const removing =
    nonEmpty.length > 0 &&
    nonEmpty.every((line) => designBookletBulletItem(line) !== null);
  const nextSelected =
    nonEmpty.length === 0 && range.safeStart === range.safeEnd
      ? DESIGN_BOOKLET_BULLET_MARKER
      : lines
          .map((line) => {
            if (!line.trim()) return line;
            if (removing) return removeBulletMarker(line);
            const existingItem = designBookletBulletItem(line);
            return `${DESIGN_BOOKLET_BULLET_MARKER}${
              existingItem ?? line.trimStart()
            }`;
          })
          .join("\n");
  const nextValue =
    value.slice(0, range.start) + nextSelected + value.slice(range.end);

  if (maxLength !== undefined && nextValue.length > maxLength) {
    return {
      value,
      selectionStart: range.safeStart,
      selectionEnd: range.safeEnd,
    };
  }

  if (range.safeStart === range.safeEnd) {
    const oldLine = value.slice(range.start, range.end);
    const nextLine = nextSelected;
    const markerDelta = nextLine.length - oldLine.length;
    return {
      value: nextValue,
      selectionStart: Math.max(range.start, range.safeStart + markerDelta),
      selectionEnd: Math.max(range.start, range.safeStart + markerDelta),
    };
  }

  return {
    value: nextValue,
    selectionStart: range.start,
    selectionEnd: range.start + nextSelected.length,
  };
}

export function continueDesignBookletBullet(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  maxLength?: number,
): DesignBookletTextSelection | null {
  if (selectionStart !== selectionEnd) return null;
  const range = selectedLineRange(value, selectionStart, selectionEnd);
  const line = value.slice(range.start, range.end);
  const item = designBookletBulletItem(line);
  if (item === null) return null;

  if (!item && selectionStart >= range.start + line.length) {
    const nextValue = value.slice(0, range.start) + value.slice(range.end);
    return {
      value: nextValue,
      selectionStart: range.start,
      selectionEnd: range.start,
    };
  }

  const insertion = `\n${DESIGN_BOOKLET_BULLET_MARKER}`;
  const nextValue =
    value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);
  if (maxLength !== undefined && nextValue.length > maxLength) return null;
  const caret = selectionStart + insertion.length;
  return { value: nextValue, selectionStart: caret, selectionEnd: caret };
}
