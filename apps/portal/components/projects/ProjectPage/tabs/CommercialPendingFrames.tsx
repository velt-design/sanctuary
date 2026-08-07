import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TabNavigation,
} from '@/components/ui/foundation';
import type { ReactNode } from 'react';
import ProjectPendingValue, {
  ProjectPendingStatus,
} from '../ProjectPendingValue';
import commercialStyles from './CommercialTab.module.css';
import invoiceStyles from './InvoicesTab.module.css';
import quoteStyles from './QuotesTab.module.css';
import QuoteDetailPendingView, { QuotePreviewPendingView } from './QuoteDetailPendingView';

const QUOTE_COLUMNS = [
  'Quote',
  'From design',
  'Issue date',
  'Expiry',
  'Status',
  'Amount (inc GST)',
  'PDF',
];

const INVOICE_COLUMNS = [
  'Invoice',
  'Quote',
  'Amount',
  'Due',
  'Delivery',
  'Actions',
];

function QuoteListTableFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={quoteStyles.tableWrap}>
      <table className={quoteStyles.listTable} aria-label="Quote versions">
        <thead>
          <tr>
            {QUOTE_COLUMNS.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function QuoteListPendingRows({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} data-portal-table-row="loading">
          {QUOTE_COLUMNS.map((column, columnIndex) => (
            <td key={column}>
              <ProjectPendingValue
                label={`Loading ${column.toLowerCase()}`}
                width={columnIndex === 0 || columnIndex === 1 ? 'medium' : 'short'}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function QuotesPendingView() {
  return (
    <div
      className={quoteStyles.wrapper}
      role="region"
      aria-label="Quotes"
      data-quotes-view="list"
      data-portal-page-shell="quote-list"
      data-portal-page-shell-ready="true"
      aria-busy="true"
    >
      <ProjectPendingStatus>
        Quote list structure is ready. Quote values are loading.
      </ProjectPendingStatus>
      <div className={quoteStyles.header}>
        <div>
          <h3 className={quoteStyles.title}>Quotes</h3>
          <p className={quoteStyles.subtitle}>Versioned quotes for this project.</p>
        </div>
        <button type="button" className={quoteStyles.primaryButton} disabled>
          Create quote
        </button>
      </div>
      <QuoteListTableFrame>
        <QuoteListPendingRows />
      </QuoteListTableFrame>
    </div>
  );
}

export function InvoicesPendingView() {
  return (
    <div
      className={invoiceStyles.wrapper}
      data-project-invoices="true"
      data-portal-page-shell="invoice-list"
      data-portal-page-shell-ready="true"
      aria-busy="true"
    >
      <ProjectPendingStatus>
        Invoice list structure is ready. Invoice values are loading.
      </ProjectPendingStatus>
      <div className={invoiceStyles.header}>
        <h3 className={invoiceStyles.title}>Invoices</h3>
        <p className={invoiceStyles.subtitle}>
          Invoices are created from accepted quotes. Delivery and payment values load from the server.
        </p>
      </div>
      <Table aria-label="Invoices">
        <TableHeader>
          <TableRow>
            {INVOICE_COLUMNS.map((column) => <TableHead key={column}>{column}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }, (_, rowIndex) => (
            <TableRow key={rowIndex} data-portal-table-row="loading">
              {INVOICE_COLUMNS.map((column, columnIndex) => (
                <TableCell key={column}>
                  {column === 'Actions' ? (
                    <Button type="button" size="small" variant="secondary" disabled>
                      Preview
                    </Button>
                  ) : (
                    <ProjectPendingValue
                      label={`Loading ${column.toLowerCase()}`}
                      width={columnIndex < 2 ? 'medium' : 'short'}
                    />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ProjectCommercialPendingFrame({
  view = 'quotes',
  onViewSelect,
  quoteDetail = false,
  quotePreview = false,
  onQuoteDetailBack,
  onQuotePreviewSelect,
}: {
  view?: 'quotes' | 'invoices';
  onViewSelect?: (view: 'quotes' | 'invoices') => void;
  quoteDetail?: boolean;
  quotePreview?: boolean;
  onQuoteDetailBack?: () => void;
  onQuotePreviewSelect?: (preview: boolean) => void;
}) {
  return (
    <div
      className={commercialStyles.container}
      data-project-commercial-view={view}
      data-portal-page-shell="project-commercial"
      data-portal-page-shell-ready="true"
    >
      <div className={commercialStyles.toolbar} data-portal-route-region="commercial-navigation">
        <TabNavigation
          items={[
            { key: 'quotes', label: 'Quotes' },
            { key: 'invoices', label: 'Invoices' },
          ]}
          selectedKey={view}
          onSelect={(nextView) => onViewSelect?.(nextView)}
          disabled={!onViewSelect}
          ariaLabel="Commercial sections"
        />
        {view === 'quotes' ? (
          <div className={commercialStyles.quoteViews} role="group" aria-label="Quote view">
            <Button
              type="button"
              variant={quotePreview ? 'quiet' : 'secondary'}
              size="small"
              aria-pressed={!quotePreview}
              disabled={!quoteDetail || !onQuotePreviewSelect}
              onClick={() => onQuotePreviewSelect?.(false)}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant={quotePreview ? 'secondary' : 'quiet'}
              size="small"
              aria-pressed={quotePreview}
              disabled={!quoteDetail || !onQuotePreviewSelect}
              onClick={() => onQuotePreviewSelect?.(true)}
            >
              Preview
            </Button>
          </div>
        ) : null}
      </div>
      {view === 'invoices'
        ? <InvoicesPendingView />
        : quoteDetail
          ? quotePreview
            ? <QuotePreviewPendingView onBack={onQuoteDetailBack} />
            : <QuoteDetailPendingView onBack={onQuoteDetailBack} />
          : <QuotesPendingView />}
    </div>
  );
}
