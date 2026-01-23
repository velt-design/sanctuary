'use client';

import { useMemo, useRef, useState } from 'react';
import PageHeader from '@/components/portal/PageHeader';
import styles from '@/app/staff/projects/projects.module.css';
import { importExportFile, readJsonFile, type ImportResult } from '@/lib/export/json';
import { persistImportResultToDb } from '@/lib/export/importPersist';
import type { Contact } from '@/lib/types/contact';
import type { Estimate } from '@/lib/types/estimate';
import type { Project } from '@/lib/types/project';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import { upsertContact } from '@/lib/repo/contactsRepo';
import { upsertEstimate } from '@/lib/repo/estimatesRepo';
import { upsertProject } from '@/lib/repo/projectsRepo';
import { upsertScheduleItems } from '@/lib/repo/scheduleRepo';
import { useToast } from '@/components/ui/toast/ToastProvider';

type BulkImportPayload = {
  contacts: Contact[];
  projects: Project[];
  estimates: Estimate[];
  installers: Installer[];
  scheduleItems: ScheduleItem[];
};

type ParsedImportSource =
  | { filename: string; kind: 'sp_export_v1'; result: ImportResult }
  | { filename: string; kind: 'bulk'; payload: BulkImportPayload }
  | { filename: string; kind: 'error'; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isContact(value: unknown): value is Contact {
  if (!isRecord(value)) return false;
  return typeof (value as any).id === 'string' && (typeof (value as any).displayName === 'string' || typeof (value as any).name === 'string');
}

function isProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  const v = value as any;
  const hasName = typeof v.projectName === 'string' || typeof v.name === 'string';
  return typeof v.id === 'string' && typeof v.createdAt === 'string' && hasName;
}

function isEstimate(value: unknown): value is Estimate {
  if (!isRecord(value)) return false;
  const v = value as any;
  return (
    typeof v.id === 'string' &&
    typeof v.projectId === 'string' &&
    typeof v.createdAt === 'string' &&
    typeof v.status === 'string' &&
    isRecord(v.inputs) &&
    isRecord(v.outputs) &&
    isRecord(v.configVersions)
  );
}

function isInstaller(value: unknown): value is Installer {
  if (!isRecord(value)) return false;
  const v = value as any;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.color === 'string' && typeof v.sortOrder === 'number';
}

function isScheduleItem(value: unknown): value is ScheduleItem {
  if (!isRecord(value)) return false;
  const v = value as any;
  return (
    typeof v.id === 'string' &&
    typeof v.projectId === 'string' &&
    typeof v.estimateId === 'string' &&
    typeof v.installerId === 'string' &&
    typeof v.updatedAt === 'string'
  );
}

function ensureBulkPayload(source: unknown): BulkImportPayload | null {
  const empty: BulkImportPayload = { contacts: [], projects: [], estimates: [], installers: [], scheduleItems: [] };

  if (Array.isArray(source)) {
    const contacts = source.filter(isContact);
    if (contacts.length === source.length) return { ...empty, contacts };

    const projects = source.filter(isProject);
    if (projects.length === source.length) return { ...empty, projects };

    const estimates = source.filter(isEstimate);
    if (estimates.length === source.length) return { ...empty, estimates };

    const installers = source.filter(isInstaller);
    if (installers.length === source.length) return { ...empty, installers };

    const scheduleItems = source.filter(isScheduleItem);
    if (scheduleItems.length === source.length) return { ...empty, scheduleItems };

    return null;
  }

  if (!isRecord(source)) return null;

  const contactsRaw = Array.isArray((source as any).contacts) ? ((source as any).contacts as unknown[]) : [];
  const projectsRaw = Array.isArray((source as any).projects) ? ((source as any).projects as unknown[]) : [];
  const estimatesRaw = Array.isArray((source as any).estimates) ? ((source as any).estimates as unknown[]) : [];
  const installersRaw = Array.isArray((source as any).installers) ? ((source as any).installers as unknown[]) : [];
  const scheduleItemsRaw = Array.isArray((source as any).scheduleItems)
    ? ((source as any).scheduleItems as unknown[])
    : Array.isArray((source as any).schedule_items)
      ? ((source as any).schedule_items as unknown[])
      : [];

  const payload: BulkImportPayload = {
    contacts: contactsRaw.filter(isContact),
    projects: projectsRaw.filter(isProject),
    estimates: estimatesRaw.filter(isEstimate),
    installers: installersRaw.filter(isInstaller),
    scheduleItems: scheduleItemsRaw.filter(isScheduleItem),
  };

  const hasAny =
    payload.contacts.length || payload.projects.length || payload.estimates.length || payload.installers.length || payload.scheduleItems.length;
  return hasAny ? payload : null;
}

async function persistBulk(payload: BulkImportPayload): Promise<void> {
  for (const c of payload.contacts) await upsertContact(c);
  for (const p of payload.projects) await upsertProject(p);
  for (const e of payload.estimates) await upsertEstimate(e);
  if (payload.scheduleItems.length) await upsertScheduleItems(payload.scheduleItems);
}

