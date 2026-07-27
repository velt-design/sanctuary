type EnquiryType = 'residential' | 'commercial' | 'professional';

type PergolaStyle = 'Pitched' | 'Gable' | 'Hip' | 'Perimeter' | string;
type RoofOption = 'Acrylic' | 'Timber' | 'Both' | 'Not selected' | string;

interface MoneyRange {
  lowIncGst: number;
  highIncGst: number;
}

interface EnquiryBase {
  leadId: string;
  submittedAt: Date;

  enquiryType: EnquiryType;

  name: string;
  email: string;
  phone: string;
  suburb: string;

  message?: string;

  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingUrl?: string;
  filesReceivedCount?: number;
  // Populated when uploads are too large to inline as email attachments.
  attachmentLinks?: { name: string; url: string }[];
}

export interface ResidentialOrCommercial extends EnquiryBase {
  enquiryType: 'residential' | 'commercial';

  widthM: number;
  depthM: number;
  heightM: number;

  style: PergolaStyle;
  roof: RoofOption;

  addons: string[];
  blindsSelected: boolean;

  baseRange: MoneyRange;
  blindsRange?: MoneyRange;
}

export type ResidentialOrCommercialEnquiry = Omit<
  ResidentialOrCommercial,
  'baseRange'
> & {
  baseRange?: MoneyRange;
};

export interface Professional extends EnquiryBase {
  enquiryType: 'professional';
  company?: string;
}

export type EnquiryPayload = ResidentialOrCommercialEnquiry | Professional;
