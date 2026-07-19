import type { CutListRow } from './infillTakeoffPresentation';

type InfillCutListDisplayRow = {
  row: CutListRow;
  description: string | null;
  measurement: string;
  detail: string;
};

function formatLengthValue(lengthM?: number | { min: number; max: number }): string {
  if (lengthM === undefined) return '—';
  if (typeof lengthM === 'number') return `${lengthM.toFixed(3)}m`;
  return `${lengthM.min.toFixed(3)}m to ${lengthM.max.toFixed(3)}m`;
}

function cleanDescription(notes?: string): string | null {
  if (!notes) return null;
  const cleaned = notes
    .replace(/;\s*/g, ' · ')
    .replace(/\.\s*$/, '')
    .replace(/^./, (character) => character.toUpperCase());
  return cleaned || null;
}

function formatAllocatedStock(value?: string): string {
  if (!value) return 'Not allocated';
  const match = value.match(/^(.*) stock #(\d+)$/);
  return match ? `Stock ${match[2]} · ${match[1]}` : value;
}

function formatPlannedUse(notes?: string): string {
  if (!notes) return '—';
  const match = notes.match(/^(\d+) allocated cut\(s\); waste (.+)\.$/);
  if (!match) return cleanDescription(notes) ?? '—';
  const count = Number(match[1]);
  return `${count} ${count === 1 ? 'cut' : 'cuts'} allocated · ${match[2]} waste`;
}

export function buildInfillCutListDisplayRows(
  rows: CutListRow[],
  group: CutListRow['group'],
): InfillCutListDisplayRow[] {
  return rows
    .filter((row) => row.group === group)
    .map((row) => {
      if (group === 'piece') {
        const hasFinishedPanelSize = row.finishedWidthM !== undefined && row.finishedHeightM !== undefined;
        return {
          row,
          description: cleanDescription(row.notes),
          measurement: hasFinishedPanelSize
            ? `${row.finishedWidthM?.toFixed(3)}m × ${row.finishedHeightM?.toFixed(3)}m`
            : formatLengthValue(row.lengthM),
          detail: formatAllocatedStock(row.allocatedStock),
        };
      }

      const hasStockWidth = row.finishedWidthM !== undefined;
      return {
        row,
        description: row.allocatedStock ? `Allocated to ${row.allocatedStock}` : null,
        measurement: hasStockWidth
          ? `${formatLengthValue(row.lengthM)} × ${row.finishedWidthM?.toFixed(3)}m`
          : formatLengthValue(row.lengthM),
        detail: formatPlannedUse(row.notes),
      };
    });
}
