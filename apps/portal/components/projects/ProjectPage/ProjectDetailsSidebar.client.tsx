'use client';

import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';
import { isValidProjectDetailsYmd, useProjectDetailsDraft } from './useProjectDetailsDraft';

export default function ProjectDetailsSidebarClient({ project }: { project: ProjectPageSnapshot['project'] }) {
  const {
    canRetry,
    canSave,
    displayed,
    draft,
    error,
    finishEditing,
    isEditing,
    isSaving,
    resetEditing,
    retry,
    reviewLocalDraft,
    saveCurrentDraft,
    setIsEditing,
    statusText,
    updateDraftField,
  } = useProjectDetailsDraft(project);

  return (
    <section className={legacy.section} aria-label="Project details">
      <div className={legacy.sectionHeader}>
        <h2 className={legacy.sectionTitle}>Details</h2>
        <div className={legacy.actions}>
          {statusText ? <span className={legacy.note}>{statusText}</span> : null}
          {isEditing ? (
            <>
              <button type="button" className={legacy.button} disabled={!canSave} onClick={finishEditing}>
                Done
              </button>
              <button type="button" className={legacy.buttonSecondary} disabled={isSaving} onClick={resetEditing}>
                Reset
              </button>
            </>
          ) : (
            <button type="button" className={legacy.buttonSecondary} onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>
      <div className={legacy.sectionBody}>
        {error ? (
          <div className={legacy.field} role="status">
            <p className={legacy.error}>{error}</p>
            {canRetry ? (
              <div className={legacy.actions}>
                <button type="button" className={legacy.buttonSecondary} onClick={() => void retry()}>
                  Retry now
                </button>
                <button type="button" className={legacy.buttonSecondary} onClick={reviewLocalDraft}>
                  Review changes
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {isEditing ? (
          <div className={legacy.formGrid}>
            <div className={legacy.field}>
              <label htmlFor="contactName">Contact</label>
              <input
                id="contactName"
                value={draft.contactName}
                onChange={(event) => updateDraftField('contactName', event.target.value)}
                onBlur={saveCurrentDraft}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="contactEmail">Email</label>
              <input
                id="contactEmail"
                value={draft.contactEmail}
                onChange={(event) => updateDraftField('contactEmail', event.target.value)}
                onBlur={saveCurrentDraft}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="contactPhone">Phone</label>
              <input
                id="contactPhone"
                value={draft.contactPhone}
                onChange={(event) => updateDraftField('contactPhone', event.target.value)}
                onBlur={saveCurrentDraft}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="projectName">Project name</label>
              <input
                id="projectName"
                value={draft.projectName}
                onChange={(event) => updateDraftField('projectName', event.target.value)}
                onBlur={saveCurrentDraft}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="siteAddress">Site address</label>
              <input
                id="siteAddress"
                value={draft.siteAddress}
                onChange={(event) => updateDraftField('siteAddress', event.target.value)}
                onBlur={saveCurrentDraft}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="region">Region</label>
              <input
                id="region"
                value={draft.region}
                onChange={(event) => updateDraftField('region', event.target.value)}
                onBlur={saveCurrentDraft}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="quoteRef">Quote ref</label>
              <input
                id="quoteRef"
                value={draft.quoteRef}
                onChange={(event) => updateDraftField('quoteRef', event.target.value)}
                onBlur={saveCurrentDraft}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="nextActionDate">Next action date (YYYY-MM-DD)</label>
              <input
                id="nextActionDate"
                value={draft.nextActionDate}
                onChange={(event) => updateDraftField('nextActionDate', event.target.value)}
                onBlur={saveCurrentDraft}
              />
              {!isValidProjectDetailsYmd(draft.nextActionDate) ? (
                <p className={legacy.error}>Invalid date format.</p>
              ) : null}
            </div>
          </div>
        ) : (
          <table className={legacy.table}>
            <tbody>
              <tr>
                <th>Contact</th>
                <td>{displayed.contactName || '—'}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td className={`${legacy.muted} ${legacy.cellWrap}`}>{displayed.contactEmail || '—'}</td>
              </tr>
              <tr>
                <th>Phone</th>
                <td className={legacy.muted}>{displayed.contactPhone || '—'}</td>
              </tr>
              <tr>
                <th>Project name</th>
                <td>{displayed.projectName || '—'}</td>
              </tr>
              <tr>
                <th>Site address</th>
                <td className={legacy.cellWrap}>{displayed.siteAddress || '—'}</td>
              </tr>
              <tr>
                <th>Region</th>
                <td>{displayed.region || '—'}</td>
              </tr>
              <tr>
                <th>Quote ref</th>
                <td>{displayed.quoteRef || '—'}</td>
              </tr>
              <tr>
                <th>Next action</th>
                <td className={legacy.muted}>{displayed.nextActionDate || '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
