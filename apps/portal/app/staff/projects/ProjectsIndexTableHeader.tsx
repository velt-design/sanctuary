import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation';

const PROJECTS_INDEX_COLUMNS = [
  'Name',
  'Client',
  'Phone',
  'Address',
  'Journey',
  'Stage',
  'State',
  'Owner',
  'Next attention',
  'Actions',
] as const;

export default function ProjectsIndexTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        {PROJECTS_INDEX_COLUMNS.map((column) => (
          <TableHead key={column}>{column}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

export function ProjectsIndexPendingTable({ label = 'Updating projects…' }: { label?: string }) {
  return (
    <Table aria-label="Projects" data-portal-shell-structure="projects-table">
      <ProjectsIndexTableHeader />
      <TableBody>
        {Array.from({ length: 5 }, (_, rowIndex) => (
          <TableRow key={rowIndex} aria-busy="true">
            {PROJECTS_INDEX_COLUMNS.map((column, columnIndex) => (
              <TableCell key={column} data-column={column}>
                <span data-portal-value-slot="loading">{rowIndex === 0 && columnIndex === 0 ? label : '—'}</span>
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