export default function ImportsClient() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sources, setSources] = useState<ParsedImportSource[]>([]);
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    const contacts = new Map<string, Contact>();
    const projects = new Map<string, Project>();
    const estimates = new Map<string, Estimate>();
    const installers = new Map<string, Installer>();
    const scheduleItems = new Map<string, ScheduleItem>();

    for (const s of sources) {
      if (s.kind === 'sp_export_v1') {
        const r = s.result;
        if (r.kind === 'project') {
          for (const c of r.contacts) contacts.set(c.id, c);
          projects.set(r.project.id, r.project);
          for (const e of r.estimates) estimates.set(e.id, e);
        } else {
          for (const c of r.contacts) contacts.set(c.id, c);
          estimates.set(r.estimate.id, r.estimate);
        }
        continue;
      }
      if (s.kind === 'bulk') {
        for (const c of s.payload.contacts) contacts.set(c.id, c);
        for (const p of s.payload.projects) projects.set(p.id, p);
        for (const e of s.payload.estimates) estimates.set(e.id, e);
        for (const i of s.payload.installers) installers.set(i.id, i);
        for (const it of s.payload.scheduleItems) scheduleItems.set(it.id, it);
      }
    }

    return {
      contacts: Array.from(contacts.values()),
      projects: Array.from(projects.values()),
      estimates: Array.from(estimates.values()),
      installers: Array.from(installers.values()),
      scheduleItems: Array.from(scheduleItems.values()),
      errorCount: sources.filter((s) => s.kind === 'error').length,
    };
  }, [sources]);

  const canImport = Boolean((summary.contacts.length || summary.projects.length || summary.estimates.length || summary.scheduleItems.length) && !busy);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Imports"
        subtitle="Upload JSON exports from the old portal and import them into Supabase."
        primaryAction={{
          label: 'Select JSON files',
          onClick: () => fileInputRef.current?.click(),
          disabled: busy,
        }}
        meta={<span className={styles.muted}>{busy ? 'Working…' : `${sources.length} file(s)`}</span>}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;

          setBusy(true);
          void (async () => {
            try {
              const parsed: ParsedImportSource[] = [];
              for (const file of files) {
                try {
                  const payload = await readJsonFile(file);

                  if (isRecord(payload) && (payload as any).version === 'sp_export_v1' && typeof (payload as any).kind === 'string') {
                    parsed.push({ filename: file.name, kind: 'sp_export_v1', result: importExportFile(payload) });
                    continue;
                  }

                  const bulk = ensureBulkPayload(payload);
                  if (bulk) {
                    parsed.push({ filename: file.name, kind: 'bulk', payload: bulk });
                    continue;
                  }

                  parsed.push({ filename: file.name, kind: 'error', error: 'Unrecognised JSON shape (expected sp_export_v1 or bulk dump).' });
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Failed to read file.';
                  parsed.push({ filename: file.name, kind: 'error', error: msg });
                }
              }
              setSources(parsed);
            } finally {
              setBusy(false);
            }
          })();
        }}
      />

      <div className={styles.pageStack}>
        <section className={styles.section} aria-label="Import summary">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Summary</h2>
            <button
              type="button"
              className={styles.button}
              disabled={!canImport}
              onClick={() => {
                if (!canImport) return;
                setBusy(true);
                void (async () => {
                  try {
                    for (const s of sources) {
                      if (s.kind === 'sp_export_v1') await persistImportResultToDb(s.result);
                      if (s.kind === 'bulk') await persistBulk(s.payload);
                    }
                    toast.success(
                      `Imported ${summary.contacts.length} contact(s), ${summary.projects.length} project(s), ${summary.estimates.length} estimate(s).`,
                    );
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Import failed.';
                    toast.error(msg);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {busy ? 'Importing…' : 'Import'}
            </button>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <th>Contacts</th>
                    <td>{summary.contacts.length}</td>
                    <th>Projects</th>
                    <td>{summary.projects.length}</td>
                  </tr>
                  <tr>
                    <th>Estimates</th>
                    <td>{summary.estimates.length}</td>
                    <th>Schedule items</th>
                    <td>{summary.scheduleItems.length}</td>
                  </tr>
                  <tr>
                    <th>Parsed files</th>
                    <td>{sources.length}</td>
                    <th>Errors</th>
                    <td>{summary.errorCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {sources.length ? (
              <p className={styles.note} style={{ marginTop: 12 }}>
                Imports are idempotent: records are upserted by id where possible.
              </p>
            ) : (
              <p className={styles.note}>Select one or more JSON files to preview and import.</p>
            )}
          </div>
        </section>

        {sources.length ? (
          <section className={styles.section} aria-label="Files">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Files</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setSources([])} disabled={busy}>
                Clear
              </button>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Type</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s) => (
                      <tr key={s.filename}>
                        <td>{s.filename}</td>
                        <td className={styles.muted}>{s.kind === 'sp_export_v1' ? 'sp_export_v1' : s.kind}</td>
                        <td className={styles.muted}>
                          {s.kind === 'error'
                            ? s.error
                            : s.kind === 'bulk'
                              ? `${s.payload.contacts.length} contacts, ${s.payload.projects.length} projects, ${s.payload.estimates.length} estimates, ${s.payload.scheduleItems.length} schedule items`
                              : s.result.kind === 'project'
                                ? `Project ${s.result.projectId} (${s.result.estimatesImported} estimate(s))`
                                : `Estimate ${s.result.estimateId}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

