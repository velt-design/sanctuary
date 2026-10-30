"use client";
import { useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/repo/apiClient";
import { registerStudioPresentation } from "@/lib/designStudio/studioSessionLifecycle";
import {
  readStudioPackageLocalDraft,
  writeStudioPackageLocalDraft,
  clearStudioPackageLocalDraft,
  type StudioPackageLocalScope,
} from "@/lib/designStudio/clientPackageLocalDraft";
import { studioPackageDraftKey } from "@/lib/designStudio/clientPackage";
import type {
  StudioPackageDraftValue,
  StudioPackageState,
} from "@/lib/designStudio/clientPackage";
/** One writer per browser instance, coalesced changes and authoritative CAS across windows. */
export function useStudioClientPackage(
  quoteId: string,
  lifetime?: AbortSignal,
  actorId?: string,
) {
  const endpoint = `/api/quotes/${encodeURIComponent(quoteId)}/studio-package`;
  const [state, setState] = useState<StudioPackageState | null>(null),
    [value, setValue] = useState<StudioPackageDraftValue | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [conflicted, setConflicted] = useState(false),
    [retainedValue, setRetainedValue] =
      useState<StudioPackageDraftValue | null>(null),
    [attempt, setAttempt] = useState(0);
  const current = useRef<StudioPackageState | null>(null),
    wanted = useRef<StudioPackageDraftValue | null>(null),
    pending = useRef<StudioPackageDraftValue | null>(null),
    pump = useRef<Promise<void> | null>(null),
    abort = useRef<AbortController | null>(null);
  const conflict = useRef(false),
    preferSaved = useRef(false),
    journal = useRef<{
      scope: StudioPackageLocalScope | null;
      value: StudioPackageDraftValue | null;
      revision: number;
      durable: boolean;
    }>({ scope: null, value: null, revision: 0, durable: true }),
    retainedOwner = useRef({ quoteId, lifetime, actorId }),
    actionPending = useRef(false);
  const serial = useRef(0),
    activeQuote = useRef(quoteId),
    activeActor = useRef(actorId);
  activeQuote.current = quoteId;
  activeActor.current = actorId;
  useEffect(() => {
    const controller = new AbortController(),
      retire = () => controller.abort();
    abort.current = controller;
    journal.current = {
      scope: actorId ? { actorId, quoteId } : null,
      value: null,
      revision: 0,
      durable: true,
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    lifetime?.addEventListener("abort", retire, { once: true });
    if (lifetime?.aborted) retire();
    current.current = null;
    wanted.current = null;
    pending.current = null;
    pump.current = null;
    serial.current++;
    conflict.current = false;
    setConflicted(false);
    actionPending.current = false;
    if (
      retainedOwner.current.quoteId !== quoteId ||
      retainedOwner.current.actorId !== actorId ||
      retainedOwner.current.lifetime !== lifetime
    )
      setRetainedValue(null);
    retainedOwner.current = { quoteId, lifetime, actorId };
    setState(null);
    setValue(null);
    setError(null);
    setSaving(false);
    const load = async (initial = false) => {
      try {
        const response = await apiJson<{ package: StudioPackageState }>(
          `${endpoint}${initial ? "" : "?status=1"}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!response.package?.draft)
          throw Error("The package could not be loaded");
        if (!pump.current && !pending.current) {
          const next = {
            ...response.package,
            files: initial
              ? response.package.files
              : (current.current?.files ?? []),
            enquiryFiles: initial
              ? response.package.enquiryFiles
              : (current.current?.enquiryFiles ?? []),
            filesHasMore: initial
              ? response.package.filesHasMore
              : current.current?.filesHasMore,
            filesOffset: initial ? 0 : current.current?.filesOffset,
          };
          current.current = next;
          setState(next);
          wanted.current = next.draft.value;
          setValue(next.draft.value);
          setError(null);
          if (journal.current.scope) {
            try {
              const local = readStudioPackageLocalDraft(journal.current.scope);
              if (
                local &&
                studioPackageDraftKey(local.value) !==
                  studioPackageDraftKey(next.draft.value)
              ) {
                journal.current.value = local.value;
                journal.current.revision = local.baseRevision;
                if (preferSaved.current || next.draft.preparedIntentId) {
                  setRetainedValue(local.value);
                } else {
                  wanted.current = local.value;
                  setValue(local.value);
                  if (local.baseRevision !== next.draft.revision) {
                    setRetainedValue(local.value);
                    conflict.current = true;
                    setConflicted(true);
                    setError(
                      "A local package draft and the saved package differ. Your inputs are kept. Reload to review the saved package.",
                    );
                  }
                }
              } else if (local) {
                clearStudioPackageLocalDraft(
                  journal.current.scope,
                  next.draft.value,
                );
              }
            } catch {
              setError(
                "The local package copy could not be read. It has been kept.",
              );
            }
          }
          preferSaved.current = false;
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "The package could not be loaded.",
          );
      }
    };
    if (!controller.signal.aborted) void load(true);
    return () => {
      controller.abort();
      serial.current++;
      clearTimeout(timer);
      lifetime?.removeEventListener("abort", retire);
    };
  }, [endpoint, lifetime, attempt, actorId]);
  useEffect(() => {
    if (!actorId) return;
    const own = journal.current;
    return registerStudioPresentation(actorId, () => {
      if (!own.scope || !own.value || own.durable) return true;
      try {
        writeStudioPackageLocalDraft(own.scope, own.revision, own.value);
        own.durable = true;
        return true;
      } catch {
        return false;
      }
    });
  }, [actorId, quoteId, lifetime, attempt]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
        if (journal.current.value && !journal.current.durable) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      click = (event: MouseEvent) => {
        const link = (event.target as Element | null)?.closest?.("a");
        if (
          !link ||
          link.hasAttribute("download") ||
          link.target === "_blank" ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        if (journal.current.value && !journal.current.durable) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setError(
            "The latest inputs could not be stored on this device. Keep this page open and retry saving before leaving.",
          );
        }
      };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("click", click, true);
    };
  }, []);
  useEffect(() => {
    if (
      saving ||
      conflicted ||
      !state?.document ||
      ["ready", "failed", "unavailable"].includes(state.document.state)
    )
      return;
    const controller = new AbortController(),
      retire = () => controller.abort();
    lifetime?.addEventListener("abort", retire, { once: true });
    if (lifetime?.aborted) retire();
    const documentId = state.draft.documentId,
      readRevision = state.draft.revision,
      timer = setTimeout(() => {
        void apiJson<{ package: StudioPackageState }>(`${endpoint}?status=1`, {
          signal: controller.signal,
        })
          .then((response) => {
            if (
              controller.signal.aborted ||
              pump.current ||
              pending.current ||
              current.current?.draft.revision !== readRevision ||
              current.current?.draft.documentId !== documentId
            )
              return;
            const server = response.package;
            if (
              server.draft.revision !== readRevision ||
              studioPackageDraftKey(server.draft.value) !==
                studioPackageDraftKey(current.current.draft.value)
            ) {
              const dirty =
                studioPackageDraftKey(wanted.current) !==
                studioPackageDraftKey(current.current.draft.value);
              if (dirty) {
                conflict.current = true;
                setConflicted(true);
                setError(
                  "This package changed in another window. Your unsaved inputs are kept here. Reload to review the saved package.",
                );
                return;
              }
              wanted.current = server.draft.value;
              setValue(server.draft.value);
            }
            const next = {
              ...response.package,
              files: current.current?.files ?? [],
              enquiryFiles: current.current?.enquiryFiles ?? [],
              filesHasMore: current.current?.filesHasMore,
              filesOffset: current.current?.filesOffset,
            };
            current.current = next;
            setState(next);
          })
          .catch((e) => {
            if (!controller.signal.aborted)
              setError(
                e instanceof Error
                  ? e.message
                  : "Booklet status is unavailable.",
              );
          });
      }, 1500);
    return () => {
      controller.abort();
      clearTimeout(timer);
      lifetime?.removeEventListener("abort", retire);
    };
  }, [state, saving, conflicted, endpoint, lifetime]);
  async function persist(next: StudioPackageDraftValue) {
    if (
      activeQuote.current !== quoteId ||
      activeActor.current !== actorId ||
      lifetime?.aborted ||
      !current.current ||
      abort.current?.signal.aborted
    )
      return;
    if (conflict.current)
      throw Error(
        "This package changed in another window. Reload to review it; your unsaved inputs are kept here.",
      );
    if (
      !pump.current &&
      current.current.draft.revision > 0 &&
      studioPackageDraftKey(next) ===
        studioPackageDraftKey(current.current.draft.value)
    )
      return;
    pending.current = next;
    wanted.current = next;
    setSaving(true);
    setError(null);
    if (pump.current) return pump.current;
    const run = serial.current,
      signal = abort.current!.signal;
    const work = async () => {
      try {
        while (pending.current && !signal.aborted) {
          const target = pending.current;
          pending.current = null;
          const response = await apiJson<{ package: StudioPackageState }>(
            `${endpoint}?status=1`,
            {
              method: "PUT",
              body: JSON.stringify({
                revision: current.current!.draft.revision,
                value: target,
              }),
              signal,
            },
          );
          if (signal.aborted || run !== serial.current) return;
          const nextState = {
            ...response.package,
            files: current.current!.files,
            enquiryFiles: current.current!.enquiryFiles,
            filesHasMore: current.current!.filesHasMore,
            filesOffset: current.current!.filesOffset,
          };
          current.current = nextState;
          if (journal.current.scope) {
            try {
              clearStudioPackageLocalDraft(journal.current.scope, target);
              if (
                studioPackageDraftKey(journal.current.value) ===
                studioPackageDraftKey(target)
              ) {
                journal.current.value = null;
                journal.current.durable = true;
              }
            } catch {
              if (
                studioPackageDraftKey(journal.current.value) ===
                studioPackageDraftKey(target)
              ) {
                journal.current.value = null;
                journal.current.durable = true;
              }
            }
          }
          if (
            studioPackageDraftKey(wanted.current) ===
            studioPackageDraftKey(target)
          )
            setState(nextState);
        }
      } catch (e) {
        if (!signal.aborted) {
          if (
            e &&
            typeof e === "object" &&
            "status" in e &&
            e.status === 409 &&
            /changed|another window|prepared|locked/i.test(
              e instanceof Error ? e.message : "",
            )
          ) {
            conflict.current = true;
            setConflicted(true);
          }
          pending.current = null;
          setError(
            e instanceof Error ? e.message : "The package could not be saved.",
          );
          throw e;
        }
      } finally {
        if (run === serial.current) {
          pump.current = null;
          setSaving(false);
        }
      }
    };
    pump.current = work();
    return pump.current;
  }
  function change(next: StudioPackageDraftValue, immediate = false) {
    if (
      activeQuote.current !== quoteId ||
      activeActor.current !== actorId ||
      lifetime?.aborted
    )
      return;
    wanted.current = next;
    setValue(next);
    retainLocal(next);
    if (immediate) void persist(next).catch(() => {});
  }
  function retainLocal(next: StudioPackageDraftValue) {
    const own = journal.current;
    if (!own.scope || !current.current) return;
    own.value = structuredClone(next);
    own.revision = current.current.draft.revision;
    try {
      writeStudioPackageLocalDraft(own.scope, own.revision, next);
      own.durable = true;
    } catch {
      own.durable = false;
      setError(
        "The latest inputs are not stored on this device. Keep this page open until saving finishes.",
      );
    }
  }
  useEffect(() => {
    if (
      !value ||
      conflicted ||
      !state ||
      state.draft.preparedIntentId ||
      studioPackageDraftKey(value) ===
        studioPackageDraftKey(current.current?.draft.value)
    )
      return;
    const timer = setTimeout(() => void persist(value).catch(() => {}), 400);
    return () => clearTimeout(timer);
  }, [value, state, conflicted]);
  async function flush() {
    if (wanted.current) await persist(wanted.current);
    if (pump.current) await pump.current;
    return current.current;
  }
  async function action(kind: "prepare" | "cancel" | "send" | "retry") {
    if (
      activeQuote.current !== quoteId ||
      activeActor.current !== actorId ||
      lifetime?.aborted ||
      abort.current?.signal.aborted
    )
      return;
    const run = serial.current;
    try {
      setError(null);
      if (kind === "retry") {
        const saved = await flush(),
          draft = saved?.draft;
        if (!draft?.documentId) throw Error("No booklet is selected");
        const result = await apiJson<{
          document: StudioPackageState["document"] & {
            packageRevision?: number;
          };
        }>(
          `${endpoint}/document?documentId=${encodeURIComponent(draft.documentId)}&revision=${draft.revision}`,
          { method: "POST", signal: abort.current?.signal },
        );
        if (run !== serial.current) return;
        if (
          result.document?.documentId !== draft.documentId ||
          result.document?.packageRevision !== draft.revision
        )
          throw Error(
            "The booklet selection changed. Reload its current package.",
          );
        if (current.current?.draft.revision === draft.revision) {
          const next = { ...current.current, document: result.document };
          current.current = next;
          setState(next);
        }
        return;
      }
      actionPending.current = true;
      const saved = kind === "prepare" ? await flush() : current.current;
      if (!saved) throw Error("The package is unavailable");
      await apiJson(`${endpoint}/${kind}`, {
        method: "POST",
        body: JSON.stringify({ revision: saved.draft.revision }),
        signal: abort.current?.signal,
      });
      if (run !== serial.current) return;
      preferSaved.current = true;
      setAttempt((n) => n + 1);
    } catch (e) {
      if (run === serial.current)
        setError(
          e instanceof Error
            ? e.message
            : "The package action could not finish.",
        );
    } finally {
      if (run === serial.current) actionPending.current = false;
    }
  }
  function added(file: StudioPackageState["files"][number]) {
    if (
      activeQuote.current !== quoteId ||
      activeActor.current !== actorId ||
      lifetime?.aborted ||
      abort.current?.signal.aborted ||
      !current.current
    )
      return;
    const next = {
      ...current.current,
      files: [file, ...current.current.files.filter((f) => f.id !== file.id)],
    };
    current.current = next;
    setState(next);
  }
  function attachFile(file: StudioPackageState["files"][number]) {
    if (
      activeQuote.current !== quoteId ||
      activeActor.current !== actorId ||
      lifetime?.aborted ||
      abort.current?.signal.aborted ||
      !current.current
    )
      return;
    added(file);
    if (current.current.draft.preparedIntentId || actionPending.current) {
      setError(
        "The file is saved. Edit the prepared package before including it.",
      );
      return;
    }
    const latest = wanted.current ?? current.current.draft.value;
    if (latest.renderFileIds.includes(file.id)) return "rendered" as const;
    if (!latest.fileIds.includes(file.id))
      change({ ...latest, fileIds: [...latest.fileIds, file.id] }, true);
    return "attached" as const;
  }
  async function loadMore() {
    if (
      activeQuote.current !== quoteId ||
      activeActor.current !== actorId ||
      lifetime?.aborted ||
      !current.current
    )
      return;
    const own = abort.current,
      run = serial.current;
    try {
      const offset = (current.current.filesOffset ?? 0) + 100;
      const result = await apiJson<{
        page: {
          files: StudioPackageState["files"];
          hasMore: boolean;
          offset: number;
        };
      }>(`${endpoint}/assets?offset=${offset}`, {
        signal: abort.current?.signal,
      });
      if (own?.signal.aborted || run !== serial.current || !current.current)
        return;
      const files = [
          ...current.current.files,
          ...result.page.files.filter(
            (file) => !current.current!.files.some((old) => old.id === file.id),
          ),
        ],
        next = {
          ...current.current,
          files,
          filesHasMore: result.page.hasMore,
          filesOffset: offset,
        };
      current.current = next;
      setState(next);
    } catch (e) {
      if (run === serial.current)
        setError(
          e instanceof Error
            ? e.message
            : "More project files could not be loaded.",
        );
    }
  }
  return {
    state,
    value,
    saving,
    error,
    endpoint,
    change,
    action,
    added,
    attachFile,
    loadMore,
    conflicted,
    dirty:
      !!value &&
      studioPackageDraftKey(value) !==
        studioPackageDraftKey(current.current?.draft.value),
    retainedValue,
    reload: () => {
      if (
        wanted.current &&
        current.current &&
        studioPackageDraftKey(wanted.current) !==
          studioPackageDraftKey(current.current.draft.value)
      )
        setRetainedValue(structuredClone(wanted.current));
      preferSaved.current = !!current.current;
      setAttempt((n) => n + 1);
    },
    restoreRetained: () => {
      if (!retainedValue || !current.current) return;
      if (current.current.draft.preparedIntentId) {
        setError("Edit the prepared package before restoring previous inputs.");
        return;
      }
      const next = structuredClone(retainedValue);
      wanted.current = next;
      setValue(next);
      retainLocal(next);
      void persist(next)
        .then(() => setRetainedValue(null))
        .catch(() => {});
    },
    discardRetained: () => {
      if (!retainedValue) return;
      try {
        if (journal.current.scope)
          clearStudioPackageLocalDraft(journal.current.scope, retainedValue);
        journal.current.value = null;
        journal.current.durable = true;
        setRetainedValue(null);
      } catch {
        setError(
          "The previous local copy could not be removed. It has been kept.",
        );
      }
    },
    retrySave: () => {
      if (wanted.current) void persist(wanted.current).catch(() => {});
    },
  };
}
