'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CostingControlConfigV1 } from '@sp/costing';
import type { CostingConfigurationVersion } from '@/lib/costing/configurationTypes';
import type {
  CostingConfigurationComparison,
  CostingConfigurationOverview,
} from '@/lib/costing/configurationAdmin';
import {
  LabourEditor,
  MaterialsEditor,
  OverheadsEditor,
  RulesEditor,
} from './CostingControlEditors';
import {
  CostingStatusSummary,
  CostingWorkflow,
  VersionHistory,
} from './CostingControlOverview';
import {
  CostingComparison,
  CostingPublishPanel,
} from './CostingControlReview';
import {
  CostingDraftDialog,
  CostingDraftMetadataEditor,
  type DraftDialogState,
} from './CostingDraftMetadata';
import {
  COSTING_CONFIGURATION_NAME_MAX,
  validateCostingConfigurationMetadata,
  type CostingConfigurationMetadataIssue,
} from '@/lib/costing/configurationMetadata';
import {
  formatCostingDate,
  formatSettingPath,
  countCostingChangesBySection,
  sectionForIssuePath,
  type CostingControlSection,
  type ValidationIssue,
} from './costingControlModel';
import styles from './costingControl.module.css';

type Catalog = {
  materials: Array<{
    id: string;
    label: string;
    unit: string;
    category: string;
    supplier: string | null;
    product: string | null;
    note: string | null;
    assumption: boolean;
  }>;
  actions: Array<{ id: string; label: string }>;
};

type EditorPayload = {
  version: CostingConfigurationVersion;
  comparison: CostingConfigurationComparison | null;
  catalog: Catalog;
};

const SETTING_SECTIONS: Array<[Exclude<CostingControlSection, 'comparison' | 'publish'>, string]> = [
  ['materials', 'Materials'],
  ['labour', 'Labour & time'],
  ['overheads', 'Overheads'],
  ['rules', 'Supported rules'],
];

function canPublishComparison(comparison: CostingConfigurationComparison | null): boolean {
  return Boolean(
    comparison
    && (
      comparison.diff.length > 0
      || (comparison.currentVersionId === null && comparison.currentSource === 'legacy-overrides')
    ),
  );
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(String(data?.error ?? 'Request failed')) as Error & {
      issues?: ValidationIssue[];
      metadataIssues?: CostingConfigurationMetadataIssue[];
    };
    error.issues = Array.isArray(data?.issues) ? data.issues : undefined;
    error.metadataIssues = Array.isArray(data?.metadataIssues) ? data.metadataIssues : undefined;
    throw error;
  }
  return data as T;
}

function currentWorkflowStep(
  editor: EditorPayload | null,
  section: CostingControlSection,
): 1 | 2 | 3 | 4 {
  if (!editor) return 1;
  if (section === 'publish') return 4;
  if (section === 'comparison' || editor.version.status === 'published') return 3;
  return 2;
}

