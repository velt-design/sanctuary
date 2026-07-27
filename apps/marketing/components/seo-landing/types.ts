import type { EnquiryAudience } from '@/lib/enquiryContext';

type FaqItem = {
  question: string;
  answer: readonly string[];
};

type ProjectProofItem = {
  slug: string;
  label: string;
  role?: string;
  summary: string;
  facts?: readonly string[];
  image?: { src: string; alt: string; objectPosition?: string };
};

export type EnquiryBriefField = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  placeholder?: string;
  options?: readonly string[];
  wide?: boolean;
};

type SectionBase = {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  tone?: 'canvas' | 'warm' | 'neutral' | 'elevated' | 'inverse';
};

export type SeoLandingBlock =
  | (SectionBase & {
      kind: 'split-intro';
      paragraphs: readonly string[];
    })
  | (SectionBase & {
      kind: 'numbered-cards';
      items: ReadonlyArray<{ title: string; text: string }>;
    })
  | (SectionBase & {
      kind: 'editorial-image';
      image: { src: string; alt: string; objectPosition?: string };
      lead?: string;
      items: ReadonlyArray<{ title: string; text: string }>;
    })
  | (SectionBase & {
      kind: 'comparison';
      options: readonly [
        { title: string; text: string },
        { title: string; text: string },
      ];
      rows: ReadonlyArray<{
        label: string;
        values: readonly [string, string];
      }>;
      note?: string;
    })
  | (SectionBase & {
      kind: 'projects';
      items: readonly ProjectProofItem[];
    })
  | (SectionBase & {
      kind: 'link-cards';
      items: ReadonlyArray<{ title: string; text: string; href: string; linkLabel: string }>;
    })
  | (SectionBase & {
      kind: 'decision-cards';
      items: ReadonlyArray<{ title: string; outcome: string; consider: string; href?: string; linkLabel?: string }>;
    })
  | (SectionBase & {
      kind: 'dark-cards';
      items: ReadonlyArray<{ title: string; text: string }>;
      links?: ReadonlyArray<{ href: string; label: string }>;
    })
  | (SectionBase & {
      kind: 'process';
      items: ReadonlyArray<{ title: string; copy: string }>;
    })
  | (SectionBase & {
      kind: 'scope';
      lead: string;
      paragraphs: readonly string[];
      factors: ReadonlyArray<readonly [string, string]>;
      checklistLead: string;
      checklist: readonly string[];
    })
  | (SectionBase & {
      kind: 'faq';
      items: readonly FaqItem[];
    });

export type SeoLandingDisclosureGroup = {
  id: string;
  summary: string;
  blockIds: readonly string[];
};

export type SeoLandingGuideFirstLayer = {
  answerBlockId: string;
  projectBlockId: string;
  projectSlug: string;
  returnHref: string;
  returnLabel: string;
  supportingAnswerTitle: string;
  supportingProjectsTitle: string;
  supportingSummary: string;
};

export type SeoLandingPageConfig = {
  marker: string;
  route: string;
  showGuideNavigation?: boolean;
  breadcrumbLabel?: string;
  enquiryType?: EnquiryAudience;
  schemaKind?: 'service';
  description: string;
  schemaName: string;
  serviceName: string;
  serviceType: string;
  hero: {
    image: string;
    imageAlt: string;
    objectPosition?: string;
    eyebrow: string;
    title: string;
    intro: string;
    primaryCta: string;
    secondaryCta: string;
    secondaryHref: string;
    proof: readonly string[];
  };
  blocks: readonly SeoLandingBlock[];
  blockOrder?: readonly string[];
  guideFirstLayer?: SeoLandingGuideFirstLayer;
  mobileDisclosureGroups?: readonly SeoLandingDisclosureGroup[];
  finalCta: {
    eyebrow: string;
    title: string;
    text: string;
    button: string;
    checklistTitle: string;
    checklist: readonly string[];
  };
  form: {
    ariaLabel: string;
    eyebrow: string;
    heading: string;
    intro: string;
    submitLabel: string;
    messageLabel?: string;
    messagePlaceholder?: string;
    briefFields?: readonly EnquiryBriefField[];
    directContact?: {
      intro: string;
      phoneLabel: string;
      phoneHref: `tel:${string}`;
      emailLabel: string;
      emailHref: `mailto:${string}`;
    };
    roofPreference?: {
      detailKey: 'acrylicOption' | 'roofPreference';
      options: ReadonlyArray<{ label: string; value: string; roofMaterials: ReadonlyArray<string> }>;
    };
  };
};
