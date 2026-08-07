'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import CalculatorGridClient from '@/app/staff/calculator/CalculatorGridClient';
import CalculatorDesignNavigationSelect from '@/app/staff/calculator/CalculatorDesignNavigationSelect';
import type {
  CalculatorDesignNavigation,
  CalculatorProjectWorkspace,
} from '@/app/staff/calculator/calculatorWorkspace';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { Button, Card, DataStatePanel, Select } from '@/components/ui/foundation';
import ProjectCalculatorPendingFrame from './ProjectCalculatorPendingFrame';
import styles from './ProjectCalculatorTab.module.css';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';

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
      <div className={styles.selectorField}>
        <Select className={styles.selector} aria-label="Design version" disabled defaultValue="unavailable">
          <option value="unavailable">Designs unavailable</option>
        </Select>
      </div>
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
  const { navigateRoute } = usePortalRouteTransition();
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
    navigateRoute(
      { href: `${pathname}?${query.toString()}`, label: 'Calculator', source: 'project-calculator' },
      { replace: true, scroll: false },
    );
  }, [navigateRoute, pathname, searchParams]);

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
    return <ProjectCalculatorPendingFrame />;
  }

  if (estimatesQuery.isError) {
    return (
      <div
        className={styles.container}
        data-project-calculator="true"
        data-project-calculator-state="error"
        data-portal-page-shell="project-calculator"
        data-portal-page-shell-ready="true"
      >
        <UnavailableDesignNavigation label="Project designs unavailable" />
        <DataStatePanel
          state="error"
          title="Could not load project designs"
          description={estimatesQuery.error instanceof Error ? estimatesQuery.error.message : 'Try again.'}
          onRetry={() => void estimatesQuery.refetch()}
        />
      </div>
    );
  }

  const invalidSelection = editEstimateId && !selectedEstimate;
  const invalidRevision = fromEstimateId && !revisionSource;
  const historicalSelection = selectedEstimate && !selectedEstimate.isActiveDraft;

  if (!editEstimateId && !fromEstimateId && !newDesign) {
    return <ProjectCalculatorPendingFrame />;
  }

  return (
    <div
      className={styles.container}
      data-project-calculator="true"
      data-project-calculator-state={historicalSelection
        ? 'locked'
        : invalidSelection || invalidRevision
          ? 'invalid'
          : editEstimateId || fromEstimateId || newDesign
            ? 'ready'
            : 'opening'}
      data-portal-page-shell="project-calculator"
      data-portal-page-shell-ready="true"
    >
      {historicalSelection || invalidSelection || invalidRevision ? <ProjectDesignNavigation navigation={designNavigation} /> : null}

      {historicalSelection ? (
        <Card title={`${selectedEstimate.versionLabel} is historical`} padding="compact" data-calculator-locked-source="true">
          <div className={styles.stateContent}>
            <p>Saved historical designs are revision sources and cannot be edited directly.</p>
            <Button type="button" onClick={() => startRevision(selectedEstimate.id)}>Start revision</Button>
          </div>
        </Card>
      ) : invalidSelection || invalidRevision ? (
        <Card title="Design unavailable" padding="compact" data-calculator-invalid-source="true">
          <div className={styles.stateContent}>
            <p>The requested design no longer belongs to this project.</p>
            <Button type="button" onClick={() => activeDraft ? openDraft(activeDraft.id) : openBlankDesign()}>
              {activeDraft ? 'Open current draft' : 'Start a blank design'}
            </Button>
          </div>
        </Card>
      ) : editEstimateId || fromEstimateId || newDesign ? (
        <div className={styles.calculatorSurface}>
          <CalculatorGridClient workspace={workspace} />
        </div>
      ) : null}
    </div>
  );
}
