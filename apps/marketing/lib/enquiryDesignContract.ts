import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';

export type EnquiryAudience = 'residential' | 'commercial' | 'professional';
export type CustomerBrief = {
  version: 1;
  audience: EnquiryAudience;
  designStatus: 'configured' | 'bespoke' | 'help';
  design?: PreviewDraft;
  summary?: string;
  reopenPath?: string;
};
