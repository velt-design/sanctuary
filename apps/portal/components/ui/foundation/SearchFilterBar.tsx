'use client';

import { Search, X } from 'lucide-react';
import { Button, Input, Select } from './FoundationControls';
import styles from './SearchFilterBar.module.css';

export type FilterOption = { value: string; label: string };
export type FilterDefinition = { id: string; label: string; value: string; options: FilterOption[]; onChange: (value: string) => void };

export function SearchFilterBar({ query, onQueryChange, queryPlaceholder = 'Search…', searchId, filters, onClearAll }: {
  query: string;
  onQueryChange: (value: string) => void;
  queryPlaceholder?: string;
  searchId?: string;
  filters: FilterDefinition[];
  onClearAll: () => void;
}) {
  const active = [
    ...(query.trim() ? [{ id: 'query', label: `Search: ${query.trim()}`, clear: () => onQueryChange('') }] : []),
    ...filters.flatMap((filter) => {
      const option = filter.options.find((entry) => entry.value === filter.value);
      return option && filter.value !== filter.options[0]?.value
        ? [{ id: filter.id, label: `${filter.label}: ${option.label}`, clear: () => filter.onChange(filter.options[0].value) }]
        : [];
    }),
  ];
  return (
    <div className={styles.root} role="search" aria-label="Search and filter">
      <div className={styles.controls}>
        <Input id={searchId} label="Search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={queryPlaceholder} className={styles.searchInput} />
        {filters.map((filter) => (
          <Select id={filter.id} key={filter.id} label={filter.label} value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
            {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        ))}
      </div>
      {active.length ? (
        <div className={styles.active} aria-label="Active filters">
          <Search aria-hidden="true" />
          {active.map((filter) => <button key={filter.id} type="button" onClick={filter.clear}>{filter.label}<X aria-hidden="true" /></button>)}
          <Button variant="quiet" size="small" onClick={onClearAll}>Clear all</Button>
        </div>
      ) : null}
    </div>
  );
}
