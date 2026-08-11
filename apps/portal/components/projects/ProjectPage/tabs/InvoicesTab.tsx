'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import styles from './InvoicesTab.module.css';
import {
  Badge,
  Button,
  Card,
  DataStatePanel,
  LoadingSkeleton,
  MetricGrid,
  OverflowMenu,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeTone,
} from '@/components/ui/foundation';
import { formatPortalDate, formatPortalDateTime } from '@/lib/format/portalDateTime';
import type {
  AdminInvoiceCreateInput,
  DepositInvoiceDeliveryStatus,
  DepositInvoiceSummary,
  InvoiceScheduleTerm,
  ProjectPaymentEntrySummary,
  QuoteInvoiceCreateResult,
} from '@/lib/invoices/types';
import { depositInvoicesByProjectQueryOptions } from '@/lib/queries/invoices';
import { qk } from '@/lib/queries/keys';
import {
  createProjectInvoice,
  loadProjectInvoiceSchedule,
  markProjectInvoicePaid,
  recordProjectPayment,
  reverseProjectPayment,
  sendProjectDepositInvoice,
  updatePaymentAllocations,
  voidProjectInvoice,
} from '@/lib/repo/invoicesRepo';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import CommercialFinalFailureGuidance from '@/components/commercial/CommercialFinalFailureGuidance';
import InvoiceActionDialogs, { type InvoicePaymentEvidence } from './InvoiceActionDialogs';
import CreateInvoiceDialog from './CreateInvoiceDialog';
import PaymentReconciliationDialogs from './PaymentReconciliationDialogs';

const InvoiceArtifactPreviewDialog = dynamic(() => import('./InvoiceArtifactPreviewDialog'));

