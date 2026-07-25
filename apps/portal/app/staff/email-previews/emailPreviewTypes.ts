import type {
  PreviewConfigurationReason,
  PreviewLayoutId,
  PreviewVariant,
} from './emailPreviewOptions';

export type LayoutPreview = Readonly<{
  id: PreviewLayoutId;
  name: string;
  description: string;
  bestFor: string;
  subject: string;
  sendSubject: string;
  preheader: string;
  htmlLight: string;
  htmlDark: string;
  text: string;
}>;

type PreviewFixtureImage = Readonly<{
  projectSlug: string;
  projectTitle: string;
  projectHref: string;
  imageUrl: string;
  imageAlt: string;
  location: string;
  roofApproach: string;
  match: 'exact' | 'form-only' | 'professional' | 'fallback';
}>;

export type PreviewResponse = Readonly<{
  variant: PreviewVariant;
  label: string;
  layouts: readonly LayoutPreview[];
  image: PreviewFixtureImage;
  recipient: string | null;
  environment: string;
  deliveryMode: string;
  sendReady: boolean;
  configurationReason: PreviewConfigurationReason;
}>;

export type PreviewSendResult = Readonly<{
  ok: true;
  variant: PreviewVariant;
  layout: PreviewLayoutId;
  recipient: string;
  subject: string;
  customerSubject: string;
  preheader: string;
  providerMessageId: string;
}>;

export type DeliveryConfirmation = Readonly<{
  layoutIds: readonly PreviewLayoutId[];
  label: string;
}>;

export type DeliveryState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{
      status: 'sending';
      completed: number;
      total: number;
      currentLayout: PreviewLayoutId;
    }>
  | Readonly<{
      status: 'success';
      acceptedLayoutIds: readonly PreviewLayoutId[];
      recipient: string;
    }>
  | Readonly<{
      status: 'error';
      acceptedLayoutIds: readonly PreviewLayoutId[];
      failedLayoutId: PreviewLayoutId;
      message: string;
    }>;
