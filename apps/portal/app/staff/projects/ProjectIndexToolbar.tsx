'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui/foundation';
import { Drawer } from '@/components/ui/drawer/Drawer';
import { PROJECTS_INDEX_OWNER_OPTIONS } from '@/lib/projects/projectsIndexContract';
import { PROJECT_JOURNEY_FILTER_OPTIONS, PROJECT_STAGE_FILTER_OPTIONS, PROJECT_STATE_FILTER_OPTIONS } from './projectIndexFilters';
import type { ProjectIndexView } from './projectIndexView';
import styles from './ProjectIndexToolbar.module.css';

const fields = [
  { key: 'journeyFilter', id: 'projectJourneyFilter', label: 'Journey', options: PROJECT_JOURNEY_FILTER_OPTIONS },
  { key: 'stageFilter', id: 'projectStageFilter', label: 'Stage', options: PROJECT_STAGE_FILTER_OPTIONS },
  { key: 'stateFilter', id: 'projectStateFilter', label: 'State', options: PROJECT_STATE_FILTER_OPTIONS },
  { key: 'ownerFilter', id: 'projectOwnerFilter', label: 'Owner', options: PROJECTS_INDEX_OWNER_OPTIONS },
] as const;

export default function ProjectIndexToolbar({ view, onChange, onReset }: {
  view: ProjectIndexView;
  onChange: (patch: Partial<ProjectIndexView>) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<ProjectIndexView | null>(null);
  const applied = fields.filter((field) => view[field.key] !== 'all');
  return <section className={styles.root} aria-label="Search and filter projects">
    <div className={styles.toolbar}>
      <label className={styles.search} htmlFor="projectSearch"><span>Search projects</span>
        <Input id="projectSearch" value={view.query} placeholder="Name, client, phone or address…" onChange={(event) => onChange({ query: event.target.value })} />
      </label>
      <label htmlFor="projectSort"><span>Sort</span><Select id="projectSort" value={view.sort} onChange={(event) => onChange({ sort: event.target.value as ProjectIndexView['sort'] })}>
        <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option>
      </Select></label>
      <Button variant="secondary" onClick={() => setDraft({ ...view })}>Filters{applied.length ? ` (${applied.length})` : ''}</Button>
    </div>
    <div className={styles.applied} aria-label="Applied project filters">
      <span className={styles.scope}>{view.archiveFilter === 'archived' ? 'Archived projects' : view.archiveFilter === 'all' ? 'Including archived' : 'Excluding archived'}</span>
      {applied.map((field) => <Button key={field.key} variant="quiet" size="small" aria-label={`Remove ${field.label.toLowerCase()} filter`} onClick={() => onChange({ [field.key]: 'all', ...(field.key === 'stateFilter' ? { archiveFilter: 'active' } : {}) })}>
        {field.label}: {field.options.find((option) => option.value === view[field.key])?.label} ×
      </Button>)}
      {applied.length || view.query || view.archiveFilter !== 'active' ? <Button size="small" variant="quiet" onClick={onReset}>Clear all</Button> : null}
    </div>
    <Drawer open={draft !== null} title="Project filters" onClose={() => setDraft(null)}>
      {draft ? <form className={styles.form} onSubmit={(event) => {
        event.preventDefault();
        onChange({ journeyFilter: draft.journeyFilter, stageFilter: draft.stageFilter, stateFilter: draft.stateFilter, ownerFilter: draft.ownerFilter, archiveFilter: draft.archiveFilter, pageSize: draft.pageSize });
        setDraft(null);
      }}>
        {fields.map((field) => <label key={field.key} htmlFor={field.id}><span>{field.label}</span><Select id={field.id} value={draft[field.key]} onChange={(event) => {
          const value = event.target.value;
          setDraft({ ...draft, [field.key]: value, ...(field.key === 'stateFilter' ? { archiveFilter: value === 'ARCHIVED' ? 'archived' : 'active' } : {}) });
        }}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>)}
        <label htmlFor="projectPageSize"><span>Rows per page</span><Select id="projectPageSize" value={draft.pageSize} onChange={(event) => setDraft({ ...draft, pageSize: Number(event.target.value) as ProjectIndexView['pageSize'] })}>
          <option value="25">25 rows</option><option value="50">50 rows</option><option value="100">100 rows</option>
        </Select></label>
        <div className={styles.actions}><Button type="submit">Apply filters</Button><Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button></div>
      </form> : null}
    </Drawer>
  </section>;
}
