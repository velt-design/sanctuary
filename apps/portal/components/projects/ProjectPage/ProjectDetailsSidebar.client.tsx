'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';

type Draft = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  projectName: string;
  siteAddress: string;
  region: string;
  quoteRef: string;
  nextActionDate: string;
};

function toDraft(project: ProjectPageSnapshot['project']): Draft {
  return {
    contactName: project.contactName ?? '',
    contactEmail: project.contactEmail ?? '',
    contactPhone: project.contactPhone ?? '',
    projectName: project.name ?? '',
    siteAddress: project.siteAddress ?? '',
    region: project.region ?? '',
    quoteRef: project.quoteRef ?? '',
    nextActionDate: project.nextActionDate ?? '',
  };
}

function isValidYmd(value: string): boolean {
  if (!value.trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export default function ProjectDetailsSidebarClient({ project }: { project: ProjectPageSnapshot['project'] }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [current, setCurrent] = useState<Draft>(() => toDraft(project));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setCurrent(toDraft(project));
    }
  }, [isEditing, project]);

  const canSave = useMemo(() => {
    if (!draft) return false;
    if (!draft.projectName.trim()) return false;
    if (!isValidYmd(draft.nextActionDate)) return false;
    return true;
  }, [draft]);

  const beginEdit = () => {
    setError(null);
    setDraft(current);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(null);
    setError(null);
  };

  const save = async () => {
    if (!draft || !canSave || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        project: {
          name: draft.projectName.trim(),
          siteAddress: draft.siteAddress.trim(),
          region: draft.region.trim(),
          quoteRef: draft.quoteRef.trim(),
          nextActionDate: draft.nextActionDate.trim(),
        },
        contact: {
          name: draft.contactName.trim(),
          email: draft.contactEmail.trim(),
          phone: draft.contactPhone.trim(),
        },
        contactId: project.contactId ?? null,
      };

      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/details`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = typeof body?.error === 'string' ? body.error : 'Failed to save project details';
        throw new Error(msg);
      }

      setCurrent(draft);
      setIsEditing(false);
      setDraft(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save project details';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={legacy.section} aria-label="Project details">
      <div className={legacy.sectionHeader}>
        <h2 className={legacy.sectionTitle}>Details</h2>
        <div className={legacy.actions}>
          {isEditing ? (
            <>
              <button type="button" className={legacy.button} disabled={!canSave || isSaving} onClick={save}>
                Save
              </button>
              <button type="button" className={legacy.buttonSecondary} disabled={isSaving} onClick={cancelEdit}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className={legacy.buttonSecondary} onClick={beginEdit}>
              Edit
            </button>
          )}
        </div>
      </div>
      <div className={legacy.sectionBody}>
        {error ? <p className={legacy.error}>{error}</p> : null}

        {isEditing && draft ? (
          <div className={legacy.formGrid}>
            <div className={legacy.field}>
              <label htmlFor="contactName">Contact</label>
              <input
                id="contactName"
                value={draft.contactName}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, contactName: e.target.value } : prev))}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="contactEmail">Email</label>
              <input
                id="contactEmail"
                value={draft.contactEmail}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, contactEmail: e.target.value } : prev))}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="contactPhone">Phone</label>
              <input
                id="contactPhone"
                value={draft.contactPhone}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, contactPhone: e.target.value } : prev))}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="projectName">Project name</label>
              <input
                id="projectName"
                value={draft.projectName}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, projectName: e.target.value } : prev))}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="siteAddress">Site address</label>
              <input
                id="siteAddress"
                value={draft.siteAddress}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, siteAddress: e.target.value } : prev))}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="region">Region</label>
              <input
                id="region"
                value={draft.region}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, region: e.target.value } : prev))}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="quoteRef">Quote ref</label>
              <input
                id="quoteRef"
                value={draft.quoteRef}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, quoteRef: e.target.value } : prev))}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="nextActionDate">Next action date (YYYY-MM-DD)</label>
              <input
                id="nextActionDate"
                value={draft.nextActionDate}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, nextActionDate: e.target.value } : prev))}
              />
              {!isValidYmd(draft.nextActionDate) ? <p className={legacy.error}>Invalid date format.</p> : null}
            </div>
          </div>
        ) : (
          <table className={legacy.table}>
            <tbody>
              <tr>
                <th>Contact</th>
                <td>{current.contactName || '—'}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td className={legacy.muted}>{current.contactEmail || '—'}</td>
              </tr>
              <tr>
                <th>Phone</th>
                <td className={legacy.muted}>{current.contactPhone || '—'}</td>
              </tr>
              <tr>
                <th>Project name</th>
                <td>{current.projectName || '—'}</td>
              </tr>
              <tr>
                <th>Site address</th>
                <td>{current.siteAddress || '—'}</td>
              </tr>
              <tr>
                <th>Region</th>
                <td>{current.region || '—'}</td>
              </tr>
              <tr>
                <th>Quote ref</th>
                <td>{current.quoteRef || '—'}</td>
              </tr>
              <tr>
                <th>Next action</th>
                <td className={legacy.muted}>{current.nextActionDate || '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
