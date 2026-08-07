import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import SpreadsheetPendingFrame from './SpreadsheetPendingFrame';
import SpreadsheetPageTemplate from './SpreadsheetPageTemplate';
import type { SpreadsheetAdapter } from './types';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('./useSpreadsheetOptimisticEditing', () => ({
  useSpreadsheetOptimisticEditing: () => null,
}));

const columns = [
  { key: 'name', letter: 'A', label: 'Client name', widthPx: 220, editable: false, frozen: true },
  { key: 'status', letter: 'B', label: 'Status', widthPx: 130, editable: false, sourceLabel: 'Schedule' },
] as const;

describe('SpreadsheetPendingFrame', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders the real grid and zoom structure for a route shell', () => {
    const rendered = renderIntoDocument(
      <SpreadsheetPendingFrame route="running-jobs" title="Running Jobs" columns={columns} />,
    );
    const root = rendered.container.querySelector('[data-portal-page-shell="running-jobs"]');
    expect(root?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    expect(root?.querySelector('table[aria-label="Running Jobs"]')).not.toBeNull();
    expect(root?.querySelector('[aria-label="Sheet zoom controls"]')).not.toBeNull();
    expect(root?.textContent).toContain('Client name');
    expect(root?.textContent).toContain('Schedule');
    rendered.unmount();
  });

  it('keeps the same route structure mounted when the live adapter is pending', () => {
    const adapter: SpreadsheetAdapter<{ id: string }, 'name', 'name', string> = {
      title: 'Running Jobs',
      toolbar: <div>Live filters</div>,
      columns: [columns[0]],
      allRows: [],
      rowNumberRows: [],
      groups: [],
      zoomStorageKey: 'test-sheet-zoom',
      defaultActiveKey: 'name',
      loading: true,
      hasError: false,
      loadingMessage: 'Loading running jobs...',
      errorMessage: 'Could not load running jobs.',
      emptyMessage: 'No matching jobs.',
      getRowId: (row) => row.id,
      isEditableKey: (key): key is 'name' => key === 'name',
      getRowClassName: () => '',
      getCellClassName: () => '',
      formatCellValue: () => '',
      renderCellContent: ({ text }) => text,
      getEditorValue: () => '',
      renderEditor: () => null,
      onCellActivated: () => 'noop',
    };
    const rendered = renderIntoDocument(
      <SpreadsheetPageTemplate adapter={adapter} routeShell="running-jobs" />,
    );
    const root = rendered.container.querySelector('[data-portal-page-shell="running-jobs"]');
    expect(root?.getAttribute('data-portal-page-shell-state')).toBe('pending');
    expect(root?.querySelector('table[aria-label="Running Jobs"]')).not.toBeNull();
    expect(root?.querySelector('[aria-label="Sheet zoom controls"]')).not.toBeNull();
    rendered.unmount();
  });
});
