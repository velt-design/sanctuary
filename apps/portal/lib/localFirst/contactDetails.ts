import type { QueryClient } from '@tanstack/react-query';
import type { Contact } from '../types/contact';
import { upsertContactCaches } from './portalEntities';

export type PortalContactDetailsDraft = {
  displayName: string;
  email: string;
  phone: string;
};

export type PortalContactDetailsUpdateMutationPayload = {
  contactId: string;
  draft: PortalContactDetailsDraft;
  previousContact: Contact;
};

export function buildContactDetailsEntityKey(contactId: string): string {
  return `contact:details:${contactId}`;
}

export function normalizeContactDetailsDraft(
  draft: PortalContactDetailsDraft,
): PortalContactDetailsDraft {
  return {
    displayName: draft.displayName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
  };
}

function contactWithDetailsDraft(
  contact: Contact,
  draft: PortalContactDetailsDraft,
): Contact {
  const normalized = normalizeContactDetailsDraft(draft);
  return {
    ...contact,
    displayName: normalized.displayName,
    email: normalized.email,
    phone: normalized.phone,
    updatedAt: new Date().toISOString(),
  };
}

export function patchContactDetailsCaches(
  queryClient: QueryClient,
  hostKey: string,
  contact: Contact,
  draft: PortalContactDetailsDraft,
): Contact {
  const optimisticContact = contactWithDetailsDraft(contact, draft);
  upsertContactCaches(queryClient, hostKey, optimisticContact);
  return optimisticContact;
}
