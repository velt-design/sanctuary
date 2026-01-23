'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { listContacts } from '@/lib/repo/contactsRepo';
import { listProjects } from '@/lib/repo/projectsRepo';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { PROJECT_STATUS_ORDER, nextActionTypeLabel, projectStatusLabel } from '@/lib/types/project';
import styles from './projects.module.css';
import PageHeader from '@/components/portal/PageHeader';
import { useToast } from '@/components/ui/toast/ToastProvider';
import useSWR from 'swr';
import { contactsSWRKey } from '@/lib/cache/contactsCache';
import { projectsSWRKey } from '@/lib/cache/projectsCache';

function toYmd(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export default function ProjectsIndexClient({ mode }: { mode?: 'page' | 'loading' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all');
  const [dueOnly, setDueOnly] = useState(false);

  const projectsKey = useMemo(() => projectsSWRKey(), []);
  const contactsKey = useMemo(() => contactsSWRKey(), []);

  const isLoadingMode = mode === 'loading';
  const { data: projectsData, error: projectsError } = useSWR<Project[]>(
    projectsKey,
    isLoadingMode ? null : () => listProjects(),
    isLoadingMode ? { revalidateOnMount: false } : { revalidateOnMount: true },
  );
  const { data: contactsData, error: contactsError } = useSWR<Contact[]>(
    contactsKey,
    isLoadingMode ? null : () => listContacts(),
    isLoadingMode ? { revalidateOnMount: false } : { revalidateOnMount: true },
  );

  const projects = projectsData ?? [];
  const contacts = contactsData ?? [];
  const hasLoadedProjectsOnce = typeof projectsData !== 'undefined';

  useEffect(() => {
    if (isLoadingMode) return;
    if (!projectsError) return;
    if (projects.length) {
      toast.error("Couldn't refresh projects (showing last saved).");
      return;
    }
    const msg = projectsError instanceof Error ? projectsError.message : 'Failed to load projects.';
    toast.error(msg);
  }, [isLoadingMode, projects.length, projectsError, toast]);

  useEffect(() => {
    if (isLoadingMode) return;
    if (!contactsError) return;
    if (contacts.length) {
      toast.error("Couldn't refresh contacts (showing last saved).");
      return;
    }
    const msg = contactsError instanceof Error ? contactsError.message : 'Failed to load contacts.';
    toast.error(msg);
  }, [contacts.length, contactsError, isLoadingMode, toast]);

  useEffect(() => {
    const t = searchParams.get('toast');
    if (t === 'project_deleted') {
      toast.success('Project deleted.');
      router.replace('/staff/projects');
    }
  }, [router, searchParams, toast]);

  const contactsById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) map.set(c.id, c);
    return map;
  }, [contacts]);

  const todayYmd = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return projects.filter((p) => {
      if (statusFilter !== 'all' && (p.status ?? 'NEW') !== statusFilter) return false;

      const nextAction = toYmd(p.nextActionDate ?? p.followUpDate);
      if (dueOnly) {
        if (!nextAction) return false;
        if (nextAction > todayYmd) return false;
      }

      if (!needle) return true;

      const contact = p.contactId ? contactsById.get(p.contactId) : null;
      const text = [
        p.projectName ?? p.name ?? '',
        p.clientName ?? '',
        contact?.displayName ?? '',
        contact?.email ?? '',
        p.region ?? '',
        p.siteAddress ?? p.address ?? '',
        p.quoteRef ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return text.includes(needle);
    });
  }, [contactsById, dueOnly, projects, query, statusFilter, todayYmd]);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Projects"
        subtitle="Job list stored in the portal database."
        primaryAction={{ label: 'New Project', href: '/staff/projects/new' }}
      />

      <div className={styles.stack}>
        <section className={styles.section} aria-label="Filters">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Filters</h2>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="projectSearch">Search</label>
                <input
                  id="projectSearch"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, client, address…"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="projectStatusFilter">Status</label>
                <select id="projectStatusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                  <option value="all">All</option>
                  {PROJECT_STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {projectStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field} style={{ display: 'flex', flexDirection: 'column' }}>
                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
                  <span className={styles.checkboxText}>Next action due (today + overdue)</span>
                </label>
                <div className={styles.muted} style={{ marginTop: 6, fontSize: 12 }}>
                  Shows projects with next action date ≤ today
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Projects list">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>All Projects</h2>
            <span className={styles.muted} suppressHydrationWarning>
              {filteredProjects.length} shown
            </span>
          </div>
          <div className={styles.sectionBody}>
            {!hasLoadedProjectsOnce && !projectsError ? (
              <p className={styles.note}>Loading projects…</p>
            ) : filteredProjects.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Client</th>
                      <th>Region</th>
                      <th>Status</th>
                      <th>Next action</th>
                      <th>Last activity</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p) => {
                      const nextActionDate = toYmd(p.nextActionDate ?? p.followUpDate) ?? '';
                      const due = nextActionDate ? nextActionDate <= todayYmd : false;
                      const overdue = nextActionDate ? nextActionDate < todayYmd : false;
                      const lastActivity = p.activity?.[0]?.createdAt ?? p.updatedAt ?? p.createdAt;
                      return (
                        <tr
                          key={p.id}
                          className={styles.rowClickable}
                          tabIndex={0}
                          onClick={() => router.push(`/staff/projects/${encodeURIComponent(p.id)}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') router.push(`/staff/projects/${encodeURIComponent(p.id)}`);
                          }}
                        >
                          <td>{p.projectName ?? p.name ?? '—'}</td>
                          <td className={styles.muted}>
                            {(() => {
                              const contact = p.contactId ? contactsById.get(p.contactId) : null;
                              return contact?.displayName ?? p.clientName ?? '—';
                            })()}
                          </td>
                          <td className={styles.muted}>{p.region ?? '—'}</td>
                          <td>
                            <span className={styles.statusPill}>{projectStatusLabel(p.status ?? 'NEW')}</span>
                            {p.isLost ? (
                              <span className={styles.dueBadge} style={{ marginLeft: 8 }}>
                                Lost
                              </span>
                            ) : null}
                            {p.isArchived ? (
                              <span className={styles.dueBadge} style={{ marginLeft: 8 }}>
                                Archived
                              </span>
                            ) : null}
                          </td>
                          <td className={styles.muted}>
                            {nextActionDate || '—'}
                            {p.nextActionType ? (
                              <span className={styles.muted} style={{ marginLeft: 8, fontSize: 12 }}>
                                {nextActionTypeLabel(p.nextActionType as any)}
                              </span>
                            ) : null}{' '}
                            {due ? <span className={styles.dueBadge}>{overdue ? 'Overdue' : 'Due today'}</span> : null}
                          </td>
                          <td className={styles.muted}>{new Date(lastActivity).toLocaleString()}</td>
                          <td>
                            <Link
                              className={styles.link}
                              href={`/staff/projects/${encodeURIComponent(p.id)}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.note}>
                {projects.length ? 'No projects match this filter.' : 'No projects yet. Click “New Project” to create one.'}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
