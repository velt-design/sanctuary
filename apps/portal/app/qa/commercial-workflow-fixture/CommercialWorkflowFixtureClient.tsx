'use client';

import { useEffect, useMemo, useState } from 'react';
import QuoteDetailView from '@/components/projects/ProjectPage/tabs/QuoteDetailView';
import QuoteWorkflowDialogs from '@/components/projects/ProjectPage/tabs/QuoteWorkflowDialogs';
import type { QuoteRefreshMode } from '@/lib/quotes/refresh';
import type {
  PreparedQuoteDeliverySummary,
  QuoteLineItem,
  QuoteVersionDetail,
} from '@/lib/quotes/types';
import { buildLegacyQuotePaymentSchedule } from '@/lib/quotes/paymentSchedule';

export type CommercialWorkflowFixtureScenario = 'retryable' | 'needs-attention';

const lineItem: QuoteLineItem = {
  id: 'fixture-line-1',
  description: 'Custom aluminium pergola - supply and installation',
  qty: 1,
  unitPriceIncGstCents: 2_860_000,
  lineTotalIncGstCents: 2_860_000,
  sortOrder: 0,
};

function buildDetail(
  scenario: CommercialWorkflowFixtureScenario,
): QuoteVersionDetail {
  const status = scenario === 'retryable' ? 'failed' : 'needs_attention';
  return {
    id: 'fixture-quote-version',
    quoteId: 'fixture-quote',
    projectId: 'fixture-project',
    quoteRef: 'Q-FIXTURE-1042',
    versionNumber: 3,
    status: 'DRAFT',
    depositPercent: 50,
    sourceEstimateVersionId: 'fixture-estimate-version',
    sourceEstimateVersionLabel: 'Design v3',
    revisedFromQuoteVersionId: null,
    createdAt: '2026-07-28T01:00:00.000Z',
    updatedAt: '2026-07-28T01:10:00.000Z',
    commercialRevision: 7,
    isCurrentDraft: false,
    deliveryPreparedAt: '2026-07-28T01:08:00.000Z',
    createdBy: 'Fixture reviewer',
    sentAt: null,
    sentBy: null,
    expiresAt: '2030-08-28',
    reference: 'Rear outdoor room',
    customerName: 'Prepared customer snapshot',
    introText: 'Thank you for the opportunity to quote this project.',
    termsText: 'Standard Sanctuary terms apply.',
    totals: {
      totalIncGstCents: 2_860_000,
      totalExGstCents: 2_486_957,
      gstCents: 373_043,
    },
    pdfFileId: null,
    renderHash: 'fixture-render-hash',
    pricingSource: 'calculator_live',
    lineItems: [lineItem],
    sendLogs: [],
    contact: {
      name: 'Current contact record',
      email: 'customer@example.invalid',
      phone: 'Fixture phone',
    },
    project: {
      name: 'Fixture commercial project',
      siteAddress: 'Fixture address',
      region: 'Auckland',
      quoteRef: 'Q-FIXTURE-1042',
    },
    unfinishedDelivery: {
      mode: 'send',
      status,
      canRetry: scenario === 'retryable',
    },
  };
}

function buildPreparedDelivery(
  scenario: CommercialWorkflowFixtureScenario,
): PreparedQuoteDeliverySummary {
  return {
    mode: 'send',
    status: scenario === 'retryable' ? 'failed' : 'needs_attention',
    to: ['customer@example.invalid'],
    cc: ['review@example.invalid'],
    bcc: [],
    subject: 'Your Sanctuary quote Q-FIXTURE-1042',
    bodyText:
      'Hello,\n\nYour prepared quote is attached. This fixture proves that a retry reuses the exact frozen request.\n\nSanctuary Pergolas',
    attachmentNames: ['Q-FIXTURE-1042.pdf', 'fixture-drawing.pdf'],
    preparedAt: '2026-07-28T01:08:00.000Z',
    attemptCount: 1,
    lastErrorCode:
      scenario === 'retryable' ? 'provider_unavailable' : 'provider_identity_conflict',
    canRetry: scenario === 'retryable',
  };
}

