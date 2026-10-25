'use client';
import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation/FoundationSurfaces';
import styles from './JobPacksTab.module.css';
export type JobPacksListEvidence = { status: ReactNode; rows: ReactNode };
export default function JobPacksListSurface({ evidence, unavailable = false }: { evidence: JobPacksListEvidence | null; unavailable?: boolean }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Job Packs</h3>
          <p className={styles.subtitle}>Materials and installation details · saved estimate versions.</p>
        </div>
      </div>

      {evidence?.status}
      <Table aria-label="Job packs" className={styles.packTable}>
            <TableHeader>
              <TableRow>
                <TableHead>Design</TableHead>
                <TableHead>Quote</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Quote status</TableHead><TableHead>Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidence ? evidence.rows : <TableRow><TableCell colSpan={5}><span role="status">{unavailable ? 'Job packs unavailable.' : 'Reading job packs…'}</span></TableCell></TableRow>}
            </TableBody>
        </Table>
    </div>
  );
}
