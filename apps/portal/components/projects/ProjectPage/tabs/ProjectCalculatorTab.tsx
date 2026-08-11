'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CalculatorGridClient from '@/app/staff/calculator/CalculatorGridClient';
import CalculatorDesignNavigationSelect from '@/app/staff/calculator/CalculatorDesignNavigationSelect';
import type {
  CalculatorDesignNavigation,
  CalculatorProjectWorkspace,
} from '@/app/staff/calculator/calculatorWorkspace';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { Button, Card, DataStatePanel, LoadingSkeleton, Select } from '@/components/ui/foundation';
import EstimatesListView from './EstimatesListView';
import styles from './ProjectCalculatorTab.module.css';
import CommercialInternalNameDialog from './CommercialInternalNameDialog';
import { copiedCommercialInternalName } from '@/lib/commercial/internalName';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from '@/lib/queries/keys';
import type { EstimateDetail, EstimateMeta } from '@/lib/estimates/types';
import { useToast } from '@/components/ui/toast/ToastProvider';

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
  projectName = 'Project estimate',
}: {
  host: string;
  projectId: string;
  projectName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [createNameOpen, setCreateNameOpen] = useState(false);
  const [createKind, setCreateKind] = useState<'base' | 'add_on'>('base');
  const [renameTarget, setRenameTarget] = useState<EstimateMeta | null>(null);
  const [renamePending, setRenamePending] = useState(false);
  const estimatesQuery = useQuery(estimateMetasByProjectQueryOptions(host, projectId));
  const estimates = useMemo(
    () => [...(estimatesQuery.data ?? [])].sort((a, b) => versionNumber(b.versionLabel) - versionNumber(a.versionLabel)),
    [estimatesQuery.data],
  );
  const activeDrafts = useMemo(
    () => estimates.filter((estimate) => estimate.isActiveDraft),
    [estimates],
  );
  const activeDraft = activeDrafts.find((estimate) => estimate.commercialScopeKind !== 'add_on')
    ?? activeDrafts[0]
    ?? null;
  const editEstimateId = searchParams.get('estimateId')?.trim() ?? '';
  const fromEstimateId = searchParams.get('fromEstimateId')?.trim() ?? '';
  const newDesign = searchParams.get('newDesign') === '1';
  const newEstimateInternalName = searchParams.get('estimateName')?.trim() || null;
  const requestedCommercialScopeId = searchParams.get('commercialScopeId')?.trim() || null;
  const requestedEstimateKind = searchParams.get('estimateKind') === 'add_on' ? 'add_on' : 'base';
  const selectedEstimate = estimates.find((estimate) => estimate.id === editEstimateId) ?? null;
  const revisionSource = estimates.find((estimate) => estimate.id === fromEstimateId) ?? null;

  const replaceParams = useCallback((update: (query: URLSearchParams) => void) => {
    const query = new URLSearchParams(searchParams.toString());
    update(query);
    router.replace(`${pathname}?${query.toString()}`);
  }, [pathname, router, searchParams]);

  const pushParams = useCallback((update: (query: URLSearchParams) => void) => {
    const query = new URLSearchParams(searchParams.toString());
    update(query);
    router.push(`${pathname}?${query.toString()}`);
  }, [pathname, router, searchParams]);

  const openDraft = useCallback((estimateId: string) => {
    replaceParams((query) => {
      query.set('tab', 'estimates');
      query.set('estimateId', estimateId);
      query.delete('fromEstimateId');
      query.delete('newDesign');
      query.delete('estimateName');
      query.delete('estimateKind');
      query.delete('commercialScopeId');
    });
  }, [replaceParams]);

  const openBlankDesign = useCallback(() => {
    replaceParams((query) => {
      query.set('tab', 'estimates');
      query.set('newDesign', '1');
      query.delete('estimateId');
      query.delete('fromEstimateId');
      query.delete('estimateName');
      query.delete('estimateKind');
      query.delete('commercialScopeId');
    });
  }, [replaceParams]);

  const startRevision = useCallback((estimateId: string) => {
    replaceParams((query) => {
      query.set('tab', 'estimates');
      query.set('fromEstimateId', estimateId);
      query.delete('estimateId');
      query.delete('newDesign');
      query.delete('estimateName');
      const source = estimates.find((estimate) => estimate.id === estimateId);
      if (source?.commercialScopeKind === 'add_on' && source.commercialScopeId) {
        query.set('estimateKind', 'add_on');
        query.set('commercialScopeId', source.commercialScopeId);
      } else {
        query.delete('estimateKind');
        query.delete('commercialScopeId');
      }
    });
  }, [estimates, replaceParams]);

  const openFromList = useCallback((estimateId: string) => {
    pushParams((query) => {
      query.set('tab', 'estimates');
      query.set('estimateId', estimateId);
      query.delete('fromEstimateId');
      query.delete('newDesign');
      query.delete('estimateName');
      query.delete('estimateKind');
      query.delete('commercialScopeId');
    });
  }, [pushParams]);

  const createFromList = useCallback(() => {
    setCreateKind('base');
    setCreateNameOpen(true);
  }, []);

  const createAddOnFromList = useCallback(() => {
    setCreateKind('add_on');
    setCreateNameOpen(true);
  }, []);

  const createNamedEstimate = useCallback((internalName: string | null) => {
    setCreateNameOpen(false);
    pushParams((query) => {
      query.set('tab', 'estimates');
      query.set('newDesign', '1');
      query.delete('estimateId');
      query.delete('fromEstimateId');
      if (internalName) query.set('estimateName', internalName);
      else query.delete('estimateName');
      if (createKind === 'add_on') {
        query.set('estimateKind', 'add_on');
        query.set('commercialScopeId', crypto.randomUUID());
      } else {
        query.delete('estimateKind');
        query.delete('commercialScopeId');
      }
    });
  }, [createKind, pushParams]);

  const duplicateFromList = useCallback((estimateId: string) => {
    pushParams((query) => {
      query.set('tab', 'estimates');
      query.set('fromEstimateId', estimateId);
      query.delete('estimateId');
      query.delete('newDesign');
      const source = estimates.find((estimate) => estimate.id === estimateId);
      query.set(
        'estimateName',
        copiedCommercialInternalName(source?.internalName, `Estimate ${source?.versionLabel ?? ''}`.trim()),
      );
      if (source?.commercialScopeKind === 'add_on' && source.commercialScopeId) {
        query.set('estimateKind', 'add_on');
        query.set('commercialScopeId', source.commercialScopeId);
      } else {
        query.delete('estimateKind');
        query.delete('commercialScopeId');
      }
    });
  }, [estimates, pushParams]);

  const backToEstimates = useCallback(() => {
    replaceParams((query) => {
      query.set('tab', 'estimates');
      query.delete('estimateId');
      query.delete('fromEstimateId');
      query.delete('newDesign');
      query.delete('estimateName');
      query.delete('estimateKind');
      query.delete('commercialScopeId');
    });
  }, [replaceParams]);

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
      query.delete('estimateName');
      query.delete('estimateKind');
      query.delete('commercialScopeId');
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
      ? `Revision from ${revisionSource.internalName || revisionSource.versionLabel}`
      : newDesign
        ? newEstimateInternalName || 'Blank design'
        : selectedEstimate
          ? `${selectedEstimate.commercialScopeKind === 'add_on' ? 'Add-on · ' : ''}${selectedEstimate.isActiveDraft ? 'Current draft' : 'Revision source'} · ${selectedEstimate.versionLabel}`
          : 'Project design',
    options: [
      ...activeDrafts.map((estimate) => ({
        value: `draft:${estimate.id}`,
        label: `${estimate.commercialScopeKind === 'add_on' ? 'Add-on · ' : ''}Current draft · ${estimate.versionLabel}`,
      })),
      { value: 'new', label: 'Start a blank design' },
      ...estimates
        .filter((estimate) => !estimate.isActiveDraft)
        .map((estimate) => ({
          value: `history:${estimate.id}`,
          label: `${estimate.commercialScopeKind === 'add_on' ? 'Add-on · ' : ''}Revision source · ${estimate.versionLabel}`,
        })),
      ...(revisionSource ? [{
        value: `revision:${revisionSource.id}`,
        label: `${revisionSource.commercialScopeKind === 'add_on' ? 'Add-on · ' : ''}Revision from ${revisionSource.versionLabel}`,
      }] : []),
    ],
    onChange: handleSelection,
  }), [activeDrafts, estimates, handleSelection, newDesign, newEstimateInternalName, revisionSource, selectedEstimate, selectionValue]);

  const onEstimateSaved = useCallback((estimateId: string) => openDraft(estimateId), [openDraft]);
  const onOpenProject = useCallback(() => {
    replaceParams((query) => {
      query.set('tab', 'activity');
      query.delete('estimateId');
      query.delete('fromEstimateId');
      query.delete('newDesign');
      query.delete('estimateName');
    });
  }, [replaceParams]);
  const workspace = useMemo<CalculatorProjectWorkspace>(() => ({
    kind: 'project',
    host,
    projectId,
    editEstimateId: selectedEstimate?.isActiveDraft ? selectedEstimate.id : undefined,
    fromEstimateId: revisionSource?.id,
    createNewEstimate: newDesign || Boolean(revisionSource),
    newEstimateInternalName,
    newEstimateCommercialScopeId: revisionSource?.commercialScopeId ?? requestedCommercialScopeId,
    newEstimateCommercialScopeKind: revisionSource?.commercialScopeKind ?? requestedEstimateKind,
    designNavigation,
    onEstimateSaved,
    onOpenProject,
  }), [designNavigation, host, newDesign, newEstimateInternalName, onEstimateSaved, onOpenProject, projectId, requestedCommercialScopeId, requestedEstimateKind, revisionSource, selectedEstimate]);

  const renameEstimate = useCallback(async (internalName: string | null) => {
    if (!renameTarget || renamePending) return;
    setRenamePending(true);
    try {
      const response = await apiJson<{ estimate: EstimateDetail }>(
        `/api/estimates/${encodeURIComponent(renameTarget.id)}`,
        { method: 'PATCH', body: JSON.stringify({ internalName }) },
      );
      queryClient.setQueryData<EstimateMeta[]>(qk.estimates.metaByProject(host, projectId), (current) =>
        (current ?? []).map((estimate) => estimate.id === renameTarget.id
          ? { ...estimate, internalName: response.estimate.internalName }
          : estimate),
      );
      queryClient.setQueryData(qk.estimates.detail(host, renameTarget.id), response.estimate);
      setRenameTarget(null);
      toast.success(internalName ? 'Estimate name updated.' : 'Estimate name cleared.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update estimate name');
    } finally {
      setRenamePending(false);
    }
  }, [host, projectId, queryClient, renamePending, renameTarget, toast]);

  const hasCalculatorIntent = Boolean(editEstimateId || fromEstimateId || newDesign);
  if (!hasCalculatorIntent) {
    return (
      <>
      <EstimatesListView
        estimates={estimates}
        loading={estimatesQuery.isPending}
        error={estimatesQuery.isError
          ? estimatesQuery.error instanceof Error
            ? estimatesQuery.error.message
            : 'Could not load estimates.'
          : null}
        onRetry={() => void estimatesQuery.refetch()}
        onCreate={createFromList}
        onCreateAddOn={createAddOnFromList}
        onOpen={openFromList}
        onDuplicate={duplicateFromList}
        onRename={setRenameTarget}
      />
      <CommercialInternalNameDialog
        open={createNameOpen}
        title={createKind === 'add_on' ? 'Create add-on estimate' : 'Create estimate'}
        description={createKind === 'add_on'
          ? 'Create a separate add-on scope without changing the original accepted quote.'
          : 'Give this estimate an optional staff-only name before opening the calculator.'}
        submitLabel="Open calculator"
        onClose={() => setCreateNameOpen(false)}
        onSubmit={createNamedEstimate}
      />
      <CommercialInternalNameDialog
        open={Boolean(renameTarget)}
        title="Rename estimate"
        description="The version and pricing history stay unchanged."
        initialValue={renameTarget?.internalName}
        submitLabel="Save name"
        pending={renamePending}
        onClose={() => { if (!renamePending) setRenameTarget(null); }}
        onSubmit={renameEstimate}
      />
      </>
    );
  }

  const workspaceLabel = newDesign
    ? newEstimateInternalName || (requestedEstimateKind === 'add_on' ? 'New add-on estimate' : 'New estimate')
    : revisionSource
      ? newEstimateInternalName || `New revision from ${revisionSource.versionLabel}`
      : selectedEstimate?.internalName || selectedEstimate?.versionLabel || 'Estimate workspace';
  const listReturn = (
    <div className={styles.workspaceBar} data-calculator-workspace-bar="true">
      <Button type="button" variant="quiet" size="small" onClick={backToEstimates}>Back to estimates</Button>
      <div className={styles.workspaceContext}>
        <strong>{projectName}</strong>
        <span>{workspaceLabel}</span>
      </div>
    </div>
  );

  if (estimatesQuery.isPending) {
    return (
      <div className={styles.container} data-project-calculator="true" data-project-calculator-state="pending">
        {listReturn}
        <UnavailableDesignNavigation label="Loading project designs" />
        <LoadingSkeleton rows={4} columns={4} label="Loading project designs" />
      </div>
    );
  }

  if (estimatesQuery.isError) {
    return (
      <div className={styles.container} data-project-calculator="true" data-project-calculator-state="error">
        {listReturn}
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
    >
      {listReturn}
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
      ) : (
        <LoadingSkeleton rows={4} columns={4} label="Opening Calculator" />
      )}
    </div>
  );
}
