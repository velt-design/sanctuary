'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Checkbox, IconButton } from './FoundationControls';
import { OverflowMenu, type OverflowMenuItem } from './OverflowMenu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './FoundationSurfaces';
import styles from './SelectionTable.module.css';

export type SelectionTableRow = {
  id: string;
  label: string;
  cells: ReactNode[];
  expandedContent?: ReactNode;
  actions?: OverflowMenuItem[];
};

export function SelectionTable({ columns, rows, onBulkArchive }: {
  columns: string[];
  rows: SelectionTableRow[];
  onBulkArchive?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState(() => new Set<string>());
  const [expanded, setExpanded] = useState<string | null>(null);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <div className={styles.root}>
      {selected.size ? (
        <div className={styles.bulk} role="status">
          <strong>{selected.size} selected</strong>
          <Button size="small" variant="secondary" onClick={() => onBulkArchive?.(selectedIds)}>Archive selected</Button>
          <Button size="small" variant="quiet" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : null}
      <Table>
        <TableHeader><TableRow>
          <TableHead><Checkbox aria-label="Select all rows" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))} /></TableHead>
          <TableHead><span className="visually-hidden">Expand</span></TableHead>
          {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
          <TableHead><span className="visually-hidden">Actions</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isExpanded = expanded === row.id;
            const isSelected = selected.has(row.id);
            return <Fragment key={row.id}>
              <TableRow data-selected={isSelected || undefined}>
                <TableCell><Checkbox aria-label={`Select ${row.label}`} checked={isSelected} onChange={() => toggle(row.id)} /></TableCell>
                <TableCell>{row.expandedContent ? <IconButton size="small" variant="quiet" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${row.label}`} aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : row.id)}>{isExpanded ? <ChevronDown /> : <ChevronRight />}</IconButton> : null}</TableCell>
                {row.cells.map((cell, index) => <TableCell key={index} data-column={columns[index]}>{cell}</TableCell>)}
                <TableCell>{row.actions?.length ? <OverflowMenu menuLabel={`Actions for ${row.label}`} items={row.actions} /> : null}</TableCell>
              </TableRow>
              {isExpanded ? <TableRow><TableCell colSpan={columns.length + 3}><div className={styles.expanded}>{row.expandedContent}</div></TableCell></TableRow> : null}
            </Fragment>;
          })}
        </TableBody>
      </Table>
    </div>
  );
}