function formatMoneyFromCents(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `$${(value / 100).toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
  return formatPortalDate(value, { fallback: '-' });
}

function formatDateTime(value: string | null | undefined): string {
  return formatPortalDateTime(value, { fallback: '-' });
}

function invoiceStatusTone(status: DepositInvoiceSummary['status']): BadgeTone {
  if (status === 'VOID') return 'neutral';
  return status === 'PAID' ? 'success' : 'warning';
}

function deliveryLabel(status: DepositInvoiceDeliveryStatus): string {
  switch (status) {
    case 'SENT':
      return 'Provider confirmed';
    case 'FAILED':
      return 'Failed';
    default:
      return 'Not sent';
  }
}

function deliveryTone(status: DepositInvoiceDeliveryStatus): BadgeTone {
  switch (status) {
    case 'SENT':
      return 'success';
    case 'FAILED':
      return 'error';
    default:
      return 'warning';
  }
}

export default function InvoicesTab({ projectId }: { projectId: string }) {
  const { isAdmin } = usePortalSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<DepositInvoiceSummary | null>(null);
  const [createTarget, setCreateTarget] = useState<InvoiceScheduleTerm | null | undefined>(undefined);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [createResult, setCreateResult] = useState<QuoteInvoiceCreateResult | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [voidingInvoiceId, setVoidingInvoiceId] = useState<string | null>(null);
  const [paidTarget, setPaidTarget] = useState<DepositInvoiceSummary | null>(null);
  const [voidTarget, setVoidTarget] = useState<DepositInvoiceSummary | null>(null);
  const [paymentEntryMode, setPaymentEntryMode] = useState<'PAYMENT' | 'ADJUSTMENT' | null>(null);
  const [allocationTarget, setAllocationTarget] = useState<ProjectPaymentEntrySummary | null>(null);
  const [reversalTarget, setReversalTarget] = useState<ProjectPaymentEntrySummary | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);

  const invoicesQuery = useQuery(depositInvoicesByProjectQueryOptions(hostKey, projectId));
  const invoices = invoicesQuery.data ?? [];
  const scheduleQuery = useQuery({
    queryKey: qk.invoices.scheduleByProject(hostKey, projectId),
    queryFn: () => loadProjectInvoiceSchedule(projectId),
    enabled: true,
  });
  const schedule = scheduleQuery.data ?? null;
  const currentAcceptedQuoteVersionIds = useMemo(() => new Set(
    schedule?.acceptedQuotes?.map((quote) => quote.quoteVersionId)
      ?? (schedule?.acceptedQuoteVersionId ? [schedule.acceptedQuoteVersionId] : []),
  ), [schedule]);

  const refreshInvoiceData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.invoices.byProject(hostKey, projectId) }),
      queryClient.invalidateQueries({ queryKey: qk.invoices.scheduleByProject(hostKey, projectId) }),
    ]);
  };

  const handleSendNow = async (invoiceId: string) => {
    setSendingInvoiceId(invoiceId);
    try {
      const invoice = await sendProjectDepositInvoice(invoiceId);
      await queryClient.invalidateQueries({
        queryKey: qk.invoices.byProject(hostKey, projectId),
      });
      toast.success(`Invoice ${invoice.invoiceRef} delivery confirmed by the email provider.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send invoice';
      toast.error(message);
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleCreateInvoice = async (input: AdminInvoiceCreateInput) => {
    setCreatingInvoice(true);
    try {
      const result = await createProjectInvoice({ ...input, projectId });
      await refreshInvoiceData();
      setCreateResult(result);
      toast.success(`Invoice ${result.invoice.invoiceRef} created${result.sent ? ' and sent' : ''}.`);
      if (result.sendError) toast.error(result.sendError);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create invoice');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const closePaymentDialogs = () => {
    setPaymentEntryMode(null);
    setAllocationTarget(null);
    setReversalTarget(null);
  };

  const handleRecordPayment = async (input: Omit<Parameters<typeof recordProjectPayment>[0], 'projectId'>) => {
    setPaymentPending(true);
    try {
      await recordProjectPayment({ ...input, projectId });
      await refreshInvoiceData();
      closePaymentDialogs();
      toast.success(input.entryType === 'PAYMENT' ? 'Payment recorded.' : 'Payment adjustment recorded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setPaymentPending(false);
    }
  };

  const handleAllocatePayment = async (input: { allocations: Array<{ quoteVersionId: string; paymentTermId: string; amountIncGstCents: number }>; reason: string }) => {
    if (!allocationTarget) return;
    setPaymentPending(true);
    try {
      await updatePaymentAllocations({ paymentEntryId: allocationTarget.id, ...input });
      await refreshInvoiceData();
      closePaymentDialogs();
      toast.success('Payment allocation updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update allocation');
    } finally {
      setPaymentPending(false);
    }
  };

  const handleReversePayment = async (reason: string) => {
    if (!reversalTarget) return;
    setPaymentPending(true);
    try {
      await reverseProjectPayment(reversalTarget.id, reason);
      await refreshInvoiceData();
      closePaymentDialogs();
      toast.success('Payment entry reversed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reverse payment');
    } finally {
      setPaymentPending(false);
    }
  };

  const handleMarkPaid = async (invoice: DepositInvoiceSummary, evidence: InvoicePaymentEvidence) => {
    setMarkingPaidId(invoice.id);
    try {
      await markProjectInvoicePaid(invoice.id, evidence);
      await refreshInvoiceData();
      setPaidTarget(null);
      toast.success(`Invoice ${invoice.invoiceRef} marked paid.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark invoice paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleVoid = async (invoice: DepositInvoiceSummary, reason: string) => {
    setVoidingInvoiceId(invoice.id);
    try {
      await voidProjectInvoice(invoice.id, reason);
      await refreshInvoiceData();
      setVoidTarget(null);
      toast.success(`Invoice ${invoice.invoiceRef} voided.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to void invoice');
    } finally {
      setVoidingInvoiceId(null);
    }
  };

  if (invoicesQuery.isPending) {
    return <LoadingSkeleton rows={3} columns={6} label="Loading invoices" />;
  }

  if (invoicesQuery.isError) {
    return (
      <DataStatePanel
        state="error"
        title="Could not load invoices"
        description={invoicesQuery.error instanceof Error ? invoicesQuery.error.message : 'Failed to load invoices.'}
        onRetry={() => void invoicesQuery.refetch()}
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.title}>Invoices</h3>
        <p className={styles.subtitle}>
          Invoices are created from the accepted quote payment schedule. Each invoice is either open, paid in full, or void.
        </p>
      </div>

      {scheduleQuery.isError ? (
        <DataStatePanel state="error" title="Could not load the job payment schedule" description={scheduleQuery.error instanceof Error ? scheduleQuery.error.message : 'Failed to load payment totals.'} onRetry={() => void scheduleQuery.refetch()} />
      ) : null}

      {schedule?.acceptedQuoteVersionId ? (
        <Card
          title="Job payment schedule"
          eyebrow={(schedule.acceptedQuotes?.length ?? 0) > 1
            ? `${schedule.acceptedQuotes?.length} accepted quote scopes`
            : `Quote ${schedule.acceptedQuoteRef} v${schedule.acceptedQuoteVersionNumber}`}
          padding="none"
          headingLevel={4}
          aria-label="Invoice schedule"
        >
          <MetricGrid
            ariaLabel="Accepted project quote payment totals"
            columns={4}
            items={[
              { label: 'Job total', value: formatMoneyFromCents(schedule.acceptedQuoteTotalIncGstCents), detail: (schedule.acceptedQuotes?.length ?? 0) > 1 ? 'Base contract and accepted add-ons' : 'Accepted quote' },
              { label: 'Paid', value: formatMoneyFromCents(schedule.paidIncGstCents), detail: schedule.unallocatedCreditIncGstCents > 0 ? `${formatMoneyFromCents(schedule.unallocatedCreditIncGstCents)} unallocated credit` : 'Actual job payments' },
              { label: 'Open', value: formatMoneyFromCents(schedule.outstandingIncGstCents), detail: 'Issued and unpaid' },
              { label: 'Remaining', value: formatMoneyFromCents(schedule.remainingToInvoiceIncGstCents), detail: 'Available to invoice' },
            ]}
          />
          <div className={styles.scheduleRows}>
            {schedule.terms.map((term) => {
              return (
                <div className={styles.scheduleRow} key={`${term.quoteVersionId}:${term.paymentTermId}`}>
                  <div className={styles.meta}>
                    <div className={styles.statusRow}>
                      <strong>{term.position}. {term.label}</strong>
                      {term.commercialScopeKind === 'add_on' ? <Badge tone="info">Add-on</Badge> : null}
                    </div>
                    <span className={styles.muted}>
                      {term.quoteRef} v{term.quoteVersionNumber} · {formatMoneyFromCents(term.amountIncGstCents)}
                      {term.allocatedPaidIncGstCents > 0 ? ` · ${formatMoneyFromCents(term.allocatedPaidIncGstCents)} paid` : ''}
                    </span>
                  </div>
                  {term.invoice ? (
                    <Badge tone={invoiceStatusTone(term.invoice.status)}>{term.invoice.invoiceRef} - {term.invoice.status}</Badge>
                  ) : isAdmin && term.remainingAmountIncGstCents > 0 ? (
                    <Button type="button" size="small" onClick={() => { setCreateResult(null); setCreateTarget(term); }}>
                      Create invoice
                    </Button>
                  ) : <span className={styles.muted}>{term.remainingAmountIncGstCents === 0 ? 'Covered by payments' : 'Not invoiced'}</span>}
                </div>
              );
            })}
            {isAdmin && schedule.remainingToInvoiceIncGstCents > 0 ? (
              <div className={styles.scheduleFooter}>
                <Button type="button" variant="secondary" size="small" onClick={() => { setCreateResult(null); setCreateTarget(null); }}>Create invoice</Button>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {isAdmin && schedule?.paymentEntries ? (
        <Card title="Payments & credits" eyebrow={`${schedule.paymentEntries.length} ledger ${schedule.paymentEntries.length === 1 ? 'entry' : 'entries'}`} padding="none" headingLevel={4} aria-label="Payments and credits">
          <div className={styles.paymentToolbar}>
            <p>Actual money received is recorded independently from whole invoices. Allocations apply credit to the current schedule.</p>
            <div className={styles.actions}>
              <Button type="button" size="small" onClick={() => setPaymentEntryMode('PAYMENT')}>Record payment</Button>
              <Button type="button" size="small" variant="secondary" onClick={() => setPaymentEntryMode('ADJUSTMENT')}>Add adjustment</Button>
            </div>
          </div>
          {schedule.paymentEntries.length ? (
            <div className={styles.paymentRows}>
              {schedule.paymentEntries.map((entry) => (
                <div className={styles.paymentRow} key={entry.id}>
                  <div className={styles.meta}>
                    <div className={styles.statusRow}>
                      <Badge tone={entry.entryType === 'REVERSAL' || entry.amountIncGstCents < 0 ? 'neutral' : 'success'}>{entry.entryType}</Badge>
                      {entry.reversed ? <Badge tone="neutral">Reversed</Badge> : null}
                    </div>
                    <strong>{formatMoneyFromCents(entry.amountIncGstCents)}</strong>
                    <span className={styles.muted}>{formatDate(entry.occurredAt)}{entry.paymentMethod ? ` · ${entry.paymentMethod}` : ''}{entry.reference ? ` · ${entry.reference}` : ''}{entry.sourceInvoiceRef ? ` · ${entry.sourceInvoiceRef}` : ''}</span>
                    {entry.reason || entry.note ? <span className={styles.muted}>{entry.reason ?? entry.note}</span> : null}
                  </div>
                  <div className={styles.allocationCopy}>
                    {entry.allocations.length ? entry.allocations.map((allocation) => (
                      <span key={allocation.id}>{allocation.stageLabel}: {formatMoneyFromCents(allocation.amountIncGstCents)}{allocation.isCurrentSchedule ? '' : ' (historical)'}</span>
                    )) : <span>Unallocated credit: {formatMoneyFromCents(entry.unallocatedIncGstCents)}</span>}
                  </div>
                  {entry.entryType !== 'REVERSAL' && !entry.reversed ? (
                    <OverflowMenu label={`Manage payment from ${formatDate(entry.occurredAt)}`} menuLabel="Payment actions" items={[
                      ...(entry.amountIncGstCents > 0 ? [{ label: 'Manage allocation', onSelect: () => setAllocationTarget(entry) }] : []),
                      { label: 'Reverse entry', destructive: true, separatorBefore: true, onSelect: () => setReversalTarget(entry) },
                    ]} />
                  ) : null}
                </div>
              ))}
            </div>
          ) : <p className={styles.emptyCardCopy}>No payments have been recorded for this job yet.</p>}
        </Card>
      ) : null}

      {!invoices.length ? (
        <DataStatePanel state="empty" title="No invoices yet" description="The first invoice is created when a quote is accepted. Admins can create later scheduled, custom, remaining-balance, or split invoices here." />
      ) : (
      <Card title="Invoice history" eyebrow={`${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}`} padding="none" headingLevel={4}>
      <Table aria-label="Invoices">
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Quote</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const canSend = invoice.status === 'OPEN' && invoice.lastDeliveryStatus !== 'SENT' && !invoice.finalFailure;
            const isSending = sendingInvoiceId === invoice.id;
            const isHistorical = currentAcceptedQuoteVersionIds.size > 0
              && !currentAcceptedQuoteVersionIds.has(invoice.quoteVersionId);
            const showMarkPaidPrimary = isAdmin && invoice.status === 'OPEN' && !canSend;
            return (
              <TableRow key={invoice.id}>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>{invoice.invoiceRef}</strong>
                    <div className={styles.statusRow}>
                      <Badge tone={invoiceStatusTone(invoice.status)}>{invoice.status}</Badge>
                      <Badge tone={deliveryTone(invoice.lastDeliveryStatus)}>{deliveryLabel(invoice.lastDeliveryStatus)}</Badge>
                      {isHistorical ? <Badge tone="neutral">Historical</Badge> : null}
                    </div>
                    <span className={styles.muted}>Created {formatDate(invoice.createdAt)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>
                      {invoice.quoteRef} v{invoice.quoteVersionNumber}
                    </strong>
                    <span className={styles.muted}>{invoice.reference || invoice.projectName || '-'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>{formatMoneyFromCents(invoice.totalIncGstCents)}</strong>
                    <span className={styles.muted}>{invoice.paymentTermLabel} ({invoice.paymentTermPosition} of {invoice.paymentTermCount})</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>{formatDate(invoice.dueDate)}</strong>
                    <span className={styles.muted}>Issued {formatDate(invoice.issueDate)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.meta}>
                    <span>{invoice.sentAt ? `Sent ${formatDateTime(invoice.sentAt)}` : 'Not delivered yet'}</span>
                    {invoice.lastDeliveryAttemptAt ? (
                      <span className={styles.muted}>Last attempt {formatDateTime(invoice.lastDeliveryAttemptAt)}</span>
                    ) : null}
                    {invoice.lastDeliveryStatus === 'FAILED' && !invoice.finalFailure ? (
                      <span className={styles.muted}>Retry available - the prepared message will be reused safely.</span>
                    ) : null}
                    {invoice.finalFailure ? (
                      <CommercialFinalFailureGuidance
                        artifact="invoice"
                        reference={invoice.invoiceRef}
                        evidence="the last-attempt time"
                        className={styles.error}
                      />
                    ) : null}
                    {invoice.lastDeliveryError ? <span className={styles.error}>{invoice.lastDeliveryError}</span> : null}
                    {invoice.paidAt ? <span className={styles.muted}>Paid {formatDateTime(invoice.paidAt)}</span> : null}
                    {invoice.voidedAt ? <span className={styles.muted}>Voided {formatDateTime(invoice.voidedAt)}</span> : null}
                    {invoice.voidReason ? <span className={styles.muted}>{invoice.voidReason}</span> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.actions}>
                    {canSend ? (
                      <Button type="button" size="small" onClick={() => handleSendNow(invoice.id)} loading={isSending}>
                        {invoice.lastDeliveryStatus === 'FAILED' ? 'Retry delivery' : 'Send now'}
                      </Button>
                    ) : showMarkPaidPrimary ? (
                      <Button type="button" size="small" onClick={() => setPaidTarget(invoice)} disabled={markingPaidId !== null || voidingInvoiceId !== null}>
                        Mark paid
                      </Button>
                    ) : null}
                    <OverflowMenu
                      label={`Actions for ${invoice.invoiceRef}`}
                      menuLabel={invoice.invoiceRef}
                      items={[
                        { label: 'Preview invoice', onSelect: () => setPreviewInvoice(invoice) },
                        ...((isAdmin && invoice.status === 'OPEN' && !showMarkPaidPrimary)
                          ? [{ label: 'Mark paid', onSelect: () => setPaidTarget(invoice) }]
                          : []),
                        ...((isAdmin && invoice.status === 'OPEN')
                          ? [{ label: 'Void invoice', destructive: true, separatorBefore: true, onSelect: () => setVoidTarget(invoice) }]
                          : []),
                      ]}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </Card>
      )}
      {previewInvoice ? (
        <InvoiceArtifactPreviewDialog
          invoiceId={previewInvoice.id}
          invoiceRef={previewInvoice.invoiceRef}
          onClose={() => setPreviewInvoice(null)}
        />
      ) : null}
      <InvoiceActionDialogs
        paidTarget={paidTarget}
        voidTarget={voidTarget}
        pending={markingPaidId !== null || voidingInvoiceId !== null}
        onClosePaid={() => setPaidTarget(null)}
        onCloseVoid={() => setVoidTarget(null)}
        onConfirmPaid={(evidence) => { if (paidTarget) void handleMarkPaid(paidTarget, evidence); }}
        onConfirmVoid={(reason) => { if (voidTarget) void handleVoid(voidTarget, reason); }}
      />
      {schedule ? (
        <CreateInvoiceDialog
          open={createTarget !== undefined}
          projectId={projectId}
          schedule={schedule}
          initialTerm={createTarget ?? null}
          pending={creatingInvoice}
          result={createResult}
          onClose={() => { if (!creatingInvoice) { setCreateTarget(undefined); setCreateResult(null); } }}
          onCreate={(input) => void handleCreateInvoice(input)}
          onPreview={(result) => { setPreviewInvoice(result.invoice); setCreateTarget(undefined); setCreateResult(null); }}
        />
      ) : null}
      {schedule && isAdmin ? (
        <PaymentReconciliationDialogs
          entryMode={paymentEntryMode}
          allocationTarget={allocationTarget}
          reversalTarget={reversalTarget}
          schedule={schedule}
          pending={paymentPending}
          onClose={closePaymentDialogs}
          onRecord={(input) => void handleRecordPayment(input)}
          onAllocate={(input) => void handleAllocatePayment(input)}
          onReverse={(reason) => void handleReversePayment(reason)}
        />
      ) : null}
    </div>
  );
}
