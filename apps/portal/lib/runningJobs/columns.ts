import type { RunningJobCellKey } from './types';

export type RunningJobsColumnKind = 'text' | 'date' | 'boolean' | 'status' | 'number' | 'notes';

export type RunningJobsColumnConfig = {
  key: RunningJobCellKey;
  letter: string;
  label: string;
  widthPx: number;
  kind: RunningJobsColumnKind;
  editable: boolean;
  frozen?: boolean;
};

export const RUNNING_JOBS_COLUMNS: readonly RunningJobsColumnConfig[] = [
  { key: 'client_name', letter: 'A', label: 'Client name', widthPx: 220, kind: 'text', editable: true, frozen: true },
  { key: 'phone_number', letter: 'B', label: 'Phone', widthPx: 148, kind: 'text', editable: true, frozen: true },
  { key: 'site_address', letter: 'C', label: 'Site address', widthPx: 280, kind: 'text', editable: true, frozen: true },
  { key: 'site_visit_rep', letter: 'D', label: 'Site visit rep', widthPx: 112, kind: 'text', editable: true },
  { key: 'deposit_paid_date', letter: 'E', label: 'Deposit paid', widthPx: 136, kind: 'date', editable: true },
  { key: 'materials_ordered', letter: 'F', label: 'Materials ordered', widthPx: 132, kind: 'boolean', editable: true },
  { key: 'pergola_type', letter: 'G', label: 'Pergola type', widthPx: 188, kind: 'text', editable: false },
  { key: 'estimated_start_date', letter: 'H', label: 'Estimated start', widthPx: 140, kind: 'date', editable: false },
  { key: 'final_payment_date', letter: 'I', label: 'Final paid', widthPx: 128, kind: 'date', editable: true },
  { key: 'job_assigned_to', letter: 'J', label: 'Crew', widthPx: 104, kind: 'text', editable: false },
  { key: 'job_completed', letter: 'K', label: 'Completed', widthPx: 112, kind: 'boolean', editable: false },
  { key: 'lights_status', letter: 'L', label: 'Lights', widthPx: 96, kind: 'status', editable: true },
  { key: 'blinds_status', letter: 'M', label: 'Blinds', widthPx: 96, kind: 'status', editable: false },
  { key: 'install_days', letter: 'N', label: 'Install days', widthPx: 112, kind: 'number', editable: false },
  { key: 'size_text', letter: 'O', label: 'Size', widthPx: 156, kind: 'text', editable: false },
  { key: 'colour_text', letter: 'P', label: 'Colour', widthPx: 150, kind: 'text', editable: false },
  { key: 'roofing_text', letter: 'Q', label: 'Roofing', widthPx: 180, kind: 'text', editable: false },
  { key: 'roofing_ordered', letter: 'R', label: 'Roofing ordered', widthPx: 132, kind: 'boolean', editable: true },
  { key: 'running_notes', letter: 'S', label: 'Notes', widthPx: 260, kind: 'notes', editable: true },
] as const;
