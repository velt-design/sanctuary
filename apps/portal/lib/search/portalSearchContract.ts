import type { PipelineStageKey } from '@/lib/projects/pipelineDefinition';

export const PORTAL_SEARCH_MIN_LENGTH = 2;
export const PORTAL_SEARCH_MAX_LENGTH = 80;
export const PORTAL_SEARCH_GROUP_LIMIT = 5;

export type PortalProjectSearchResult = {
  kind: 'project';
  id: string;
  href: string;
  name: string;
  reference: string | null;
  siteAddress: string | null;
  contactName: string | null;
  stage: PipelineStageKey;
  archived: boolean;
};

export type PortalContactSearchResult = {
  kind: 'contact';
  id: string;
  href: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type PortalSearchResponse = {
  query: string;
  projects: PortalProjectSearchResult[];
  contacts: PortalContactSearchResult[];
  generatedAt: string;
};

