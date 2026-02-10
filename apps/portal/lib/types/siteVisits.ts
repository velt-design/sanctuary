export type SiteVisitStatus =
  | 'UNSCHEDULED'
  | 'TENTATIVE'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'RESCHEDULED'
  | 'CANCELLED';

export type SiteVisitCalendarPerson = {
  id: string;
  name: string;
};

export type SiteVisitProjectInfo = {
  id: string; // app id (proj_)
  name: string;
  region: string | null;
  siteAddress: string | null;
  pipelineStage: string | null;
};

export type SiteVisitContactInfo = {
  id: string | null; // app id (ct_)
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type SiteVisitCalendarItem = {
  id: string; // app id (sv_)
  projectId: string; // app id (proj_)
  status: SiteVisitStatus;
  scheduledStart: string | null; // ISO
  scheduledEnd: string | null; // ISO
  salespersonId: string | null; // config id (e.g. "jayden") or null
  notes: string | null;
  customerNotified: boolean;
  lastNotifiedAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  priorityTier?: 1 | 2 | null;
  project: SiteVisitProjectInfo;
  contact: SiteVisitContactInfo;
};

export type SiteVisitsApiResponse = {
  generatedAt: string;
  unscheduled: SiteVisitCalendarItem[];
  events: SiteVisitCalendarItem[];
  salesPeople: SiteVisitCalendarPerson[];
};

export type SiteVisitsSnapshotV1 = SiteVisitsApiResponse & {
  host: string | null;
  rangeFrom: string;
  rangeTo: string;
  salesOwnerId: string | null;
};