export default function CommercialWorkflowFixtureClient({
  scenario,
  initialModalOpen,
}: {
  scenario: CommercialWorkflowFixtureScenario;
  initialModalOpen: boolean;
}) {
  const detail = useMemo(() => buildDetail(scenario), [scenario]);
  const preparedDelivery = useMemo(
    () => buildPreparedDelivery(scenario),
    [scenario],
  );
  const [preparedRetryOpen, setPreparedRetryOpen] = useState(false);
  const [preparedRetryBusy, setPreparedRetryBusy] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [refreshMode, setRefreshMode] =
    useState<QuoteRefreshMode>('pricing_only');
  const [sendEditorMode, setSendEditorMode] = useState<'compose' | 'review'>(
    'compose',
  );
  const [sendTo, setSendTo] = useState('customer@example.invalid');
  const [sendSubject, setSendSubject] = useState(preparedDelivery.subject);
  const [sendPersonalNote, setSendPersonalNote] = useState('');
  const [sendAttachments, setSendAttachments] = useState<File[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draftExpiry, setDraftExpiry] = useState(detail.expiresAt ?? '');
  const [draftReference, setDraftReference] = useState(
    detail.reference ?? '',
  );
  const [draftPaymentTerms, setDraftPaymentTerms] = useState(
    detail.paymentTerms ?? buildLegacyQuotePaymentSchedule(detail.totals.totalIncGstCents, detail.depositPercent),
  );
  const [draftItems, setDraftItems] = useState(detail.lineItems);
  const [unitInputDrafts, setUnitInputDrafts] = useState<
    Record<string, string>
  >({});
  const [activeUnitInputId, setActiveUnitInputId] = useState<string | null>(
    null,
  );
  const [draftPergolaOverrideMode, setDraftPergolaOverrideMode] = useState<
    Record<string, boolean>
  >({});
  const [draftIntro, setDraftIntro] = useState(detail.introText ?? '');
  const [draftTerms, setDraftTerms] = useState(detail.termsText ?? '');

  useEffect(() => {
    setPreparedRetryOpen(initialModalOpen);
  }, [initialModalOpen]);

  const dialogs = (
    <QuoteWorkflowDialogs
      detail={detail}
      refreshConfirmOpen={false}
      refreshUsesLatestDesign={false}
      refreshEstimateTarget={null}
      refreshBusy={false}
      refreshMode={refreshMode}
      setRefreshMode={setRefreshMode}
      refreshPreviewLoading={false}
      refreshPreviewError={null}
      refreshPreview={null}
      closeRefresh={() => undefined}
      confirmRefresh={() => undefined}
      preparedRetryOpen={preparedRetryOpen}
      preparedRetryLoading={false}
      preparedRetryBusy={preparedRetryBusy}
      preparedRetryError={null}
      preparedDelivery={preparedDelivery}
      closePreparedRetry={() => setPreparedRetryOpen(false)}
      retryPreparedDelivery={() => setPreparedRetryBusy(true)}
      sendOpen={false}
      sendMode="send"
      sendEditorMode={sendEditorMode}
      setSendEditorMode={setSendEditorMode}
      sendTo={sendTo}
      setSendTo={setSendTo}
      sendSubject={sendSubject}
      setSendSubject={setSendSubject}
      sendPersonalNote={sendPersonalNote}
      setSendPersonalNote={setSendPersonalNote}
      sendAttachments={sendAttachments}
      setSendAttachments={setSendAttachments}
      sendError={sendError}
      setSendError={setSendError}
      draftDirty={false}
      draftSyncPending={false}
      sendReviewPdfLoading={false}
      sendReviewPdfError={null}
      sendReviewPdfData={null}
      sendBusy={false}
      closeSend={() => undefined}
      sendQuote={() => undefined}
      expiredPromptOpen={false}
      closeExpiredPrompt={() => undefined}
      resolveExpiredQuote={() => undefined}
    />
  );

  return (
    <QuoteDetailView
      projectId={detail.projectId}
      detail={detail}
      draftDirty={false}
      draftSyncPending={false}
      guardUnsavedDraft={(action) => action()}
      selectQuote={() => undefined}
      savingDraft={false}
      reviewAndSend={() => undefined}
      retryPreparedDelivery={() => setPreparedRetryOpen(true)}
      resend={() => undefined}
      revise={() => undefined}
      reviseBusy={false}
      moreActionsOpen={moreActionsOpen}
      setMoreActionsOpen={setMoreActionsOpen}
      refreshEstimateTarget={null}
      refreshUsesLatestDesign={false}
      refreshBusy={false}
      openRefresh={() => undefined}
      downloadingDraftPdf={false}
      downloadDraftPdf={() => undefined}
      saveDraft={() => undefined}
      canDeleteQuote={false}
      openDeleteConfirm={() => undefined}
      canSupersedeQuote={false}
      supersedeQuote={() => undefined}
      supersedeBusy={false}
      openJobPackHref={null}
      canGenerateJobPack={false}
      generateJobPack={() => undefined}
      jobPackBusy={false}
      pagePreviewFromUrl={false}
      quotePdfPreviewLoading={false}
      quotePdfPreviewError={null}
      quotePdfPreviewData={null}
      quotePdfPreviewKey={null}
      draftExpiry={draftExpiry}
      setDraftExpiry={setDraftExpiry}
      draftReference={draftReference}
      setDraftReference={setDraftReference}
      draftPaymentTerms={draftPaymentTerms}
      setDraftPaymentTerms={setDraftPaymentTerms}
      draftItems={draftItems}
      setDraftItems={setDraftItems}
      unitInputDrafts={unitInputDrafts}
      setUnitInputDrafts={setUnitInputDrafts}
      activeUnitInputId={activeUnitInputId}
      setActiveUnitInputId={setActiveUnitInputId}
      getLiveUnitPriceIncGstCents={(item) => item.unitPriceIncGstCents}
      parsedPergolaDrafts={new Map()}
      draftPergolaOverrideMode={draftPergolaOverrideMode}
      setDraftPergolaOverrideMode={setDraftPergolaOverrideMode}
      updateDraftItemDescription={() => undefined}
      updatePergolaModule={() => undefined}
      updatePergolaSharedField={() => undefined}
      commitUnitPriceDraft={() => undefined}
      moveRow={() => undefined}
      deleteRow={() => undefined}
      addRow={() => undefined}
      detailTotals={detail.totals}
      draftIntro={draftIntro}
      setDraftIntro={setDraftIntro}
      draftTerms={draftTerms}
      setDraftTerms={setDraftTerms}
      accept={() => undefined}
      acceptBusy={false}
      decline={() => undefined}
      declineBusy={false}
      dialogs={dialogs}
    />
  );
}
