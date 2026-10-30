"use client";
import type {StudioOpeningPrice} from '@/lib/designStudio/studioOpening';
import type {QuoteVersionDetail} from '@/lib/quotes/types';
import StudioFlowShell from "./StudioFlowShell";
import {StudioDocumentContext} from './StudioDocumentContext';
import StudioRevisionStart from "./StudioRevisionStart";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateProjectReadCaches } from "@/lib/queries/projectCache";
import {
  supabaseHostFromUrl,
  supabaseRuntimeUrl,
} from "@/lib/supabase/browserClient";
import { apiJson } from "@/lib/repo/apiClient";
import type { SavedEstimateReview } from "@/lib/designStudio/savedReview";
import type { StudioAuthoringResponse } from "@/lib/designStudio/authoringRequest.server";
import {
  createStudioAuthoringEdit,
  type StudioAuthoringView,
} from "@/lib/designStudio/authoringView";
import { studioCanonicalJson } from "@/lib/designStudio/quoteSnapshot";
import { useStudioEditingSession } from "./useStudioEditingSession";
import { useStudioWebsitePrice } from "./useStudioWebsitePrice";
import StudioWebsiteRecovery from "./StudioWebsiteRecovery";
import StudioQuoteRecoveryGate from './StudioQuoteRecoveryGate';
import StudioCommercialFields from "./StudioCommercialFields";
import StudioSiteAddressPicker from "./StudioSiteAddressPicker";
import StudioTravelAllowance from './StudioTravelAllowance';
import {studioPendingTravelAllowance,studioTravelTripPlanIssue} from '@/lib/designStudio/studioTravelPlan';
import {parseStudioSelectedAddressProof,type StudioSelectedAddressProof} from '@/lib/designStudio/studioTravelAllowance';
import StudioAdminReview from "./StudioAdminReview";
import { usePortalSession } from "@/components/auth/PortalAuthProvider";
import type { CapturedStudioViews } from "./StudioQuoteViews";
import css from "./StudioReview.module.css";
import StudioCommercialPolicy from "./StudioCommercialPolicy";
import { useProjectCommercialContext } from "@/components/projects/ProjectPage/ProjectCommercialContext";
const StudioDesignSpecification = dynamic(
  () => import("./StudioDesignSpecification"),
  { ssr: false, loading: () => <p>Preparing the selected specification…</p> },
);
const QuoteDocument=dynamic(()=>import('./StudioQuoteDocument'),{ssr:false});
const Views = dynamic(() => import("./StudioQuoteViews"), {
  ssr: false,
  loading: ({error,retry}) => error?<p role="alert">The design views could not be opened. <button onClick={retry}>Retry views</button></p>:<p role="status">Preparing the complete design…</p>,
});
const money = (n: number) =>
  new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(
    n,
  );
