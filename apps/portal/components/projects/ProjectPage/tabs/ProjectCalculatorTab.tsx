'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import CalculatorGridClient from '@/app/staff/calculator/CalculatorGridClient';
import CalculatorDesignNavigationSelect from '@/app/staff/calculator/CalculatorDesignNavigationSelect';
import type {
  CalculatorDesignNavigation,
  CalculatorProjectWorkspace,
} from '@/app/staff/calculator/calculatorWorkspace';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import styles from './ProjectCalculatorTab.module.css';

function versionNumber(label: string): number {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : Number.NEGATIVE_INFINITY;
}

function ProjectDesignNavigation({ navigation }: { navigation: CalculatorDesignNavigation }) {
  return (
    <div className={styles.stateToolbar} data-project-calculator-state-navigation="true">
      <strong>{navigation.stateLabel}</strong>
      <CalculatorDesignNavigationSelect navigation={navigation} className={styles.selector} />
    </div>
  );
}

function UnavailableDesignNavigation({ label }: { label: string }) {
  return (
    <div className={styles.stateToolbar} data-project-calculator-state-navigation="true">
      <strong>{label}</strong>
      <label>
        <span className="sr-only">Design version</span>
        <select className={styles.selector} aria-label="Design version" disabled defaultValue="unavailable">
          <option value="unavailable">Designs unavailable</option>
        </select>
      </label>
    </div>
  );
}

