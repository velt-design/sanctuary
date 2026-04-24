import { apiJson } from '@/lib/repo/apiClient';

export type ScheduleBoardCrew = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_active?: boolean | null;
  calendar_region?: string | null;
  base_available_date?: string | null;
  next_available_date?: string | null;
};

export type ScheduleBoardJob = {
  id: string;
  job_id: string;
  crew_id: string;
  mode: 'floating' | 'pinned';
  planned_commitment_type: 'week_of' | 'fixed_date' | null;
  planned_week_start: string | null;
  planned_start: string | null;
  planned_duration_days: number | null;
  planned_flex_days: number | null;
  planned_locked_at?: string | null;
  planned_locked_by?: string | null;
  drift_days?: number | null;
  client_update_status?: 'none' | 'needed' | 'acknowledged' | null;
  client_update_needed_at?: string | null;
  client_update_ack_at?: string | null;
  client_update_ack_by?: string | null;
  forecast_start: string | null;
  forecast_end_exclusive: string | null;
  forecast_duration_days: number;
  actual_start: string | null;
  actual_finish: string | null;
  status: 'not_started' | 'in_progress' | 'paused' | 'done' | null;
  days_remaining: number | null;
};

export type ScheduleBoardItem = {
  id: string;
  item_type: 'job' | 'downtime';
  position: number;
  start: string;
  end_exclusive: string;
  duration_days: number;
  job: ScheduleBoardJob | null;
  downtime: {
    id: string;
    crew_id: string;
    duration_days: number;
    reason?: string;
    note?: string | null;
  } | null;
};

export type ScheduleBoardResponse = {
  generated_at: string;
  crews: ScheduleBoardCrew[];
  schedule: Array<{ crew_id: string; items: ScheduleBoardItem[]; conflicts: any[]; next_available_date: string }>;
  project_index?: Array<{
    id: string;
    name: string;
    pipeline_stage: string | null;
    follow_up_date: string | null;
  }>;
  unscheduled_jobs: Array<{ job_id: string; estimate_id: string; project_name: string; status: string; duration_days: number }>;
  conflicts: any[];
  scheduled_estimate_ids?: Record<string, string>;
  holidays?: Array<{ date: string; name?: string; scope: string; region?: string | null }>;
  closures?: Array<{ date: string; name?: string; region?: string | null }>;
};

export type ScheduleGanttResponse = {
  generated_at: string;
  range_start: string;
  range_end: string;
  crews: ScheduleBoardCrew[];
  items: Array<ScheduleBoardItem & { crew_id: string }>;
  project_index?: Array<{
    id: string;
    name: string;
    pipeline_stage: string | null;
    follow_up_date: string | null;
  }>;
  scheduled_estimate_ids?: Record<string, string>;
  holidays: Array<{ date: string; name?: string; scope: string; region?: string | null }>;
  closures: Array<{ date: string; name?: string; region?: string | null }>;
  conflicts: any[];
};

export type RequiresConfirmation<T = Record<string, unknown>> = { requires_confirmation: true; impacts: any[] } & Partial<T>;
export type FinishEarlyPrompt<T = Record<string, unknown>> = {
  requires_finish_early: true;
  freed_days: number;
  actual_finish: string;
  forecast_end_exclusive: string | null;
  impacts: any[];
} & Partial<T>;
export type MutationResult<T = Record<string, unknown>> = { ok: true } & Partial<T>;
export type ScheduleCrewSchedule = { crew_id: string; items: ScheduleBoardItem[]; conflicts: any[]; next_available_date: string };
export type ScheduleMutationResult<T = Record<string, unknown>> = MutationResult<
  T & {
    crew_id?: string;
    schedule?: ScheduleCrewSchedule;
    conflicts?: any[];
    next_available_date?: string;
    source_crew_id?: string;
    source_schedule?: ScheduleCrewSchedule;
  }
>;

export async function fetchScheduleBoard(params?: { today?: string }): Promise<ScheduleBoardResponse> {
  const query = params?.today ? `?today=${encodeURIComponent(params.today)}` : '';
  return apiJson<ScheduleBoardResponse>(`/api/staff/v1/schedule/board${query}`, { method: 'GET' });
}

export async function fetchScheduleGantt(params: { rangeStart: string; rangeEnd: string; today?: string }): Promise<ScheduleGanttResponse> {
  const query = new URLSearchParams({
    rangeStart: params.rangeStart,
    rangeEnd: params.rangeEnd,
    ...(params.today ? { today: params.today } : null),
  }).toString();
  return apiJson<ScheduleGanttResponse>(`/api/staff/v1/schedule/gantt?${query}`, { method: 'GET' });
}

export async function assignJob(input: { job_id: string; crew_id: string; position: number; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/assign', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function unassignJob(input: { job_id: string; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/unassign', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function reorderItems(input: { crew_id: string; ordered_item_ids?: string[]; item_id?: string; new_position?: number; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/items/reorder', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function setJobDuration(input: { job_id: string; forecast_duration_days: number; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/set-duration', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function pinJob(input: { job_id: string; requested_start_date: string; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/pin', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function unpinJob(input: { job_id: string; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/unpin', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createDowntime(input: { crew_id: string; position: number; duration_days: number; reason?: string; note?: string | null; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/downtime/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateDowntime(input: { downtime_id: string; duration_days?: number; reason?: string; note?: string | null; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/downtime/update', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteDowntime(input: { downtime_id: string; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/downtime/delete', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function markJobInProgress(input: { job_id: string; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/mark-in-progress', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function setDaysRemaining(input: { job_id: string; days_remaining: number; force?: boolean; today?: string }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/set-days-remaining', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function markJobDone(input: { job_id: string; force?: boolean; today?: string; finish_early_action?: 'pull_forward' | 'keep_schedule' }) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation | FinishEarlyPrompt>('/api/staff/v1/schedule/job/mark-done', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function lockJobSchedule(input: {
  job_id: string;
  commitment_type: 'week_of' | 'fixed_date';
  week_of_date?: string;
  start_date?: string;
  duration_days: number;
  flex_days?: number;
  hard_lock?: boolean;
  force?: boolean;
  today?: string;
}) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/lock', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function rescheduleJob(input: {
  job_id: string;
  commitment_type: 'week_of' | 'fixed_date';
  week_of_date?: string;
  start_date?: string;
  duration_days: number;
  flex_days?: number;
  hard_lock?: boolean;
  force?: boolean;
  today?: string;
}) {
  return apiJson<ScheduleMutationResult | RequiresConfirmation>('/api/staff/v1/schedule/job/reschedule', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function ackClientUpdate(input: { job_id: string }) {
  return apiJson<MutationResult>('/api/staff/v1/schedule/job/client-update/ack', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