export default function CostingControlCentre({ initialOverview }: { initialOverview: CostingConfigurationOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [editor, setEditor] = useState<EditorPayload | null>(null);
  const [config, setConfig] = useState<CostingControlConfigV1 | null>(null);
  const [section, setSection] = useState<CostingControlSection>('materials');
  const [search, setSearch] = useState('');
  const [showChangedOnly, setShowChangedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [publishNote, setPublishNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPurpose, setDraftPurpose] = useState('');
  const [metadataIssues, setMetadataIssues] = useState<CostingConfigurationMetadataIssue[]>([]);
  const [validationState, setValidationState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [draftDialog, setDraftDialog] = useState<DraftDialogState | null>(null);
  const publishPanelRef = useRef<HTMLDivElement>(null);

  const versionById = useMemo(
    () => new Map(overview.versions.map((version) => [version.id, version])),
    [overview.versions],
  );
  const latestDraft = overview.versions.find((version) => version.status === 'draft') ?? null;
  const currentVersion = overview.currentVersionId ? versionById.get(overview.currentVersionId) ?? null : null;
  const materialLabels = useMemo(
    () => new Map(editor?.catalog.materials.map((item) => [item.id, item.label]) ?? []),
    [editor],
  );
  const actionLabels = useMemo(
    () => new Map(editor?.catalog.actions.map((item) => [item.id, item.label]) ?? []),
    [editor],
  );
  const readOnly = editor?.version.status !== 'draft';
  const baseline = editor?.comparison?.baselineConfig ?? editor?.version.config ?? null;
  const workflowStep = currentWorkflowStep(editor, section);
  const changedCounts = useMemo(
    () => config && baseline
      ? countCostingChangesBySection(config, baseline)
      : { materials: 0, labour: 0, overheads: 0, rules: 0 },
    [baseline, config],
  );

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLink = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank') return;
      if (new URL(link.href, window.location.href).href === window.location.href) return;
      if (!window.confirm('Leave this draft? Your unsaved costing changes will be lost.')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardLink, true);
    };
  }, [dirty]);

  useEffect(() => {
    if (section === 'publish') {
      publishPanelRef.current?.focus();
    }
  }, [section]);

  useEffect(() => {
    if (!dirty || !config || editor?.version.status !== 'draft') {
      setValidationState(editor?.version.status === 'draft' ? 'valid' : 'idle');
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setValidationState('checking');
      try {
        await requestJson<{ valid: true; issues: [] }>('/api/admin/costing/validate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config }),
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setIssues([]);
          setValidationState('valid');
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        const nextIssues = (caught as Error & { issues?: ValidationIssue[] }).issues ?? [];
        setIssues(nextIssues);
        setValidationState(nextIssues.length ? 'invalid' : 'idle');
      }
    }, 450);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [config, dirty, editor?.version.status]);

  const confirmDiscard = () => (
    !dirty || window.confirm('Discard your unsaved costing changes?')
  );

  const refreshOverview = async () => {
    setOverview(await requestJson<CostingConfigurationOverview>('/api/admin/costing/configurations'));
  };

  const loadVersion = async (versionId: string, landing?: CostingControlSection) => {
    const next = await requestJson<EditorPayload>(
      `/api/admin/costing/configurations/${encodeURIComponent(versionId)}`,
    );
    setEditor(next);
    setConfig(structuredClone(next.version.config));
    setDraftName(next.version.name);
    setDraftPurpose(next.version.purpose);
    setDirty(false);
    setIssues([]);
    setShowChangedOnly(false);
    setSection(landing ?? (next.version.status === 'draft' ? 'materials' : 'comparison'));
  };

  const openVersion = async (versionId: string, landing?: CostingControlSection) => {
    if (!confirmDiscard()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await loadVersion(versionId, landing);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to open pricing configuration');
    } finally {
      setBusy(false);
    }
  };

  const createDraft = (sourceVersionId?: string) => {
    if (!confirmDiscard()) return;
    const source = sourceVersionId ? versionById.get(sourceVersionId) : null;
    setDraftDialog({
      sourceVersionId: sourceVersionId ?? null,
      name: source ? `Copy of ${source.name}`.slice(0, COSTING_CONFIGURATION_NAME_MAX) : 'Pricing update',
      purpose: source?.purpose ?? '',
    });
  };

  const submitDraft = async () => {
    if (!draftDialog) return;
    const source = draftDialog.sourceVersionId
      ? versionById.get(draftDialog.sourceVersionId) ?? null
      : null;
    const metadata = validateCostingConfigurationMetadata(draftDialog);
    if (!metadata.ok) {
      setMetadataIssues(metadata.issues);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await requestJson<{ version: CostingConfigurationVersion }>(
        '/api/admin/costing/configurations',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceVersionId: draftDialog.sourceVersionId,
            ...metadata.value,
          }),
        },
      );
      setDraftDialog(null);
      setMetadataIssues([]);
      await refreshOverview();
      await loadVersion(created.version.id);
      setMessage(
        `Draft v${created.version.versionNumber} created from ${
          source ? `${source.name} (v${source.versionNumber})` : 'the active pricing settings'
        }.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create pricing draft');
    } finally {
      setBusy(false);
    }
  };

  const updateConfig = (mutate: (next: CostingControlConfigV1) => void) => {
    if (!config || editor?.version.status !== 'draft') return;
    const next = structuredClone(config);
    mutate(next);
    setConfig(next);
    setDirty(
      JSON.stringify(next) !== JSON.stringify(editor.version.config)
      || draftName.trim() !== editor.version.name
      || draftPurpose.trim() !== editor.version.purpose,
    );
    setMessage(null);
    setIssues([]);
    setConfirmed(false);
  };

  const updateMetadata = (field: 'name' | 'purpose', value: string) => {
    if (!editor || !config || editor.version.status !== 'draft') return;
    const nextName = field === 'name' ? value : draftName;
    const nextPurpose = field === 'purpose' ? value : draftPurpose;
    if (field === 'name') setDraftName(value);
    else setDraftPurpose(value);
    setMetadataIssues([]);
    setDirty(
      JSON.stringify(config) !== JSON.stringify(editor.version.config)
      || nextName.trim() !== editor.version.name
      || nextPurpose.trim() !== editor.version.purpose,
    );
    setMessage(null);
    setConfirmed(false);
  };

  const saveDraft = async (landing?: CostingControlSection) => {
    if (!editor || !config) return;
    setBusy(true);
    setError(null);
    setIssues([]);
    try {
      const saved = await requestJson<EditorPayload>(
        `/api/admin/costing/configurations/${encodeURIComponent(editor.version.id)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedContentHash: editor.version.contentHash,
            expectedUpdatedAt: editor.version.updatedAt,
            config,
            name: draftName,
            purpose: draftPurpose,
          }),
        },
      );
      setEditor(saved);
      setConfig(structuredClone(saved.version.config));
      setDraftName(saved.version.name);
      setDraftPurpose(saved.version.purpose);
      setDirty(false);
      setMessage('Draft saved and validated. The comparison and impact preview are up to date.');
      if (landing) setSection(landing);
      await refreshOverview();
    } catch (caught) {
      const value = caught as Error & {
        issues?: ValidationIssue[];
        metadataIssues?: CostingConfigurationMetadataIssue[];
      };
      const nextIssues = value.issues ?? [];
      const nextMetadataIssues = value.metadataIssues ?? [];
      setMetadataIssues(nextMetadataIssues);
      setError(
        nextIssues.length
          ? 'Some values need attention before this draft can be saved.'
          : nextMetadataIssues.length
            ? 'Add a clear name and purpose before saving this draft.'
            : value.message,
      );
      setIssues(nextIssues);
      const firstSection = sectionForIssuePath(nextIssues[0]?.path);
      if (firstSection) setSection(firstSection);
    } finally {
      setBusy(false);
    }
  };

  const reviewImpact = async () => {
    if (dirty) {
      await saveDraft('comparison');
      return;
    }
    setSection('comparison');
  };

  const publishDraft = async () => {
    if (!editor || dirty || !confirmed) return;
    if (!window.confirm('Publish this pricing version? Future calculations will use it immediately.')) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestJson<{ version: CostingConfigurationVersion }>(
        `/api/admin/costing/configurations/${encodeURIComponent(editor.version.id)}/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedContentHash: editor.version.contentHash,
            expectedCurrentVersionId: editor.comparison?.currentVersionId ?? null,
            publishNote,
          }),
        },
      );
      setMessage(`Pricing version ${result.version.versionNumber} published.`);
      setConfirmed(false);
      setPublishNote('');
      await refreshOverview();
      await loadVersion(result.version.id, 'comparison');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to publish pricing version');
    } finally {
      setBusy(false);
    }
  };

  const goToOverview = () => {
    if (!confirmDiscard()) return;
    setEditor(null);
    setConfig(null);
    setDraftName('');
    setDraftPurpose('');
    setDirty(false);
    setIssues([]);
    setMessage(null);
    setError(null);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Pricebook</div>
          <h1 className={styles.title}>Costing control centre</h1>
          <p className={styles.lede}>
            Refine supported rates and allowances, see the likely pricing impact, then publish a fully
            audited version for future estimates.
          </p>
        </div>
        {latestDraft ? (
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() => openVersion(latestDraft.id)}
          >
            Continue draft v{latestDraft.versionNumber}
          </button>
        ) : (
          <button className={styles.button} type="button" disabled={busy} onClick={() => createDraft()}>
            Create first draft
          </button>
        )}
      </header>

      <CostingWorkflow
        currentStep={workflowStep}
        hasEditor={Boolean(editor)}
        canPublish={Boolean(editor && !readOnly)}
        onOverview={goToOverview}
        onEdit={() => setSection('materials')}
        onReview={reviewImpact}
        onPublish={() => setSection('publish')}
      />

      <CostingStatusSummary
        currentVersion={currentVersion}
        latestDraft={latestDraft}
        selectedVersion={editor?.version ?? null}
        dirty={dirty}
      />

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {message ? <div className={styles.success} role="status">{message}</div> : null}
      {issues.length ? (
        <div className={styles.error} role="alert">
          <strong>Fix {issues.length === 1 ? 'this value' : `these ${issues.length} values`}:</strong>
          <ul className={styles.issueList}>
            {issues.map((issue, index) => {
              const issueSection = sectionForIssuePath(issue.path);
              return (
                <li key={`${issue.path}-${index}`}>
                  <button
                    className={styles.issueLink}
                    type="button"
                    disabled={!issueSection}
                    onClick={() => {
                      if (issueSection) setSection(issueSection);
                    }}
                  >
                    {formatSettingPath(issue.path ?? 'setting', materialLabels, actionLabels)}
                  </button>
                  : {issue.message}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {draftDialog ? (
        <CostingDraftDialog
          value={draftDialog}
          issues={metadataIssues}
          busy={busy}
          onChange={setDraftDialog}
          onCancel={() => {
            setDraftDialog(null);
            setMetadataIssues([]);
          }}
          onCreate={submitDraft}
        />
      ) : null}

      {!editor ? (
        <section className={styles.onboardingCard}>
          <div>
            <div className={styles.eyebrow}>Step 1 · Overview</div>
            <h2>{latestDraft ? 'Continue the current pricing review' : 'Start with a safe draft'}</h2>
            <p>
              {latestDraft
                ? 'Open the existing draft to review its settings, validate it and inspect representative project impacts.'
                : 'A draft begins as an exact copy of the active calculator settings. Nothing changes for staff or customers until an admin explicitly publishes it.'}
            </p>
          </div>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() => latestDraft ? openVersion(latestDraft.id) : createDraft()}
          >
            {latestDraft ? `Open draft v${latestDraft.versionNumber}` : 'Create first draft'}
          </button>
        </section>
      ) : null}

      <VersionHistory
        overview={overview}
        versionById={versionById}
        selectedId={editor?.version.id ?? null}
        busy={busy}
        onOpen={openVersion}
        onClone={createDraft}
      />

      {editor && config && baseline ? (
        <section className={styles.editorCard}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.eyebrow}>
                {readOnly ? 'Published pricing record' : 'Step 2 · Edit settings'}
              </div>
              <h2>{readOnly ? 'Pricing' : 'Draft'} version {editor.version.versionNumber}</h2>
              <p className={styles.versionName}>{editor.version.name}</p>
              <p className={styles.muted}>
                {readOnly
                  ? `Published ${formatCostingDate(editor.version.publishedAt)} by ${editor.version.publishedByEmail}.`
                  : `Last saved ${formatCostingDate(editor.version.updatedAt)} by ${editor.version.updatedByEmail}.`}
              </p>
            </div>
            <span className={`${styles.badge} ${readOnly ? styles.published : styles.draft}`}>
              {editor.version.id === overview.currentVersionId
                ? 'Current published'
                : readOnly
                  ? 'Superseded'
                  : dirty
                    ? 'Draft · unsaved'
                    : 'Draft · saved'}
            </span>
          </div>

          <CostingDraftMetadataEditor
            readOnly={readOnly}
            persistedPurpose={editor.version.purpose}
            name={draftName}
            purpose={draftPurpose}
            issues={metadataIssues}
            onChange={updateMetadata}
          />

          {editor.version.publishNote ? (
            <div className={styles.publicationNote}>
              <strong>Why this version was published</strong>
              <span>{editor.version.publishNote}</span>
            </div>
          ) : null}

          <details className={styles.technicalDetails}>
            <summary>Technical details</summary>
            <dl>
              <div><dt>Internal version ID</dt><dd><code>{editor.version.id}</code></dd></div>
              <div><dt>Content hash</dt><dd><code>{editor.version.contentHash}</code></dd></div>
              <div><dt>Schema</dt><dd><code>{editor.version.schemaVersion}</code></dd></div>
              <div><dt>Base manifest</dt><dd><code>{editor.version.baseManifestVersion}</code></dd></div>
            </dl>
          </details>

          <div className={styles.editorControls}>
            <div className={styles.tabs} role="tablist" aria-label="Costing settings">
              {SETTING_SECTIONS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={section === key}
                  className={`${styles.tab} ${section === key ? styles.tabActive : ''}`}
                  onClick={() => setSection(key)}
                >
                  {label}
                  {changedCounts[key] ? <span className={styles.tabCount}>{changedCounts[key]}</span> : null}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={section === 'comparison' || section === 'publish'}
                className={`${styles.tab} ${
                  section === 'comparison' || section === 'publish' ? styles.tabActive : ''
                }`}
                onClick={reviewImpact}
              >
                Review impact
              </button>
            </div>
            {!readOnly && SETTING_SECTIONS.some(([key]) => key === section) ? (
              <label className={styles.changedFilter}>
                <input
                  type="checkbox"
                  checked={showChangedOnly}
                  onChange={(event) => setShowChangedOnly(event.target.checked)}
                />
                Show changed only
              </label>
            ) : null}
          </div>

          {section === 'materials' ? (
            <MaterialsEditor
              materials={editor.catalog.materials}
              config={config}
              baseline={baseline}
              readOnly={readOnly}
              search={search}
              onSearchChange={setSearch}
              showChangedOnly={showChangedOnly}
              issues={issues}
              updateConfig={updateConfig}
            />
          ) : null}
          {section === 'labour' ? (
            <LabourEditor
              config={config}
              baseline={baseline}
              readOnly={readOnly}
              showChangedOnly={showChangedOnly}
              issues={issues}
              actionLabels={actionLabels}
              updateConfig={updateConfig}
            />
          ) : null}
          {section === 'overheads' ? (
            <OverheadsEditor
              config={config}
              baseline={baseline}
              readOnly={readOnly}
              showChangedOnly={showChangedOnly}
              issues={issues}
              updateConfig={updateConfig}
            />
          ) : null}
          {section === 'rules' ? (
            <RulesEditor
              config={config}
              baseline={baseline}
              readOnly={readOnly}
              showChangedOnly={showChangedOnly}
              issues={issues}
              updateConfig={updateConfig}
            />
          ) : null}
          {section === 'comparison' || section === 'publish' ? (
            <CostingComparison
              comparison={editor.comparison}
              version={editor.version}
              materialLabels={materialLabels}
              actionLabels={actionLabels}
              dirty={dirty}
            />
          ) : null}

          {section === 'publish' && !readOnly ? (
            <CostingPublishPanel
              panelRef={publishPanelRef}
              publishNote={publishNote}
              confirmed={confirmed}
              busy={busy}
              dirty={dirty}
              publishable={canPublishComparison(editor.comparison)}
              initialBaseline={Boolean(
                editor.comparison
                && editor.comparison.currentVersionId === null
                && editor.comparison.currentSource === 'legacy-overrides'
                && editor.comparison.diff.length === 0,
              )}
              onPublishNoteChange={setPublishNote}
              onConfirmedChange={setConfirmed}
              onPublish={publishDraft}
            />
          ) : null}

          {!readOnly ? (
            <div className={styles.stickyToolbar}>
              <div className={dirty ? styles.unsavedStatus : styles.savedStatus}>
                <span className={styles.statusDot} aria-hidden="true" />
                <span>
                  <strong>{dirty ? 'Unsaved changes' : 'Saved and validated'}</strong>
                  <small>
                    {dirty && validationState === 'checking'
                      ? 'Checking typed and cross-field rules…'
                      : dirty && validationState === 'invalid'
                        ? 'Fix the highlighted validation issues before saving.'
                        : dirty && validationState === 'valid'
                          ? 'Current values pass validation; save to refresh previews.'
                      : dirty
                        ? 'Save to refresh the comparison and impact preview.'
                      : 'The server accepted every typed setting.'}
                  </small>
                </span>
              </div>
              <div className={styles.toolbarActions}>
                <button
                  className={styles.buttonSecondary}
                  type="button"
                  disabled={busy || !dirty}
                  onClick={() => saveDraft()}
                >
                  Save & validate
                </button>
                {section !== 'publish' ? (
                  <button className={styles.button} type="button" disabled={busy} onClick={reviewImpact}>
                    {dirty ? 'Save & review impact' : 'Review impact'}
                  </button>
                ) : null}
                {section === 'comparison' && !dirty ? (
                  <button
                    className={styles.button}
                    type="button"
                    disabled={busy || !canPublishComparison(editor.comparison)}
                    onClick={() => setSection('publish')}
                  >
                    Continue to publish
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={styles.readOnlyToolbar}>
              <span>Published versions are immutable.</span>
              <button
                className={styles.buttonSecondary}
                type="button"
                disabled={busy}
                onClick={() => createDraft(editor.version.id)}
              >
                Clone as new draft
              </button>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