export default function ProjectCalculatorTab({
  host,
  projectId,
}: {
  host: string;
  projectId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const estimatesQuery = useQuery(estimateMetasByProjectQueryOptions(host, projectId));
  const estimates = useMemo(
    () => [...(estimatesQuery.data ?? [])].sort((a, b) => versionNumber(b.versionLabel) - versionNumber(a.versionLabel)),
    [estimatesQuery.data],
  );
  const activeDraft = estimates.find((estimate) => estimate.isActiveDraft) ?? null;
  const editEstimateId = searchParams.get('estimateId')?.trim() ?? '';
  const fromEstimateId = searchParams.get('fromEstimateId')?.trim() ?? '';
  const newDesign = searchParams.get('newDesign') === '1';
  const selectedEstimate = estimates.find((estimate) => estimate.id === editEstimateId) ?? null;
  const revisionSource = estimates.find((estimate) => estimate.id === fromEstimateId) ?? null;

  const replaceParams = useCallback((update: (query: URLSearchParams) => void) => {
    const query = new URLSearchParams(searchParams.toString());
    update(query);
    router.replace(`${pathname}?${query.toString()}`);
  }, [pathname, router, searchParams]);

  const openDraft = useCallback((estimateId: string) => {
    replaceParams((query) => {
      query.set('tab', 'estimates');
      query.set('estimateId', estimateId);
      query.delete('fromEstimateId');
      query.delete('newDesign');
    });
  }, [replaceParams]);

  const openBlankDesign = useCallback(() => {
    replaceParams((query) => {
      query.set('tab', 'estimates');
      query.set('newDesign', '1');
      query.delete('estimateId');
      query.delete('fromEstimateId');
    });
  }, [replaceParams]);

  const startRevision = useCallback((estimateId: string) => {
    replaceParams((query) => {
      query.set('tab', 'estimates');
      query.set('fromEstimateId', estimateId);
      query.delete('estimateId');
      query.delete('newDesign');
    });
  }, [replaceParams]);

  useEffect(() => {
    if (estimatesQuery.isPending || estimatesQuery.isError) return;
    if (editEstimateId || fromEstimateId || newDesign) return;
    if (activeDraft) openDraft(activeDraft.id);
    else openBlankDesign();
  }, [activeDraft, editEstimateId, estimatesQuery.isError, estimatesQuery.isPending, fromEstimateId, newDesign, openBlankDesign, openDraft]);

  const handleSelection = useCallback((value: string) => {
    if (value === 'new') {
      openBlankDesign();
      return;
    }
    const [kind, estimateId] = value.split(':', 2);
    if (!estimateId) return;
    if (kind === 'draft') openDraft(estimateId);
    else replaceParams((query) => {
      query.set('tab', 'estimates');
      query.set('estimateId', estimateId);
      query.delete('fromEstimateId');
      query.delete('newDesign');
    });
  }, [openBlankDesign, openDraft, replaceParams]);

  const selectionValue = selectedEstimate
    ? `${selectedEstimate.isActiveDraft ? 'draft' : 'history'}:${selectedEstimate.id}`
    : revisionSource
      ? `revision:${revisionSource.id}`
      : 'new';

  const designNavigation = useMemo<CalculatorDesignNavigation>(() => ({
    value: selectionValue,
    stateLabel: revisionSource
      ? `Revision from ${revisionSource.versionLabel}`
      : newDesign
        ? 'Blank design'
        : selectedEstimate
          ? `${selectedEstimate.isActiveDraft ? 'Current draft' : 'Revision source'} · ${selectedEstimate.versionLabel}`
          : 'Project design',
    options: [
      ...(activeDraft ? [{ value: `draft:${activeDraft.id}`, label: `Current draft · ${activeDraft.versionLabel}` }] : []),
      { value: 'new', label: 'Start a blank design' },
      ...estimates
        .filter((estimate) => !estimate.isActiveDraft)
        .map((estimate) => ({ value: `history:${estimate.id}`, label: `Revision source · ${estimate.versionLabel}` })),
      ...(revisionSource ? [{ value: `revision:${revisionSource.id}`, label: `Revision from ${revisionSource.versionLabel}` }] : []),
    ],
    onChange: handleSelection,
  }), [activeDraft, estimates, handleSelection, newDesign, revisionSource, selectedEstimate, selectionValue]);

  const onEstimateSaved = useCallback((estimateId: string) => openDraft(estimateId), [openDraft]);
  const onOpenProject = useCallback(() => {
    replaceParams((query) => {
      query.set('tab', 'activity');
      query.delete('estimateId');
      query.delete('fromEstimateId');
      query.delete('newDesign');
    });
  }, [replaceParams]);
  const workspace = useMemo<CalculatorProjectWorkspace>(() => ({
    kind: 'project',
    host,
    projectId,
    editEstimateId: selectedEstimate?.isActiveDraft ? selectedEstimate.id : undefined,
    fromEstimateId: revisionSource?.id,
    createNewEstimate: newDesign || Boolean(revisionSource),
    designNavigation,
    onEstimateSaved,
    onOpenProject,
  }), [designNavigation, host, newDesign, onEstimateSaved, onOpenProject, projectId, revisionSource, selectedEstimate]);

  if (estimatesQuery.isPending) {
    return (
      <div className={styles.container} data-project-calculator="true">
        <UnavailableDesignNavigation label="Loading project designs" />
        <div className={styles.state} role="status">Loading project designs…</div>
      </div>
    );
  }

  if (estimatesQuery.isError) {
    return (
      <div className={styles.container} data-project-calculator="true">
        <UnavailableDesignNavigation label="Project designs unavailable" />
        <div className={styles.state} role="alert">
          <h2>Couldn&apos;t load project designs</h2>
          <p>{estimatesQuery.error instanceof Error ? estimatesQuery.error.message : 'Try again.'}</p>
          <button type="button" onClick={() => void estimatesQuery.refetch()}>Retry</button>
        </div>
      </div>
    );
  }

  const invalidSelection = editEstimateId && !selectedEstimate;
  const invalidRevision = fromEstimateId && !revisionSource;
  const historicalSelection = selectedEstimate && !selectedEstimate.isActiveDraft;

  return (
    <div className={styles.container} data-project-calculator="true">
      {historicalSelection || invalidSelection || invalidRevision ? <ProjectDesignNavigation navigation={designNavigation} /> : null}

      {historicalSelection ? (
        <section className={styles.state} data-calculator-locked-source="true">
          <h2>{selectedEstimate.versionLabel} is historical</h2>
          <p>Saved historical designs are revision sources and cannot be edited directly.</p>
          <button type="button" onClick={() => startRevision(selectedEstimate.id)}>Start revision</button>
        </section>
      ) : invalidSelection || invalidRevision ? (
        <section className={styles.state} data-calculator-invalid-source="true">
          <h2>Design unavailable</h2>
          <p>The requested design no longer belongs to this project.</p>
          <button type="button" onClick={() => activeDraft ? openDraft(activeDraft.id) : openBlankDesign()}>
            {activeDraft ? 'Open current draft' : 'Start a blank design'}
          </button>
        </section>
      ) : editEstimateId || fromEstimateId || newDesign ? (
        <div className={styles.calculatorSurface}>
          <CalculatorGridClient workspace={workspace} />
        </div>
      ) : (
        <div className={styles.state} role="status">Opening Calculator…</div>
      )}
    </div>
  );
}