export default function StudioWebsiteReview({
  review,
  actorId,
  relatedQuotes = [],
  openingPrice,
}: {
  review: SavedEstimateReview;
  actorId: string;
  relatedQuotes?: { id: string; status: string; label: string }[];
  openingPrice?: StudioOpeningPrice;
}) {
  return (
    <LoadedReview
      key={JSON.stringify([
        actorId,
        review.estimate.projectId,
        review.estimate.id,
      ])}
      review={review}
      actorId={actorId}
      relatedQuotes={relatedQuotes}
      openingPrice={openingPrice}
    />
  );
}
function LoadedReview({
  review,
  actorId,
  relatedQuotes = [],
  openingPrice,
}: {
  review: SavedEstimateReview;
  actorId: string;
  relatedQuotes?: { id: string; status: string; label: string }[];
  openingPrice?: StudioOpeningPrice;
}) {
  const supplied = useMemo<StudioAuthoringResponse | null>(() => review.websiteComposition && ["edit","create-revision"].includes(review.nextAction?.kind) && typeof review.estimate.updatedAt === "string" && Number.isFinite(Date.parse(review.estimate.updatedAt)) ? {
    state:"ready", view:review.websiteComposition, reason:null,
    estimate:{id:review.estimate.id,projectId:review.estimate.projectId,versionLabel:review.estimate.versionLabel,updatedAt:review.estimate.updatedAt??null,requiresNewRevision:review.nextAction.kind!=="edit"},
    nextAction:review.nextAction.kind==="edit"?"edit":"create-revision", identity:review.identity, preparedQuote:review.preparedQuote,
  } : null,[review]);
  const [remote, setLoaded] = useState<StudioAuthoringResponse | null>(null),
    [failure, setFailure] = useState(false),
    [attempt, setAttempt] = useState(0),
    [replacePreparation, setReplacePreparation] = useState(false),
    [quietCommercial,setQuietCommercial]=useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setFailure(false);
    setLoaded(null);
    if (supplied && attempt === 0) return () => abort.abort();
    apiJson<{ authoring: StudioAuthoringResponse }>(
      `/api/projects/${review.estimate.projectId}/estimates/${review.estimate.id}/studio`,
      { signal: abort.signal },
    )
      .then((r) => {
        if (
          r.authoring.estimate.id !== review.estimate.id ||
          r.authoring.estimate.projectId !== review.estimate.projectId
        )
          throw Error("Wrong saved design");
        if (!abort.signal.aborted) setLoaded(r.authoring);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailure(true);
      });
    return () => abort.abort();
  }, [actorId, review.estimate.id, review.estimate.projectId, attempt, supplied]);
  const loaded = attempt === 0 ? supplied ?? remote : remote;
  if (!loaded?.view)
    return (
      <main className={css.page}>
        <h1>Review your design</h1>
        {failure ? (
          <>
            <p role="alert">
              The saved design could not be loaded. Your local work is kept.
            </p>
            <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
          </>
        ) : (
          <p>Opening your working design…</p>
        )}
      </main>
    );
  if (loaded.estimate.requiresNewRevision || loaded.nextAction !== "edit")
    return (
      <StudioQuoteRecoveryGate scope={{actorId,projectId:review.estimate.projectId,estimateId:review.estimate.id,designId:loaded.view.designId}}
        recovery={<StudioCommercialPolicy actorId={actorId} projectId={review.estimate.projectId} quietChecking><WorkingReview review={review} actorId={actorId} authoring={loaded} view={loaded.view} onPrepareAgain={()=>{}} replayOnly/></StudioCommercialPolicy>}>
      <StudioFlowShell
        projectId={review.estimate.projectId}
        estimateId={review.estimate.id}
        identity={loaded.identity ?? review.identity}
        versionLabel={loaded.estimate.versionLabel}
        stage="review"
        quoteId={relatedQuotes[0]?.id}
        readOnly
      >
        <div className={css.reviewInputs}>
          <section>
            <StudioCommercialFields compact quoted edit={createStudioAuthoringEdit(loaded.view)} disabled onChange={()=>{}} />
            <ReviewSpecification edit={createStudioAuthoringEdit(loaded.view)} />
          </section>
          <aside className={css.reviewNotes}>
            <span className={css.badge}>Used by a quote</span>
            <h2>Your quoted design</h2>
            <p>
              This design is already used by a quote. Its views and price stay
              with that quote.
            </p>
            {relatedQuotes.length ? (
              <div className={css.relatedQuotes}>
                {relatedQuotes.map((q,index) => (
                  <Link
                    prefetch={false}
                    className={index===0?css.primaryLink:undefined}
                    key={q.id}
                    href={`/staff/design-studio/${review.estimate.projectId}/${review.estimate.id}?quoteVersionId=${encodeURIComponent(q.id)}`}
                  >
                    Open {q.label} · {q.status.toLowerCase()}
                  </Link>
                ))}
              </div>
            ) : (
              <p>
                No related quote could be identified here.{" "}
                <Link
                  prefetch={false}
                  href={`/staff/projects/${review.estimate.projectId}?tab=quotes`}
                >
                  Open Project quotes
                </Link>
              </p>
            )}
            {loaded.estimate.updatedAt && (
              <StudioRevisionStart
                actorId={actorId}
                projectId={review.estimate.projectId}
                estimateId={review.estimate.id}
                revision={loaded.view.revision}
                updatedAt={loaded.estimate.updatedAt}
                openOnCreated
              />
            )}
          </aside>
        </div>
      </StudioFlowShell>
      </StudioQuoteRecoveryGate>
    );
  return (
    <StudioCommercialPolicy
      actorId={actorId}
      projectId={review.estimate.projectId}
      quietChecking={quietCommercial}
    >
      <WorkingReview
        onQuotePresentation={setQuietCommercial}
        openingPrice={attempt===0&&supplied?openingPrice:undefined}
        key={attempt}
        review={review}
        actorId={actorId}
        authoring={
          replacePreparation ? { ...loaded, preparedQuote: undefined } : loaded
        }
        view={loaded.view}
        onPrepareAgain={() => {
          setReplacePreparation(true);
          setAttempt((n) => n + 1);
        }}
      />
    </StudioCommercialPolicy>
  );
}
function WorkingReview({
  openingPrice,
  review,
  actorId,
  authoring,
  view,
  replayOnly=false,
  onQuotePresentation,
  onPrepareAgain,
}: {
  review: SavedEstimateReview;
  actorId: string;
  authoring: StudioAuthoringResponse;
  view: StudioAuthoringView;
  onPrepareAgain: () => void;
  replayOnly?:boolean;
  onQuotePresentation?:(quiet:boolean)=>void;
  openingPrice?: StudioOpeningPrice;
}) {
  const frame=useContext(StudioDocumentContext);
  const auth = usePortalSession();
  const commercial = useProjectCommercialContext(),
    commandState = useRef({
      live: true,
      available: commercial.actionsAvailable,
      busy: false,
    });
  commandState.current.available = commercial.actionsAvailable;
  useEffect(() => {
    commandState.current.live = true;
    return () => {
      commandState.current.live = false;
    };
  }, []);
  const queryClient = useQueryClient();
  const router = useRouter(),
    scope = useMemo(
      () => ({
        actorId,
        projectId: review.estimate.projectId,
        estimateId: review.estimate.id,
        designId: view.designId,
      }),
      [actorId, review.estimate.projectId, review.estimate.id, view.designId],
    );
  const controller = useStudioEditingSession({
    scope,
    view,
    updatedAt: authoring.estimate.updatedAt,
    editable: !replayOnly,
  });
  const edit = controller.edit ?? createStudioAuthoringEdit(view);
  const confirmingQuote=replayOnly||Boolean(controller.quoteRecoveryCommand);
  useEffect(()=>{if(confirmingQuote)onQuotePresentation?.(true);},[confirmingQuote,onQuotePresentation]);
  const [selectedAddress,setSelectedAddress]=useState<StudioSelectedAddressProof|null>(null);
  function savedSiteAddress(proof:StudioSelectedAddressProof|null){
    const current=controller.captureEdit(controller.authoredIdentity);
    if(current){
      let travelAllowance:ReturnType<typeof studioPendingTravelAllowance>={mode:'pending'};
      try{travelAllowance=studioPendingTravelAllowance(current.site.travelAllowance);}
      catch{/* A genuinely selected new address can replace malformed retained travel. */}
      controller.change({...current,site:{...current.site,siteAddressProof:proof,travelAllowance}});
    }
    setSelectedAddress(proof);
  }
  let hasSiteAddressProof=false;try{hasSiteAddressProof=parseStudioSelectedAddressProof(edit.site.siteAddressProof)?.projectId===scope.projectId;}catch{/* Missing/malformed proof cannot authorize a new quote. */}
  const price = useStudioWebsitePrice({
    ...scope,
    revision: edit.revision,
    design: null,
    composition: confirmingQuote||controller.status==='locked'?null:controller.edit,
    openingPrice,
    openingState:!openingPrice?undefined:controller.status==='loading'?'waiting':controller.status==='ready'&&!controller.session?.dirty&&!controller.session?.pending&&!controller.retryOnly&&controller.localDurable?'eligible':'ineligible',
  });
  const priceIssue =
    price.error ??
    (price.price?.status === "unavailable"
      ? (price.price.reason ?? "The current design cannot be priced.")
      : null);
  let fieldHandlesPriceIssue=false;
  try{const issue=studioTravelTripPlanIssue(edit.site.travelAllowance,price.price?.installationEstimate?.siteDays??null);fieldHandlesPriceIssue=price.price?.status==='unavailable' && issue?.kind!=='unavailable' && issue?.message===priceIssue;}
  catch{/* Malformed travel still retains the normal price error/recovery. */}
  const source = useMemo(
    () => ({
      schemaVersion: "studio_authoring_view.v1",
      designId: edit.designId,
      revision: edit.revision,
      spatial: edit.spatial,
      site: edit.site,
      objectOptions: edit.objectOptions,
      pricing: "unpriced",
    }),
    [edit],
  );
  const identity = studioCanonicalJson(source),
    [capture, setCapture] = useState<{
      identity: string;
      images: CapturedStudioViews;
      requestId: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [workflow, setWorkflow] = useState<"idle" | "waiting" | "capturing">(
      "idle",
    ),
    [captureRequest, setCaptureRequest] = useState(0),
    [prepared, setPrepared] = useState<{
      binding: NonNullable<StudioAuthoringResponse["preparedQuote"]>;
      identity: string;
    } | null>(() =>
      authoring.preparedQuote
        ? {
            binding: authoring.preparedQuote,
            identity: studioCanonicalJson(view),
          }
        : null,
    ),
    [error, setError] = useState<string | null>(null);
  const separateDocuments=controller.quoteRecoveryCommand?true:prepared?.identity===identity?prepared.binding.documentMode==='separate_v1':review.clientDocumentsEnabled===true;
  const [createdQuote,setCreatedQuote]=useState<QuoteVersionDetail|null>(null),[createdPdf,setCreatedPdf]=useState<import('@/lib/designStudio/clientQuotePdf').StudioInitialQuotePdf|undefined>();
  const imageFreeIntent=useRef<{identity:string;id:string}|null>(null);
  if(imageFreeIntent.current?.identity!==identity)imageFreeIntent.current={identity,id:crypto.randomUUID()};
  const preparedRequest = prepared?.identity === identity;
  const captureViews = useCallback(
    (images: CapturedStudioViews) =>
      setCapture({ identity, images, requestId: crypto.randomUUID() }),
    [identity],
  );
  const captureError = useCallback((message: string) => {
    setError(message);
    setWorkflow("idle");
    setBusy(false);
    commandState.current.busy = false;
  }, []);
  const images = capture?.identity === identity ? capture : null;
  const ready =
    hasSiteAddressProof &&
    controller.status === "ready" &&
    controller.localDurable &&
    !controller.session?.dirty &&
    !controller.session?.pending &&
    price.price?.status === "priced";
  const canAct=()=>commandState.current.live&&commandState.current.available&&Boolean(controller.captureEdit(controller.authoredIdentity));
  async function prepare() {
    if (
      !canAct() ||
      !hasSiteAddressProof ||
      !ready ||
      (!preparedRequest && !images && !separateDocuments)
    ) {
      commandState.current.busy = false;
      setBusy(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const binding = preparedRequest
        ? prepared!.binding
        : await apiJson<{
            snapshotId: string;
            contentHash: string;
            documentMode?:'separate_v1';
            totalIncGstCents: number;
          }>(
            `/api/projects/${scope.projectId}/estimates/${scope.estimateId}/studio-quote`,
            {
              method: "POST",
              body: JSON.stringify({
                requestId: separateDocuments?imageFreeIntent.current!.id:images!.requestId,
                source,
                ...(separateDocuments?{documentMode:'separate_v1'}:{images:images!.images}),
              }),
            },
          );
      if (!commandState.current.live) return;
      setPrepared({ binding, identity });
      if (!canAct()) {
        setError(
          "The design and views are prepared. Review the current project state, then resume the same request.",
        );
        return;
      }
      const result = await apiJson<{ quoteVersion: QuoteVersionDetail;quotePdf?:import('@/lib/designStudio/clientQuotePdf').StudioInitialQuotePdf }>(
        `/api/projects/${scope.projectId}/quotes`,
        {
          method: "POST",
          body: JSON.stringify({
            estimateVersionId: scope.estimateId,
            clientIntentId: `studio:${binding.snapshotId}`,
            studioSnapshot: {
              snapshotId: binding.snapshotId,
              contentHash: binding.contentHash,
            },
          }),
        },
      );
      if (!commandState.current.live) return;
      if(separateDocuments){
        if(result.quoteVersion.projectId!==scope.projectId||result.quoteVersion.sourceEstimateVersionId!==scope.estimateId||result.quoteVersion.studioDesign?.snapshotId!==binding.snapshotId||result.quoteVersion.studioDesign.contentHash!==binding.contentHash)throw Error('The returned quote does not match the prepared design.');
        presentCreatedQuote(result.quoteVersion,result.quotePdf,binding.snapshotId);
        void Promise.resolve(invalidateProjectReadCaches(queryClient,supabaseHostFromUrl(supabaseRuntimeUrl())||'unknown',scope.projectId,{includeEstimates:true,includeQuotes:true})).catch(()=>{});
        return;
      }
      await invalidateProjectReadCaches(
        queryClient,
        supabaseHostFromUrl(supabaseRuntimeUrl()) || "unknown",
        scope.projectId,
        { includeEstimates: true, includeQuotes: true },
      );
      if (!commandState.current.live) return;
      router.push(
        `/staff/design-studio/${scope.projectId}/${scope.estimateId}?quoteVersionId=${encodeURIComponent(result.quoteVersion.id)}`,
      );
    } catch (e) {
      if (commandState.current.live)
        setError(
          e instanceof Error
            ? e.message
            : "The quote could not be created. Retry the same prepared request.",
        );
    } finally {
      if (commandState.current.live) {
        setBusy(false);
        commandState.current.busy = false;
        setWorkflow("idle");
      }
    }
  }
  function presentCreatedQuote(quote:QuoteVersionDetail,pdf:import('@/lib/designStudio/clientQuotePdf').StudioInitialQuotePdf|undefined,requestId:string){
    if(frame?.adoptCommittedQuote)frame.adoptCommittedQuote({actorId,requestId,quote});
    else{
      const state={...(history.state??{})};delete state.__NA;delete state._N;
      history.replaceState(state,'',`/staff/design-studio/${scope.projectId}/${scope.estimateId}?quoteVersionId=${encodeURIComponent(quote.id)}`);
    }
    onQuotePresentation?.(true);setCreatedPdf(pdf);setCreatedQuote(quote);
  }
  async function startQuote() {
    if (
      !hasSiteAddressProof ||
      commandState.current.busy ||
      busy ||
      !(controller.quoteRecoveryCommand?commandState.current.live&&commandState.current.available&&controller.canRetryQuote:canAct()) ||
      controller.status !== "ready" ||
      !controller.localDurable
    )
      return;
    commandState.current.busy = true;
    if(separateDocuments&&(!preparedRequest||controller.quoteRecoveryCommand)){
      setBusy(true);setError(null);
      try{
        const command=await controller.beginQuote(imageFreeIntent.current!.id);
        if(!commandState.current.live||!commandState.current.available||!controller.canSubmitQuote(command)){controller.failQuote();return;}
        const result=await apiJson<{quoteVersion:QuoteVersionDetail;quotePdf?:import('@/lib/designStudio/clientQuotePdf').StudioInitialQuotePdf;saveReceipt:import('@/lib/designStudio/saveTransport').StudioSaveReceipt;savedView:StudioAuthoringView;sourceUpdatedAt:string}>(
          `/api/projects/${scope.projectId}/estimates/${scope.estimateId}/studio-quote/create`,{method:'POST',body:JSON.stringify(command)},
        );
        if(!commandState.current.live)return;
        if(result.quoteVersion.projectId!==scope.projectId||result.quoteVersion.sourceEstimateVersionId!==scope.estimateId||result.quoteVersion.studioDesign?.snapshotId!==command.requestId)throw Error('The returned quote does not match this design request.');
        await controller.finishQuote(command,result);
        if(!commandState.current.live)return;
        presentCreatedQuote(result.quoteVersion,result.quotePdf,command.requestId);
        void Promise.resolve(invalidateProjectReadCaches(queryClient,supabaseHostFromUrl(supabaseRuntimeUrl())||'unknown',scope.projectId,{includeEstimates:true,includeQuotes:true})).catch(()=>{});
      }catch(error){controller.failQuote();if(commandState.current.live)setError(error instanceof Error?error.message:'The quote could not be confirmed. Retry the same request.');}
      finally{if(commandState.current.live){setBusy(false);commandState.current.busy=false;}}
      return;
    }
    if (preparedRequest || images || (separateDocuments&&ready)) {
      void prepare();
      return;
    }
    setError(null);
    setCapture(null);
    setBusy(true);
    if (controller.session?.dirty) {
      if (!controller.canSave) {
        setBusy(false);
        commandState.current.busy = false;
        setError(
          "Finish or repair the current changes before creating the quote.",
        );
        return;
      }
      try {
        await controller.save();
      } catch {
        setBusy(false);
        commandState.current.busy = false;
        setError(
          "The design could not be saved. Review its recovery message and try again.",
        );
        return;
      }
    }
    if (commandState.current.live) setWorkflow("waiting");
  }
  useEffect(() => {
    if (workflow !== "waiting") return;
    if (
      !canAct() ||
      controller.status !== "ready" ||
      controller.session?.dirty ||
      controller.session?.pending ||
      !controller.localDurable
    ) {
      setBusy(false);
      commandState.current.busy = false;
      setWorkflow("idle");
      setError(
        "The design is not yet saved safely. Review the save message, then try again.",
      );
      return;
    }
    if (priceIssue) {
      setBusy(false);
      commandState.current.busy = false;
      setWorkflow("idle");
      setError(priceIssue);
      return;
    }
    if (!ready) return;
    if(separateDocuments){setWorkflow("idle");void prepare();return;}
    setWorkflow("capturing");
    setCaptureRequest((n) => n + 1);
  }, [
    workflow,
    controller.status,
    controller.session?.dirty,
    controller.session?.pending,
    controller.localDurable,
    ready,
    priceIssue,
    commercial.actionsAvailable,
  ]);
  useEffect(() => {
    if (workflow === "capturing" && images && ready) {
      setWorkflow("idle");
      void prepare();
    }
  }, [workflow, images, ready]);
  useEffect(() => {
    if (!busy || workflow === "idle") return;
    const timer = setTimeout(() => {
      setBusy(false);
      commandState.current.busy = false;
      setWorkflow("idle");
      setError(
        "The quote could not be completed yet. Your saved work and any prepared request are kept. Try again.",
      );
    }, 30000);
    return () => clearTimeout(timer);
  }, [busy, workflow]);
  if(createdQuote)return <QuoteDocument review={review} quote={createdQuote} actorId={actorId} initialPdf={createdPdf} lifetime={frame?.requestIssued?.signal}/>;
  if(confirmingQuote)return <StudioFlowShell projectId={scope.projectId} estimateId={scope.estimateId} identity={authoring.identity??review.identity} versionLabel={authoring.estimate.versionLabel} stage="review" readOnly>
    <section className={css.page} aria-label="Quote confirmation"><h2>Confirm quote</h2>
      <StudioWebsiteRecovery controller={controller} onRetryQuote={()=>void startQuote()}/>
      {busy&&<p role="status">Confirming the original quote request…</p>}
      {error&&<p role="alert">{error}</p>}
    </section>
  </StudioFlowShell>;
  const createButton = (
    <button
      className={css.primary}
      disabled={
        !commercial.actionsAvailable ||
        !hasSiteAddressProof ||
        busy ||
        controller.status !== "ready" ||
        !controller.localDurable ||
        (!separateDocuments && !controller.canSave && !ready)
      }
      onClick={() => void startQuote()}
    >
      {busy
        ? workflow === "capturing"
          ? "Capturing design views…"
          : "Preparing quote…"
        : controller.quoteRecoveryCommand?'Retry quote':preparedRequest
          ? "Finish creating this quote"
          : "Create quote"}
    </button>
  );
  return (
    <StudioFlowShell
      projectId={scope.projectId}
      estimateId={scope.estimateId}
      identity={authoring.identity ?? review.identity}
      versionLabel={authoring.estimate.versionLabel}
      stage="review"
      total={
        <>
          {price.price?.status === "priced"
            ? money(price.price.amount!)
            : priceIssue
              ? "Price unavailable"
              : "Calculating…"}
          <small>
            Including GST
            {price.price?.versionNumber
              ? ` · Current Pricebook ${price.price.versionNumber}`
              : ""}
          </small>
        </>
      }
      actions={replayOnly?undefined:createButton}
    >
      <div className={css.reviewInputs}>
        <section>
          <StudioWebsiteRecovery controller={controller} onRetryQuote={()=>void startQuote()} />
          <StudioSiteAddressPicker actorId={actorId} projectId={scope.projectId} disabled={!controller.canEdit || busy || preparedRequest} canEditNow={() => Boolean(controller.captureEdit(controller.authoredIdentity))} onSaved={savedSiteAddress} />
          <StudioCommercialFields
            travelControl={<StudioTravelAllowance projectId={scope.projectId} edit={edit} siteDays={price.price?.installationEstimate?.siteDays??null} estimatePending={!price.price&&!price.error} disabled={!controller.canEdit||busy||preparedRequest} selected={selectedAddress} getCurrent={()=>controller.captureEdit(controller.authoredIdentity)} onChange={controller.change} onDerivedChange={controller.changeDerived}/>}
            compact
            assumptions={
              price.price?.status === "priced"
                ? price.price.siteAssumptions
                : undefined
            }
            edit={edit}
            disabled={!controller.canEdit || busy || preparedRequest}
            onChange={controller.change}
          />
        </section>
        <aside className={css.reviewNotes}>
          {priceIssue && !fieldHandlesPriceIssue && <p role="alert">{priceIssue} <button onClick={price.retry}>Retry price</button></p>}
          {price.price?.breakdown
            ?.filter((line) => line.provisional)
            .map((line, i) => (
              <p key={i} role="note">
                Allowance: {line.label} · {money(line.amount)}
                {line.detail ? ` · ${line.detail}` : ""}
              </p>
            ))}
          {price.price?.breakdown && (
            <details>
              <summary>Price breakdown &amp; allowances</summary>
              <table className={css.breakdown}>
                <caption>Quote price breakdown</caption>
                <tbody>
                  {price.price.breakdown.map((line, i) => (
                    <tr key={i}>
                      <td>
                        {line.label}
                        {line.provisional ? " (allowance)" : ""}
                        <br />
                        <small>{line.detail}</small>
                      </td>
                      <td>{money(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          {auth.role === "admin" && (
            <details>
              <summary>Internal cost review</summary>
              <StudioAdminReview
                estimateId={scope.estimateId}
                costs={price.price?.internalCosts}
              />
            </details>
          )}
          <ReviewSpecification edit={edit} />
          {edit.spatial.houseAssembly?.houseForms.length ? <p className={css.contextNote}>Existing house works are excluded unless stated in the quote.</p> : null}
          <details><summary>Need a specialist design?</summary><p>Custom pitch, overhangs, inverted roofs, insulated roof-above panels, wider trays and drainage variants use the specialist calculator. Your Studio design stays saved here.</p><Link href={`/staff/projects/${scope.projectId}?tab=estimates&newDesign=1`}>Open specialist calculator</Link></details>
          {workflow === "capturing" && <Views edit={edit} onCapture={captureViews} captureRequest={captureRequest} onCaptureError={captureError} manualCapture={false} captureOnly disabled={!ready || Boolean(preparedRequest)} />}
          <p className={css.viewHelp}>
            {!hasSiteAddressProof&&'Choose a physical site address before creating a quote. '}
            {separateDocuments?'Create quote saves valid site changes and prepares the design booklet in the background. No email is sent.':'Create quote saves valid site changes and includes the current Plan and 3D views. No email is sent.'}
          </p>
          {controller.session?.dirty && (
            <p role="status">Your current changes will be saved first.</p>
          )}
          {preparedRequest && (
            <>
              <p role="status">
                Your saved design and views are ready. Continue the same quote
                request.
              </p>
              <button disabled={busy} onClick={onPrepareAgain}>
                Use updated views and price
              </button>
            </>
          )}
          {error && (
            <p className={css.message} role="alert">
              {error}
            </p>
          )}
        </aside>
      </div>
    </StudioFlowShell>
  );
}

function ReviewSpecification({edit}:{edit:ReturnType<typeof createStudioAuthoringEdit>}) {
  const [open,setOpen]=useState(false);
  return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>Design specification</summary>{open&&<StudioDesignSpecification edit={edit}/>}</details>;
}
