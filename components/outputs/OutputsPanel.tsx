'use client';

import { downloadCsv } from '@/lib/export/csv';
import { downloadJson } from '@/lib/export/json';
import { downloadText } from '@/lib/export/text';
import {
  mapAcrylicToCsvRows,
  mapHardwareToCsvRows,
  mapInstallPhasesToCsvRows,
  mapPowdercoatToCsvRows,
} from '@/lib/export/mappers';
import { addProjectActivity } from '@/lib/repo/projectsRepo';
import styles from '@/app/staff/projects/projects.module.css';
import type { Estimate } from '@/lib/types/estimate';
import type { JobPack } from '@/lib/outputs/types';
import OrderListTable from './OrderListTable';
import InstallPhasesTable from './InstallPhasesTable';
import SpecTextPanel from './SpecTextPanel';

function formatMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

export default function OutputsPanel({ estimate, jobPack }: { estimate: Estimate; jobPack: JobPack }) {
  const projectId = estimate.projectId;
  const estimateId = estimate.id;
  const estimateVersion = estimate.version ?? '—';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className={styles.section} aria-label="Job pack summary">
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Job pack summary</h3>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                const rows = mapPowdercoatToCsvRows(jobPack.orderLists.powdercoat);
                downloadCsv(
                  `powdercoat_${projectId}_${estimateId}.csv`,
                  rows,
                  [
                    { key: 'profile', header: 'Profile' },
                    { key: 'colour', header: 'Colour' },
                    { key: 'stock_length_m', header: 'Stock length (m)' },
                    { key: 'unit', header: 'Unit' },
                    { key: 'qty', header: 'Qty' },
                    { key: 'notes', header: 'Notes' },
                  ],
                );
                addProjectActivity(projectId, { type: 'export', message: `Exported powdercoat CSV (estimate v${estimateVersion})`, meta: { estimateId } });
              }}
            >
              Export powdercoat CSV
            </button>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                const rows = mapAcrylicToCsvRows(jobPack.orderLists.acrylic);
                downloadCsv(
                  `acrylic_${projectId}_${estimateId}.csv`,
                  rows,
                  [
                    { key: 'item', header: 'Item' },
                    { key: 'colour', header: 'Colour' },
                    { key: 'stock_length_m', header: 'Length (m)' },
                    { key: 'unit', header: 'Unit' },
                    { key: 'qty', header: 'Qty' },
                    { key: 'notes', header: 'Notes' },
                  ],
                );
                addProjectActivity(projectId, { type: 'export', message: `Exported acrylic CSV (estimate v${estimateVersion})`, meta: { estimateId } });
              }}
            >
              Export acrylic CSV
            </button>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                const rows = mapHardwareToCsvRows(jobPack.orderLists.hardware);
                downloadCsv(
                  `hardware_${projectId}_${estimateId}.csv`,
                  rows,
                  [
                    { key: 'item', header: 'Item' },
                    { key: 'unit', header: 'Unit' },
                    { key: 'qty', header: 'Qty' },
                    { key: 'notes', header: 'Notes' },
                  ],
                );
                addProjectActivity(projectId, { type: 'export', message: `Exported hardware CSV (estimate v${estimateVersion})`, meta: { estimateId } });
              }}
            >
              Export hardware CSV
            </button>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                const rows = mapInstallPhasesToCsvRows(jobPack.installPhases.phases);
                downloadCsv(
                  `install_phases_${projectId}_${estimateId}.csv`,
                  rows,
                  [
                    { key: 'phaseId', header: 'Phase ID' },
                    { key: 'label', header: 'Phase' },
                    { key: 'minutes', header: 'Minutes' },
                    { key: 'cost_ex_gst', header: 'Cost ex-GST' },
                    { key: 'actions_count', header: 'Actions count' },
                  ],
                );
                addProjectActivity(projectId, { type: 'export', message: `Exported install phases CSV (estimate v${estimateVersion})`, meta: { estimateId } });
              }}
            >
              Export phases CSV
            </button>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                downloadText(`spec_${estimateId}.txt`, jobPack.specText);
                addProjectActivity(projectId, { type: 'export', message: `Downloaded spec.txt (estimate v${estimateVersion})`, meta: { estimateId } });
              }}
            >
              Download spec.txt
            </button>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                downloadJson(`job_pack_${estimateId}.json`, jobPack);
                addProjectActivity(projectId, { type: 'export', message: `Downloaded JobPack JSON (estimate v${estimateVersion})`, meta: { estimateId } });
              }}
            >
              Download JobPack JSON
            </button>
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th style={{ width: 220 }}>Project</th>
                  <td>{jobPack.summary.projectName ?? '—'}</td>
                </tr>
                <tr>
                  <th>Site</th>
                  <td className={styles.muted}>{jobPack.summary.siteAddress ?? '—'}</td>
                </tr>
                <tr>
                  <th>Roof</th>
                  <td className={styles.muted}>
                    {jobPack.summary.roofType} · {jobPack.summary.roofMaterialMode}
                    {typeof jobPack.summary.pitchDeg === 'number' ? ` · ${jobPack.summary.pitchDeg.toFixed(0)}°` : ''}
                  </td>
                </tr>
                <tr>
                  <th>Geometry</th>
                  <td className={styles.muted}>
                    {typeof jobPack.summary.lengthM === 'number' ? `${jobPack.summary.lengthM}m (roof length)` : '—'} ×{' '}
                    {typeof jobPack.summary.projectionM === 'number' ? `${jobPack.summary.projectionM}m (roof span)` : '—'}
                    {typeof jobPack.summary.moduleCount === 'number' ? ` · ${jobPack.summary.moduleCount} module(s)` : ''}
                  </td>
                </tr>
                <tr>
                  <th>Totals (ex‑GST)</th>
                  <td>
                    Materials {formatMoney(jobPack.summary.totals.materialsExGst)} · Install {formatMoney(jobPack.summary.totals.installExGst)} ·
                    Overhead {formatMoney(jobPack.summary.totals.overheadExGst)} · True cost {formatMoney(jobPack.summary.totals.trueCostExGst)}
                  </td>
                </tr>
                <tr>
                  <th>Estimate snapshot</th>
                  <td className={styles.muted}>
                    {estimate.id} · {estimate.createdAt}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <OrderListTable title="Powdercoat order list" kind="powdercoat" rows={jobPack.orderLists.powdercoat} />
      <OrderListTable title="Acrylic order list" kind="acrylic" rows={jobPack.orderLists.acrylic} />
      <OrderListTable title="Hardware pick list" kind="hardware" rows={jobPack.orderLists.hardware} />

      <InstallPhasesTable phases={jobPack.installPhases.phases} />

      <SpecTextPanel text={jobPack.specText} />
    </div>
  );
}
