'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/queries/keys';
import type { Project } from '@/lib/types/project';
import { useProjectsIndexMutations } from '@/app/staff/projects/useProjectsIndexMutations';
import styles from './projectsIndexMutationFixture.module.css';

const FIXTURE_HOST = 'fixture.supabase.invalid';
const FIXTURE_PROJECT: Project = {
  id: 'fixture-project',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  projectName: 'Fixture Project',
  siteAddress: '1 Fixture Lane',
  status: 'NEW',
  isArchived: false,
};

export default function ProjectsIndexMutationFixtureClient() {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(FIXTURE_PROJECT.projectName ?? '');
  const projectsQuery = useQuery({
    queryKey: qk.projects.list(FIXTURE_HOST, 'active'),
    queryFn: async () => [FIXTURE_PROJECT],
    initialData: [FIXTURE_PROJECT],
    enabled: false,
    staleTime: Infinity,
  });
  const mutations = useProjectsIndexMutations(FIXTURE_HOST);
  const project = projectsQuery.data[0] ?? FIXTURE_PROJECT;
  const isSaving = mutations.isCellPending(project.id, 'name');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || value === (project.projectName ?? project.name ?? '').trim()) {
      setEditing(false);
      return;
    }

    setEditing(false);
    void mutations.saveInlineEdit({
      project,
      contact: null,
      field: 'name',
      value,
    });
  };

  return (
    <section className={styles.card} data-project-mutation-fixture="ready">
      <p className={styles.eyebrow}>Fixture-safe performance check</p>
      <h1 className={styles.heading}>Instant project update</h1>
      <p className={styles.explanation}>
        This sample project uses the production cache and mutation controller without customer data.
      </p>

      <div className={styles.projectRow}>
        <div>
          <span className={styles.label}>Project name</span>
          {editing ? (
            <form className={styles.editor} onSubmit={submit}>
              <label className={styles.srOnly} htmlFor="fixture-project-name">
                Project name
              </label>
              <input
                id="fixture-project-name"
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.projectName}
              disabled={isSaving}
              onClick={() => {
                setDraft(project.projectName ?? project.name ?? '');
                setEditing(true);
              }}
            >
              <span data-fixture-project-name="true">{project.projectName ?? project.name}</span>
              {isSaving ? <span data-fixture-project-saving="true">Saving…</span> : null}
            </button>
          )}
        </div>
        <span className={styles.status}>{isSaving ? 'Updating in background' : 'Ready'}</span>
      </div>
    </section>
  );
}
