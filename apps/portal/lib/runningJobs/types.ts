export type RunningJobStage = 'SENT' | 'DEPOSIT' | 'SCHEDULED' | 'COMPLETED' | 'PAID' | string;

export type RunningJobStatusValue = 'No' | 'Yes' | 'TBC';

export type RunningJobEditableCellKey =
  | 'client_name'
  | 'phone_number'
  | 'site_address'
  | 'site_visit_rep'
  | 'deposit_paid_date'
  | 'materials_ordered'
  | 'estimated_start_date'
  | 'final_payment_date'
  | 'job_assigned_to'
  | 'job_completed'
  | 'lights_status'
  | 'install_days'
  | 'roofing_ordered'
  | 'running_notes';

export type RunningJobCellKey =
  | 'client_name'
  | 'phone_number'
  | 'site_address'
  | 'site_visit_rep'
  | 'deposit_paid_date'
  | 'materials_ordered'
  | 'pergola_type'
  | 'estimated_start_date'
  | 'final_payment_date'
  | 'job_assigned_to'
  | 'job_completed'
  | 'lights_status'
  | 'blinds_status'
  | 'install_days'
  | 'size_text'
  | 'colour_text'
  | 'roofing_text'
  | 'roofing_ordered'
  | 'running_notes';

export type RunningJobsCrewLookup = {
  id: string;
  name: string;
  shortCode: string | null;
  color: string | null;
  active: boolean;
};

export type RunningJobsSalesPersonLookup = {
  id: string;
  name: string;
  shortLabel: string;
};

export type RunningJobRow = {
  projectId: string;
  contactId: string | null;
  siteVisitEventId: string | null;
  scheduledJobId: string | null;
  latestEstimateId: string | null;
  latestQuoteVersionId: string | null;
  stage: RunningJobStage;
  sortDate: string | null;
  rowVersion: string;
  cells: {
    client_name: string;
    phone_number: string;
    site_address: string;
    site_visit_rep: string | null;
    deposit_paid_date: string | null;
    materials_ordered: boolean;
    pergola_type: string;
    estimated_start_date: string | null;
    final_payment_date: string | null;
    job_assigned_to: string | null;
    job_completed: boolean;
    lights_status: RunningJobStatusValue;
    blinds_status: RunningJobStatusValue;
    install_days: number | null;
    size_text: string;
    colour_text: string;
    roofing_text: string;
    roofing_ordered: boolean;
    running_notes: string;
  };
  derived: {
    pergola_type: string | null;
    lights_status: RunningJobStatusValue;
    blinds_status: RunningJobStatusValue;
    size_text: string | null;
    colour_text: string | null;
    roofing_text: string | null;
  };
  state: {
    projectCreatedAt: string | null;
    hasSiteVisit: boolean;
    hasSchedule: boolean;
    hasCrewAssigned: boolean;
    hasEstimatedStartDate: boolean;
    hasLatestEstimate: boolean;
    tasks: {
      materialsOrdered: boolean;
      roofingOrdered: boolean;
      jobComplete: boolean;
    };
    siteVisit: {
      salespersonId: string | null;
      status: string | null;
      updatedAt: string | null;
    };
    schedule: {
      crewId: string | null;
      plannedStart: string | null;
      forecastStart: string | null;
      plannedDurationDays: number | null;
      forecastDurationDays: number | null;
      actualStart: string | null;
      actualFinish: string | null;
      status: string | null;
      updatedAt: string | null;
    };
    meta: {
      lightsStatus: RunningJobStatusValue | null;
      updatedAt: string | null;
    };
  };
};

export type RunningJobsResponse = {
  generatedAt: string;
  lookups: {
    crews: RunningJobsCrewLookup[];
    salesPeople: RunningJobsSalesPersonLookup[];
  };
  groups: Array<{
    year: number;
    rows: RunningJobRow[];
  }>;
};

export type RunningJobCellMutationRequest = {
  projectId: string;
  rowVersion: string;
  key: RunningJobEditableCellKey;
  value: unknown;
  force?: boolean;
  finishEarlyAction?: 'pull_forward' | 'keep_schedule';
};

export type RunningJobCellMutationSuccess = {
  ok: true;
  updatedRow: RunningJobRow;
};

export type RunningJobCellMutationRequiresConfirmation = {
  requires_confirmation: true;
  impacts: Array<{
    job_id: string;
    scheduled_job_id: string;
    before_start: string | null;
    after_start: string | null;
  }>;
};

export type RunningJobCellMutationRequiresFinishEarly = {
  requires_finish_early: true;
  freed_days: number;
  actual_finish: string;
  forecast_end_exclusive: string | null;
  impacts: Array<{
    job_id: string;
    scheduled_job_id: string;
    before_start: string | null;
    after_start: string | null;
  }>;
};

export type RunningJobCellMutationResponse =
  | RunningJobCellMutationSuccess
  | RunningJobCellMutationRequiresConfirmation
  | RunningJobCellMutationRequiresFinishEarly;
