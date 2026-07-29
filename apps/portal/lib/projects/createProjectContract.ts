import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';

type ProjectCreateExistingContact = {
  kind: 'existing';
  contactId: string;
};

type ProjectCreateNewContact = {
  kind: 'new';
  contactId: string;
  displayName: string;
  email: string;
  phone: string;
  allowDuplicate: boolean;
};

export type ProjectCreateRequest = {
  projectId: string;
  projectName: string;
  quoteRef: string;
  region: string;
  siteAddress: string;
  contact: ProjectCreateExistingContact | ProjectCreateNewContact;
};

type ProjectCreateReceipt = {
  state: 'server_confirmed';
  confirmedAt: string;
  replayed: boolean;
  createdContact: boolean;
  setupAutomation: 'confirmed' | 'needs_attention' | 'not_rechecked';
};

export type ProjectCreateResponse = {
  project: Project;
  contact: Contact;
  receipt: ProjectCreateReceipt;
};

export type ProjectCreateDuplicateResponse = {
  error: string;
  code: 'CONTACT_DUPLICATE_CANDIDATES';
  candidates: Contact[];
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isStableAppId(value: string, prefix: 'proj' | 'ct'): boolean {
  const escapedPrefix = `${prefix}_`;
  if (!value.startsWith(escapedPrefix)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value.slice(escapedPrefix.length));
}

export function parseProjectCreateRequest(value: unknown):
  | { ok: true; value: ProjectCreateRequest }
  | { ok: false; error: string } {
  const body = readRecord(value);
  const projectId = readString(body.projectId);
  const projectName = readString(body.projectName);
  const contactInput = readRecord(body.contact);
  const contactKind = readString(contactInput.kind);
  const contactId = readString(contactInput.contactId);

  if (!projectId) return { ok: false, error: 'Project command ID is required' };
  if (!isStableAppId(projectId, 'proj')) return { ok: false, error: 'Project command ID is invalid' };
  if (!projectName) return { ok: false, error: 'Project name is required' };
  if (!contactId) return { ok: false, error: 'Contact command ID is required' };
  if (!isStableAppId(contactId, 'ct')) return { ok: false, error: 'Contact command ID is invalid' };

  if (contactKind === 'existing') {
    return {
      ok: true,
      value: {
        projectId,
        projectName,
        quoteRef: readString(body.quoteRef),
        region: readString(body.region),
        siteAddress: readString(body.siteAddress),
        contact: { kind: 'existing', contactId },
      },
    };
  }

  if (contactKind !== 'new') {
    return { ok: false, error: 'Contact must be existing or new' };
  }

  const displayName = readString(contactInput.displayName);
  const email = readString(contactInput.email);
  const phone = readString(contactInput.phone);
  if (!displayName) return { ok: false, error: 'Contact name is required' };
  if (email && !email.includes('@')) return { ok: false, error: 'Contact email is invalid' };

  return {
    ok: true,
    value: {
      projectId,
      projectName,
      quoteRef: readString(body.quoteRef),
      region: readString(body.region),
      siteAddress: readString(body.siteAddress),
      contact: {
        kind: 'new',
        contactId,
        displayName,
        email,
        phone,
        allowDuplicate: contactInput.allowDuplicate === true,
      },
    },
  };
}
