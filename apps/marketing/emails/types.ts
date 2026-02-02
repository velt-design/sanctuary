export type EnquiryType = 'residential' | 'commercial' | 'professional';

export type PergolaStyle = 'Pitched' | 'Gable' | 'Hip' | 'Perimeter' | string;
export type RoofOption = 'Acrylic' | 'Timber' | 'Both' | 'Not selected' | string;

export interface MoneyRange {
  lowIncGst: number;
  highIncGst: number;
}

export interface EnquiryBase {
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

export interface Professional extends EnquiryBase {
  enquiryType: 'professional';
  company?: string;
  filesReceivedCount?: number;
}

export type EnquiryPayload = ResidentialOrCommercial | Professional;
