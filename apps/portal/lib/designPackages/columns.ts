import type { DesignListCellKey } from './types';

type DesignListColumnKind = 'text' | 'date' | 'status' | 'notes';
type DesignListColumnSource = 'request' | 'derived' | 'quote' | 'visit';

type DesignListColumnConfig = {
  key: DesignListCellKey;
  letter: string;
  label: string;
  widthPx: number;
  kind: DesignListColumnKind;
  editable: boolean;
  source: DesignListColumnSource;
  sourceLabel?: string | null;
  frozen?: boolean;
};

export const DESIGN_LIST_COLUMNS: readonly DesignListColumnConfig[] = [
  { key: 'date', letter: 'A', label: 'Date', widthPx: 126, kind: 'date', editable: false, source: 'request', frozen: true },
  { key: 'quote_name', letter: 'B', label: 'Client name', widthPx: 244, kind: 'text', editable: false, source: 'request', frozen: true },
  { key: 'site_visit_rep', letter: 'C', label: 'Site visit rep', widthPx: 118, kind: 'text', editable: false, source: 'visit', sourceLabel: 'Visit' },
  { key: 'designer', letter: 'D', label: 'Designer', widthPx: 104, kind: 'text', editable: true, source: 'request' },
  { key: 'design_ready', letter: 'E', label: 'Design ready', widthPx: 164, kind: 'status', editable: true, source: 'request' },
  { key: 'priority', letter: 'F', label: 'Priority', widthPx: 124, kind: 'status', editable: true, source: 'derived', sourceLabel: 'Derived' },
  { key: 'sent', letter: 'G', label: 'Sent', widthPx: 136, kind: 'date', editable: false, source: 'quote', sourceLabel: 'Quote' },
  { key: 'visited', letter: 'H', label: 'Visited', widthPx: 132, kind: 'text', editable: false, source: 'visit', sourceLabel: 'Visit' },
  { key: 'notes', letter: 'I', label: 'Notes', widthPx: 280, kind: 'notes', editable: true, source: 'request' },
] as const;
