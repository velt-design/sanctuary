import type { Contact } from '@/lib/types/contact';

export type ContactsIndexResponse = {
  contacts: {
    rows: Contact[];
    totalCount: number | null;
    truncated: boolean;
  };
  generatedAt: string;
};
