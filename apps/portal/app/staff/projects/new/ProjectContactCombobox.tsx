'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contactsIndexQueryOptions } from '@/lib/queries/contactsIndex';
import { apiJson } from '@/lib/repo/apiClient';
import type { Contact } from '@/lib/types/contact';
import { useDebouncedValue } from '@/lib/list/useDebouncedValue';
import styles from './ProjectCreateClient.module.css';

export default function ProjectContactCombobox({
  selected,
  initialContactId,
  disabled,
  onChange,
}: {
  selected: Contact | null;
  initialContactId?: string | null;
  disabled?: boolean;
  onChange(contact: Contact | null): void;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 180);

  const initialContact = useQuery({
    queryKey: ['project-create-contact', initialContactId ?? 'none'],
    queryFn: () => apiJson<{ contact: Contact }>(
      `/api/contacts/${encodeURIComponent(initialContactId ?? '')}`,
      { cache: 'no-store' },
    ),
    enabled: Boolean(initialContactId && !selected),
    retry: 1,
  });

  useEffect(() => {
    if (!selected && initialContact.data?.contact) onChange(initialContact.data.contact);
  }, [initialContact.data, onChange, selected]);

  useEffect(() => {
    if (selected) setQuery(selected.displayName);
  }, [selected]);

  const resultsQuery = useQuery({
    ...contactsIndexQueryOptions({
      search: debouncedQuery,
      page: 1,
      pageSize: 25,
      sort: 'name_asc',
    }),
    enabled: open,
    retry: 1,
  });
  const results = resultsQuery.data?.contacts.rows ?? [];

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  const choose = (contact: Contact) => {
    onChange(contact);
    setQuery(contact.displayName);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(results.length - 1, current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === 'Enter' && open && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      className={styles.contactCombobox}
      ref={containerRef}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor="projectContactSearch">Primary contact *</label>
      <input
        id="projectContactSearch"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && results[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={query}
        placeholder="Search by name, email or phone"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          if (selected) onChange(null);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {selected ? (
        <p className={styles.contactSelection}>
          Selected: <strong>{selected.displayName}</strong>
          {selected.email ? ` · ${selected.email}` : ''}
        </p>
      ) : (
        <p className={styles.contactSelection}>
          {initialContact.isLoading ? 'Loading selected contact…' : 'Choose one contact from the results.'}
        </p>
      )}
      {open ? (
        <div className={styles.contactResults} id={listboxId} role="listbox" aria-label="Contact results">
          {resultsQuery.isLoading ? <p>Searching contacts…</p> : null}
          {resultsQuery.isError ? <p>Contacts could not be searched. Retry by typing again.</p> : null}
          {!resultsQuery.isLoading && !resultsQuery.isError && !results.length ? <p>No contacts found.</p> : null}
          {results.map((contact, index) => (
            <button
              key={contact.id}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={selected?.id === contact.id}
              className={index === activeIndex ? styles.contactResultActive : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(contact)}
            >
              <strong>{contact.displayName}</strong>
              <span>{[contact.email, contact.phone].filter(Boolean).join(' · ') || 'No email or phone'}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
