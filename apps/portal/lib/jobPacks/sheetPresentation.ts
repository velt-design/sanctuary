import type {SpreadsheetColumn} from '@/components/spreadsheet/types';
import type {JobPackCellKey,JobPackSheetKey} from './workbook';
function makeColumns(
  defs: Array<{ key: JobPackCellKey; label: string; widthPx: number; frozen?: boolean; sourceLabel?: string | null }>,
): SpreadsheetColumn<JobPackCellKey>[] {
  return defs.map((def, index) => ({
    ...def,
    editable: false,
    frozen: def.frozen ?? index === 0,
    letter: String.fromCharCode(65 + index),
    sourceLabel: def.sourceLabel ?? null,
  }));
}

/** Data-independent UI column ownership, shared by complete and pending workbooks. */
export function jobPackSheetPresentation(sheet:JobPackSheetKey,hasChangesColumn=false):{columns:SpreadsheetColumn<JobPackCellKey>[];notesColumnKey?:JobPackCellKey;notesToggleColumnKeys?:JobPackCellKey[]}{
 switch(sheet){
 case 'summary':return {notesColumnKey:'c',columns:makeColumns([
      { key: 'a', label: 'Field', widthPx: 220 },
      { key: 'b', label: 'Value', widthPx: 360 },
      { key: 'c', label: 'Notes', widthPx: 240 },
])};
 case 'materials':return {notesColumnKey:'f',columns:makeColumns([
      { key: 'a', label: 'Item', widthPx: 280 },
      { key: 'b', label: 'Colour', widthPx: 160 },
      { key: 'c', label: 'Stock length', widthPx: 140 },
      { key: 'd', label: 'Qty', widthPx: 110 },
      { key: 'e', label: 'Unit', widthPx: 100 },
      { key: 'f', label: 'Notes', widthPx: 320 },
])};
 case 'powdercoating-order':return {notesColumnKey:'f',notesToggleColumnKeys:hasChangesColumn?['g','f']:['f'],columns:makeColumns([
      { key: 'a', label: 'Profile', widthPx: 280 },
      { key: 'b', label: 'Colour', widthPx: 160 },
      { key: 'c', label: 'Stock length', widthPx: 140 },
      { key: 'd', label: 'Qty', widthPx: 110 },
      { key: 'e', label: 'Unit', widthPx: 100 },
      ...(hasChangesColumn ? [{ key: 'g' as const, label: 'Changes', widthPx: 300 }] : []),
      { key: 'f', label: 'Notes', widthPx: 320 },
])};
 case 'labour':return {columns:makeColumns([
      { key: 'a', label: 'Action', widthPx: 280 },
      { key: 'b', label: 'Scope', widthPx: 240 },
      { key: 'c', label: 'Qty', widthPx: 100 },
      { key: 'd', label: 'Unit', widthPx: 90 },
      { key: 'e', label: 'Minutes', widthPx: 110 },
      { key: 'f', label: 'Cost ex GST', widthPx: 150 },
      { key: 'g', label: 'Category', widthPx: 180 },
])};
 case 'overheads':return {notesColumnKey:'c',columns:makeColumns([
      { key: 'a', label: 'Field', widthPx: 220 },
      { key: 'b', label: 'Value', widthPx: 220 },
      { key: 'c', label: 'Notes', widthPx: 320 },
])};
 case 'inputs':return {notesColumnKey:'c',columns:makeColumns([
      { key: 'a', label: 'Field', widthPx: 240 },
      { key: 'b', label: 'Value', widthPx: 260 },
      { key: 'c', label: 'Notes', widthPx: 260 },
])};
 }
}
