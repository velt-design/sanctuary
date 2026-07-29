import type { Contact } from '@/lib/types/contact';

const CONTACTS_INDEX_PAGE_SIZES = [25, 50, 100] as const;
export type ContactsIndexPageSize = (typeof CONTACTS_INDEX_PAGE_SIZES)[number];
export type ContactsIndexSort = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc';

export type ContactsIndexParams = {
  search: string;
  page: number;
  pageSize: ContactsIndexPageSize;
  sort: ContactsIndexSort;
};

export type ContactsIndexResponse = {
  contacts: {
    rows: Contact[];
    totalCount: number;
    truncated: false;
    page: number;
    pageSize: ContactsIndexPageSize;
    totalPages: number;
  };
  query: {
    search: string;
    sort: ContactsIndexSort;
  };
  generatedAt: string;
};

export const DEFAULT_CONTACTS_INDEX_PARAMS: ContactsIndexParams = {
  search: '',
  page: 1,
  pageSize: 50,
  sort: 'name_asc',
};

export function isContactsIndexSort(value: string): value is ContactsIndexSort {
  return ['name_asc', 'name_desc', 'created_desc', 'created_asc'].includes(value);
}

export function parseContactsIndexPageSize(value: string | null): ContactsIndexPageSize | null {
  const parsed = Number(value);
  return CONTACTS_INDEX_PAGE_SIZES.includes(parsed as ContactsIndexPageSize)
    ? parsed as ContactsIndexPageSize
    : null;
}
