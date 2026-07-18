'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { projectsListQueryOptions } from '@/lib/queries/projects';
import { projectStatusLabel, type Project } from '@/lib/types/project';
import styles from './CalculatorTrustUi.module.css';

export type CalculatorProjectPickerProps = {
  open: boolean;
  hostKey: string;
  selectedProjectId: string;
  onClose: () => void;
  onSelect: (project: Project) => void;
};

function projectSearchText(project: Project): string {
  return [project.projectName, project.name, project.quoteRef, project.siteAddress, project.address]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

export function filterCalculatorProjects(projects: Project[], search: string): Project[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return projects;
  return projects.filter((project) => projectSearchText(project).includes(query));
}

export function calculatorProjectPickerViewState({
  isLoading,
  isError,
  resultCount,
}: {
  isLoading: boolean;
  isError: boolean;
  resultCount: number;
}): 'loading' | 'error' | 'empty' | 'results' {
  if (isLoading) return 'loading';
  if (isError) return 'error';
  return resultCount > 0 ? 'results' : 'empty';
}

export default function CalculatorProjectPicker({
  open,
  hostKey,
  selectedProjectId,
  onClose,
  onSelect,
}: CalculatorProjectPickerProps) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const projectsQuery = useQuery({
    ...projectsListQueryOptions(hostKey),
    enabled: open,
  });

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const projects = useMemo(() => {
    const source = projectsQuery.data ?? [];
    return filterCalculatorProjects(source, search);
  }, [projectsQuery.data, search]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Select calculator project"
      maxWidthPx={720}
      initialFocusRef={searchRef}
    >
      <div className={styles.projectPicker}>
        <div className={styles.projectPickerHeader}>
          <div>
            <h2>Select a project</h2>
            <p>Opening a project loads its active calculator draft. Current inputs stay saved under their existing local draft.</p>
          </div>
          <button type="button" className={styles.projectPickerClose} onClick={onClose} aria-label="Close project picker">
            ×
          </button>
        </div>

        <label className={styles.projectPickerSearchLabel}>
          Search active projects
          <input
            ref={searchRef}
            className={styles.projectPickerSearch}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Project name, quote ref, or address"
          />
        </label>

        <div className={styles.projectPickerResults} aria-live="polite">
          {projectsQuery.isLoading ? <p className={styles.projectPickerState}>Loading projects…</p> : null}
          {projectsQuery.isError ? (
            <div className={styles.projectPickerState}>
              <p>Projects could not be loaded.</p>
              <button type="button" onClick={() => void projectsQuery.refetch()} disabled={projectsQuery.isFetching}>
                {projectsQuery.isFetching ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          ) : null}
          {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 ? (
            <p className={styles.projectPickerState}>
              {search.trim() ? 'No active projects match that search.' : 'No active projects are available.'}
            </p>
          ) : null}
          {!projectsQuery.isError
            ? projects.map((project) => {
                const name = project.projectName ?? project.name ?? 'Untitled project';
                const detail = [project.quoteRef, project.siteAddress ?? project.address].filter(Boolean).join(' · ');
                const selected = project.id === selectedProjectId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    className={selected ? styles.projectPickerRowSelected : styles.projectPickerRow}
                    onClick={() => onSelect(project)}
                  >
                    <span>
                      <strong>{name}</strong>
                      {detail ? <small>{detail}</small> : null}
                    </span>
                    <span className={styles.projectPickerStatus}>
                      {selected ? 'Current' : project.status ? projectStatusLabel(project.status) : 'Open'}
                    </span>
                  </button>
                );
              })
            : null}
        </div>

        <div className={styles.projectPickerFooter}>
          <a href="/staff/projects">Browse all projects</a>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
