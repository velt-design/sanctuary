"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { QuoteVersionDetail } from "@/lib/quotes/types";
import { apiJson } from "@/lib/repo/apiClient";
import type { StudioPackageFile } from "@/lib/designStudio/clientPackage";
import { useStudioClientPackage } from "./useStudioClientPackage";
import css from "./StudioClientPackage.module.css";
const Pdf = dynamic(
  () => import("@/components/projects/ProjectPage/tabs/QuotePdfInlinePreview"),
  { ssr: false, loading: () => <p role="status">Opening document viewer…</p> },
);
const Rendered = dynamic(() => import("./StudioRenderedViews"), {
  ssr: false,
  loading: () => <p role="status">Opening rendered views…</p>,
});
export default function StudioClientPackage({
  quote,
  pdf,
  lifetime,
  children,
  pdfError,
  onRetryPdf,
  actorId,
}: {
  quote: QuoteVersionDetail;
  pdf: Uint8Array | null;
  lifetime?: AbortSignal;
  children?: ReactNode;
  pdfError?: string | null;
  onRetryPdf?: () => void;
  actorId: string;
}) {
  const packageState = useStudioClientPackage(quote.id, lifetime, actorId),
    { state, value, saving, error, endpoint, change, action } = packageState;
  const [tab, setTab] = useState<"quote" | "booklet" | "rendered">("quote"),
    [booklet, setBooklet] = useState<{ id: string; bytes: Uint8Array } | null>(
      null,
    ),
    [documentError, setDocumentError] = useState<string | null>(null),
    [documentAttempt, setDocumentAttempt] = useState(0),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState<string | null>(null),
    [fileNotice, setFileNotice] = useState<string | null>(null),
    [acting, setActing] = useState(false);
  const input = useRef<HTMLInputElement | null>(null),
    ready =
      state?.document?.state === "ready" &&
      !saving &&
      !packageState.dirty &&
      !packageState.conflicted,
    prepared = !!state?.draft.preparedIntentId;
  const deliveryStatus = state?.prepared?.status ?? "prepared",
    deliveryLabel =
      deliveryStatus === "finalised"
        ? "Sent"
        : deliveryStatus === "provider_accepted"
          ? "Confirming delivery"
          : deliveryStatus === "dispatching"
            ? "Delivery in progress"
            : deliveryStatus === "failed"
              ? "Delivery needs retry"
              : deliveryStatus === "needs_attention"
                ? "Delivery needs attention"
                : "Prepared · not sent";
  useEffect(() => {
    if (
      tab !== "booklet" ||
      !ready ||
      !state?.draft.documentId ||
      booklet?.id === state.draft.documentId
    )
      return;
    const abort = new AbortController(),
      retire = () => abort.abort();
    lifetime?.addEventListener("abort", retire, { once: true });
    if (lifetime?.aborted) retire();
    setDocumentError(null);
    const id = state.draft.documentId,
      revision = state.draft.revision;
    void fetch(
      `${endpoint}/document?download=1&documentId=${encodeURIComponent(id)}&revision=${revision}`,
      { credentials: "same-origin", signal: abort.signal },
    )
      .then(async (response) => {
        if (!response.ok)
          throw Error("The selected booklet could not be opened.");
        if (
          response.headers.get("X-Studio-Document-Id") !== id ||
          response.headers.get("X-Studio-Package-Revision") !== String(revision)
        )
          throw Error(
            "The booklet selection changed. Reload its current preview.",
          );
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!abort.signal.aborted) setBooklet({ id, bytes });
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setDocumentError(
            e instanceof Error ? e.message : "The booklet could not be opened.",
          );
      });
    return () => {
      abort.abort();
      lifetime?.removeEventListener("abort", retire);
    };
  }, [
    tab,
    ready,
    state?.draft.documentId,
    endpoint,
    lifetime,
    documentAttempt,
    booklet?.id,
  ]);
  async function upload(file: File) {
    if (uploading || lifetime?.aborted) return;
    setUploading(true);
    setUploadError(null);
    try {
      if (
        file.size > 2 * 1024 * 1024 ||
        !["image/png", "image/jpeg"].includes(file.type)
      )
        throw Error("Choose a JPG or PNG up to 2MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let encoded = "";
      for (let i = 0; i < bytes.length; i += 16384)
        encoded += String.fromCharCode(...bytes.subarray(i, i + 16384));
      const result = await apiJson<{ file: StudioPackageFile }>(
        `${endpoint}/assets`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            contentBase64: btoa(encoded),
          }),
          signal: lifetime,
        },
      );
      if (!lifetime?.aborted) packageState.added(result.file);
    } catch (e) {
      if (!lifetime?.aborted)
        setUploadError(
          e instanceof Error ? e.message : "The image could not be added.",
        );
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  async function perform(kind: "prepare" | "cancel" | "send" | "retry") {
    if (acting || lifetime?.aborted) return;
    setActing(true);
    try {
      await action(kind);
    } finally {
      setActing(false);
    }
  }
  async function importFile(projectFileId: string) {
    if (uploading || !value || lifetime?.aborted) return;
    setUploading(true);
    setUploadError(null);
    setFileNotice(null);
    try {
      const result = await apiJson<{ file: StudioPackageFile }>(
        `${endpoint}/assets`,
        {
          method: "POST",
          body: JSON.stringify({ projectFileId }),
          signal: lifetime,
        },
      );
      if (lifetime?.aborted) return;
      if (packageState.attachFile(result.file) === "rendered")
        setFileNotice(
          "This view is already included inside the design booklet.",
        );
    } catch (e) {
      if (!lifetime?.aborted)
        setUploadError(
          e instanceof Error
            ? e.message
            : "The project file could not be added.",
        );
    } finally {
      setUploading(false);
    }
  }
  const currentBooklet =
    booklet &&
    booklet.id === state?.draft.documentId &&
    !saving &&
    !packageState.dirty &&
    !packageState.conflicted;
  const renders = state?.files.filter((file) => file.renderEligible) ?? [],
    selectedFiles =
      state?.files.filter((file) => value?.fileIds.includes(file.id)) ?? [];
  return (
    <div className={css.layout}>
      <section className={css.viewer} aria-label="Client document preview">
        <div
          className={css.tabs}
          role="tablist"
          aria-label="Client document views"
          onKeyDown={(event) => {
            const order = ["quote", "booklet", "rendered"] as const;
            let index = order.indexOf(tab);
            if (event.key === "ArrowRight") index = (index + 1) % 3;
            else if (event.key === "ArrowLeft") index = (index + 2) % 3;
            else if (event.key === "Home") index = 0;
            else if (event.key === "End") index = 2;
            else return;
            event.preventDefault();
            setTab(order[index]);
            event.currentTarget.querySelectorAll("button")[index]?.focus();
          }}
        >
          {(["quote", "booklet", "rendered"] as const).map((view) => (
            <button
              key={view}
              role="tab"
              aria-selected={tab === view}
              aria-controls={`studio-package-${view}`}
              tabIndex={tab === view ? 0 : -1}
              onClick={() => setTab(view)}
            >
              {view === "quote"
                ? "Quote"
                : view === "booklet"
                  ? "Booklet"
                  : "Rendered"}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`studio-package-${tab}`}
          aria-label={`${tab} preview`}
        >
          {tab === "quote" ? (
            pdf ? (
              <Pdf data={pdf} compact />
            ) : pdfError ? (
              <p role="alert">
                {pdfError} <button onClick={onRetryPdf}>Retry document</button>
              </p>
            ) : (
              <p role="status">Preparing quote document…</p>
            )
          ) : tab === "rendered" ? (
            <Rendered
              endpoint={endpoint}
              onAdded={packageState.added}
              lifetime={lifetime}
            />
          ) : (
            <>
              <div className={css.bookletActions}>
                <span role="status">
                  {packageState.conflicted
                    ? "Review the saved package"
                    : saving || packageState.dirty
                      ? "Saving package…"
                      : state?.document?.state === "ready"
                        ? `${state.document.totalPages} pages${value?.renderFileIds.length ? `, including ${value.renderFileIds.length} rendered ${value.renderFileIds.length === 1 ? "view" : "views"}` : ""}`
                        : state?.document?.state === "unavailable"
                          ? "No pergola drawings"
                          : state?.document?.state === "failed"
                            ? "Booklet preparation failed"
                            : state?.document
                              ? `${state.document.completedPages} / ${state.document.totalPages} pages prepared`
                              : "Checking booklet…"}
                </span>
                {ready && (
                  <a
                    href={`${endpoint}/document?download=1&documentId=${encodeURIComponent(state!.draft.documentId!)}&revision=${state!.draft.revision}`}
                    download
                  >
                    Download booklet
                  </a>
                )}
                {state?.document?.canRetry && (
                  <button
                    disabled={acting}
                    onClick={() => void perform("retry")}
                  >
                    Retry booklet
                  </button>
                )}
              </div>
              {booklet && !currentBooklet && (
                <p className={css.note}>
                  Previous booklet preview.{" "}
                  {packageState.conflicted
                    ? "Local package changes are not confirmed."
                    : packageState.dirty
                      ? "Package changes are not confirmed yet."
                      : state?.document?.state === "failed"
                        ? "The selected booklet failed to prepare."
                        : ready
                          ? "Opening the selected booklet…"
                          : "The selected views are being prepared."}
                </p>
              )}
              {booklet ? (
                <Pdf data={booklet.bytes} compact />
              ) : !documentError ? (
                <div className={css.empty}>
                  <p>
                    {state?.document?.state === "failed"
                      ? "Retry the booklet to prepare its preview."
                      : state?.document?.state === "unavailable"
                        ? "This quote has no pergola drawings."
                        : "The design booklet will appear here when it is ready. You can keep working on the package."}
                  </p>
                  {state?.document &&
                    !ready &&
                    state.document.state !== "unavailable" && (
                      <progress
                        aria-label="Selected booklet progress"
                        max={100}
                        value={state.document.percent}
                      />
                    )}
                </div>
              ) : null}
              {documentError && (
                <p role="alert">
                  {documentError}{" "}
                  <button onClick={() => setDocumentAttempt((n) => n + 1)}>
                    Retry preview
                  </button>
                  <button onClick={packageState.reload}>Reload package</button>
                </p>
              )}
            </>
          )}
        </div>
      </section>
      <aside className={css.composer} aria-label="Client package">
        <div className={css.heading}>
          <h2>Client package</h2>
          <span>
            {prepared
              ? deliveryLabel
              : saving
                ? "Saving…"
                : packageState.dirty
                  ? "Unsaved changes"
                  : quote.status === "DRAFT"
                    ? "Draft · not sent"
                    : quote.status.toLowerCase()}
          </span>
        </div>
        {value && state ? (
          <>
            <fieldset disabled={prepared || acting} className={css.fields}>
              <label>
                To
                <input
                  type="email"
                  value={value.to}
                  onChange={(event) =>
                    change({ ...value, to: event.target.value })
                  }
                  autoComplete="email"
                />
              </label>
              <label>
                Subject
                <input
                  value={value.subject}
                  maxLength={200}
                  onChange={(event) =>
                    change({ ...value, subject: event.target.value })
                  }
                />
              </label>
              <label>
                Message
                <textarea
                  value={value.message}
                  rows={7}
                  maxLength={10000}
                  onChange={(event) =>
                    change({ ...value, message: event.target.value })
                  }
                />
              </label>
              <div className={css.documents}>
                <h3>Documents</h3>
                <label className={css.check}>
                  <input type="checkbox" checked disabled />
                  Financial quote{" "}
                  <small>
                    {quote.quoteRef} V{quote.versionNumber}
                  </small>
                </label>
                <label className={css.check}>
                  <input
                    type="checkbox"
                    checked={value.includeBooklet}
                    disabled={state.document?.state === "unavailable"}
                    onChange={(event) =>
                      change(
                        { ...value, includeBooklet: event.target.checked },
                        true,
                      )
                    }
                  />
                  Design booklet{" "}
                  <small>
                    {state.document?.state === "ready"
                      ? `${state.document.totalPages} pages`
                      : state.document?.state === "failed"
                        ? "Needs retry"
                        : state.document?.state === "unavailable"
                          ? "No drawings"
                          : state.document
                            ? `${state.document.completedPages}/${state.document.totalPages} prepared`
                            : "Preparing…"}
                  </small>
                </label>
              </div>
              <div className={css.renders}>
                <h3>
                  Rendered pages{" "}
                  <small>{value.renderFileIds.length} selected</small>
                </h3>
                <p className={css.note}>
                  Checked views go inside the design booklet, after the
                  drawings.
                </p>
                {renders.map((file) => (
                  <label key={file.id} className={css.render}>
                    <input
                      type="checkbox"
                      checked={value.renderFileIds.includes(file.id)}
                      onChange={(event) =>
                        change(
                          {
                            ...value,
                            renderFileIds: event.target.checked
                              ? [...value.renderFileIds, file.id]
                              : value.renderFileIds.filter(
                                  (id) => id !== file.id,
                                ),
                            fileIds: event.target.checked
                              ? value.fileIds.filter((id) => id !== file.id)
                              : value.fileIds,
                          },
                          true,
                        )
                      }
                    />
                    <img
                      alt=""
                      loading="lazy"
                      src={`${endpoint}/assets?id=${encodeURIComponent(file.id)}`}
                    />
                    <span>{file.filename}</span>
                  </label>
                ))}
                <div className={css.addActions}>
                  <button onClick={() => setTab("rendered")} type="button">
                    Capture design views
                  </button>
                  <label className={css.upload}>
                    {uploading ? "Adding…" : "Add image"}
                    <input
                      ref={input}
                      type="file"
                      accept="image/png,image/jpeg"
                      disabled={uploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(file);
                      }}
                    />
                  </label>
                </div>
                {uploadError && <p role="alert">{uploadError}</p>}
              </div>
              <details>
                <summary>
                  Project files
                  {value.fileIds.length ? ` (${value.fileIds.length})` : ""}
                </summary>
                <p className={css.note}>
                  Separate attachments. Up to 4MB combined with the design
                  booklet.
                </p>
                {state.files.length ? (
                  state.files.map((file) => (
                    <label key={file.id} className={css.check}>
                      <input
                        type="checkbox"
                        checked={value.fileIds.includes(file.id)}
                        disabled={
                          value.renderFileIds.includes(file.id) ||
                          (file.separateEligible === false &&
                            !value.fileIds.includes(file.id))
                        }
                        onChange={(event) =>
                          change(
                            {
                              ...value,
                              fileIds: event.target.checked
                                ? [...value.fileIds, file.id]
                                : value.fileIds.filter((id) => id !== file.id),
                            },
                            true,
                          )
                        }
                      />
                      <span>{file.filename}</span>
                      {file.separateEligible === false && (
                        <small>Use document controls</small>
                      )}
                      <small>
                        {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB
                      </small>
                    </label>
                  ))
                ) : (
                  <p>No saved package files yet.</p>
                )}
                {state.filesHasMore && (
                  <p className={css.note}>
                    More saved files are available. Selected files remain
                    included.{" "}
                    <button
                      type="button"
                      disabled={(state.filesOffset ?? 0) >= 10000}
                      onClick={() => void packageState.loadMore()}
                    >
                      Load more files
                    </button>
                  </p>
                )}
                {state.enquiryFiles?.map((file) => (
                  <div key={file.id} className={css.check}>
                    <span>{file.filename}</span>
                    <button
                      type="button"
                      disabled={uploading || file.sizeBytes > 4 * 1024 * 1024}
                      onClick={() => void importFile(file.id)}
                    >
                      Add to package
                    </button>
                  </div>
                ))}
              </details>
              {fileNotice && (
                <p role="status" className={css.note}>
                  {fileNotice}
                </p>
              )}
            </fieldset>
            <details className={css.preview}>
              <summary>Package preview</summary>
              <ul>
                <li>
                  {quote.quoteRef} V{quote.versionNumber}.pdf
                </li>
                {value.includeBooklet && (
                  <li>
                    Design booklet
                    {value.renderFileIds.length
                      ? ` with ${value.renderFileIds.length} rendered pages`
                      : ""}
                    {!ready ? " (preparing)" : ""}
                  </li>
                )}
                {selectedFiles.map((file) => (
                  <li key={file.id}>{file.filename}</li>
                ))}
              </ul>
              {!value.includeBooklet && value.renderFileIds.length > 0 && (
                <p className={css.note}>
                  The design booklet and its rendered pages are excluded from
                  this package.
                </p>
              )}
              {state.prepared && <pre>{state.prepared.text}</pre>}
            </details>
            {error && (
              <p role="alert">
                {error}{" "}
                <button
                  disabled={acting || packageState.conflicted}
                  onClick={packageState.retrySave}
                >
                  Retry save
                </button>{" "}
                <button onClick={packageState.reload}>Reload package</button>
              </p>
            )}
            {packageState.retainedValue && (
              <p className={css.note}>
                Your previous unsaved inputs are kept on this page.{" "}
                <button
                  disabled={acting || packageState.conflicted || prepared}
                  onClick={packageState.restoreRetained}
                >
                  Restore previous inputs
                </button>
                <button
                  disabled={acting}
                  onClick={packageState.discardRetained}
                >
                  Discard previous inputs
                </button>
              </p>
            )}
            <div className={css.delivery}>
              {prepared ? (
                <>
                  <p className={css.note}>
                    {deliveryStatus === "prepared"
                      ? "This exact message and document selection is prepared. Nothing has been sent."
                      : deliveryStatus === "finalised"
                        ? "This exact package has been sent."
                        : "This delivery has already been attempted. Its exact message and documents are kept for recovery."}
                  </p>
                  {deliveryStatus === "prepared" && (
                    <button
                      disabled={acting}
                      onClick={() => void perform("cancel")}
                    >
                      Edit package
                    </button>
                  )}
                  {!["finalised", "needs_attention", "cancelled"].includes(
                    deliveryStatus,
                  ) && (
                    <button
                      className={css.primary}
                      disabled={acting || !state.canSend}
                      onClick={() => void perform("send")}
                    >
                      {acting
                        ? "Working…"
                        : deliveryStatus === "prepared"
                          ? "Send package"
                          : "Retry prepared delivery"}
                    </button>
                  )}
                  {!state.canSend && (
                    <small>Sending is disabled during the Design Studio trial.</small>
                  )}
                </>
              ) : (
                <button
                  className={css.primary}
                  disabled={
                    acting ||
                    saving ||
                    !!error ||
                    (value.includeBooklet && !ready)
                  }
                  onClick={() => void perform("prepare")}
                >
                  {acting
                    ? "Preparing email…"
                    : saving
                      ? "Saving…"
                      : "Prepare email"}
                </button>
              )}
            </div>
          </>
        ) : error ? (
          <p role="alert">
            {error} <button onClick={packageState.reload}>Retry package</button>
          </p>
        ) : (
          <p role="status">Opening client package…</p>
        )}
        <div className={css.history}>{children}</div>
      </aside>
    </div>
  );
}
