'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MaterialsExplainV1 } from '@sp/costing';
import { apiJson } from '@/lib/repo/apiClient';
import type { EstimateDetail } from '@/lib/estimates/types';
import {
  buildCostingAuditInstallRows,
  buildCostingAuditMaterialsRows,
  buildCostingAuditSummaryRows,
  buildModuleCostInputsFromSnapshot,
  getModuleCostOutputFromSnapshot,
} from '@/lib/costingAudit/viewModel';
import styles from '../EstimatesTab.module.css';

type CostingAuditTabKey = 'summary' | 'materials' | 'install';

type ModuleOption = {
  index: number;
  label: string;
};

type MaterialsExplainResponse = {
  output: unknown;
  materials_explain: MaterialsExplainV1;
};

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  const rounded = Math.round(value * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export default function CostingAuditPanel({
  detail,
  moduleOptions,
  defaultModuleIndex,
  drawingDirty,
}: {
  detail: EstimateDetail;
  moduleOptions: ModuleOption[];
  defaultModuleIndex: number;
  drawingDirty: boolean;
}) {
  const [activeTab, setActiveTab] = useState<CostingAuditTabKey>('summary');
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(defaultModuleIndex);

  useEffect(() => {
    const allowedIndexes = new Set(moduleOptions.map((option) => option.index));
    const fallbackIndex = moduleOptions[0]?.index ?? 0;
    setSelectedModuleIndex(allowedIndexes.has(defaultModuleIndex) ? defaultModuleIndex : fallbackIndex);
  }, [defaultModuleIndex, detail.id, moduleOptions]);

  const summaryRows = useMemo(() => buildCostingAuditSummaryRows(detail), [detail]);
  const installRows = useMemo(() => buildCostingAuditInstallRows(detail), [detail]);
  const moduleOutput = useMemo(
    () => getModuleCostOutputFromSnapshot(detail.calculatorSnapshot, selectedModuleIndex),
    [detail.calculatorSnapshot, selectedModuleIndex],
  );
  const moduleCostInputs = useMemo(
    () => buildModuleCostInputsFromSnapshot(detail.calculatorSnapshot, selectedModuleIndex),
    [detail.calculatorSnapshot, selectedModuleIndex],
  );

  const materialsExplainQuery = useQuery({
    queryKey: ['costingAudit', 'materialsExplain', detail.id, selectedModuleIndex],
    enabled: activeTab === 'materials' && Boolean(moduleCostInputs),
    staleTime: 1000 * 60,
    queryFn: async () =>
      apiJson<MaterialsExplainResponse>('/api/staff/costing/v1/materials-explain?detail=summary', {
        method: 'POST',
        body: JSON.stringify(moduleCostInputs),
        skipSaveTracking: true,
      }),
  });

  const materialsRows = useMemo(
    () => buildCostingAuditMaterialsRows(moduleOutput, materialsExplainQuery.data?.materials_explain ?? null),
    [materialsExplainQuery.data?.materials_explain, moduleOutput],
  );

  return (
    <div className={styles.auditPanel}>
      <div className={styles.auditToolbar}>
        <div className={styles.auditTabs} role="tablist" aria-label="Costing Audit tabs">
          {([
            ['summary', 'Summary'],
            ['materials', 'Materials'],
            ['install', 'Install'],
          ] as Array<[CostingAuditTabKey, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              className={`${styles.auditTabButton} ${activeTab === key ? styles.auditTabButtonActive : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'materials' && moduleOptions.length > 1 ? (
          <label className={styles.auditModulePicker}>
            <span>Module</span>
            <select value={selectedModuleIndex} onChange={(event) => setSelectedModuleIndex(Number.parseInt(event.target.value, 10) || 0)}>
              {moduleOptions.map((option) => (
                <option key={option.index} value={option.index}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {drawingDirty ? (
        <div className={styles.infoNotice}>Costing Audit reflects the saved design snapshot. Unsaved drawing changes are not included.</div>
      ) : null}

      {activeTab === 'summary' ? (
        <div className={styles.auditTableWrap}>
          <table className={styles.auditTable}>
            <thead>
              <tr>
                <th>Section</th>
                <th>Metric</th>
                <th>Value</th>
                <th>Source</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.section}</td>
                  <td>{row.metric}</td>
                  <td className={styles.auditNumericCell}>{row.value}</td>
                  <td>{row.source}</td>
                  <td>{row.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === 'materials' ? (
        <div className={styles.auditTableStack}>
          <div className={styles.auditMeta}>
            <span>Final material rows come from the saved estimate snapshot.</span>
            <span>Reasoning is generated from the current costing engine for the selected module.</span>
          </div>
          {materialsExplainQuery.isPending ? <p className={styles.auditInlineMessage}>Loading material reasoning...</p> : null}
          {materialsExplainQuery.error ? (
            <div className={styles.auditInlineWarning}>Material reasoning is unavailable right now. Final material rows are still shown below.</div>
          ) : null}
          {!moduleOutput ? <div className={styles.drawingEmpty}>No module material output is available for this design.</div> : null}
          {moduleOutput ? (
            <div className={styles.auditTableWrap}>
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Item ID</th>
                    <th>Label</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Unit Cost</th>
                    <th>Line Cost</th>
                    <th>Why</th>
                    <th>Depends On</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {materialsRows.length ? (
                    materialsRows.map((row) => (
                      <tr key={`${row.itemId}-${row.line}`}>
                        <td>{row.line}</td>
                        <td className={styles.auditMonoCell}>{row.itemId}</td>
                        <td>{row.label}</td>
                        <td className={styles.auditNumericCell}>{formatNumber(row.qty)}</td>
                        <td>{row.unit ?? '-'}</td>
                        <td className={styles.auditNumericCell}>{formatMoney(row.unitCost)}</td>
                        <td className={styles.auditNumericCell}>{formatMoney(row.lineCost)}</td>
                        <td>{row.why ?? 'Reasoning unavailable.'}</td>
                        <td>{row.dependsOn.length ? row.dependsOn.join(' | ') : '-'}</td>
                        <td>{row.source ?? '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10}>No material rows are available for this module.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'install' ? (
        <div className={styles.auditTableStack}>
          <div className={styles.auditMeta}>
            <span>Install rows come from the saved estimate snapshot.</span>
            <span>The Why column is a V1 inferred explanation based on saved action data.</span>
          </div>
          <div className={styles.auditTableWrap}>
            <table className={styles.auditTable}>
              <thead>
                <tr>
                  <th>Action ID</th>
                  <th>Category</th>
                  <th>Label</th>
                  <th>Scope</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Minutes</th>
                  <th>Cost</th>
                  <th>Why</th>
                  <th>Depends On</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {installRows.length ? (
                  installRows.map((row) => (
                    <tr key={row.actionId}>
                      <td className={styles.auditMonoCell}>{row.actionId}</td>
                      <td>{row.category ?? '-'}</td>
                      <td>{row.label}</td>
                      <td>{row.scope ?? '-'}</td>
                      <td className={styles.auditNumericCell}>{formatNumber(row.qty)}</td>
                      <td>{row.unit ?? '-'}</td>
                      <td className={styles.auditNumericCell}>{formatNumber(row.minutes)}</td>
                      <td className={styles.auditNumericCell}>{formatMoney(row.cost)}</td>
                      <td>{row.why ?? '-'}</td>
                      <td>{row.dependsOn.length ? row.dependsOn.join(' | ') : '-'}</td>
                      <td>{row.source ?? '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11}>No install actions are available for this snapshot.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
