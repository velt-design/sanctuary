'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { captureDraftFields, readEnquiryDraft, removeEnquiryDraft, restoreDraftFields, saveEnquiryDraft, type DraftFields, type EnquiryDraft } from '../../lib/enquiryDraft';
import { pruneDraftFiles, readDraftFiles, removeDraftFiles, saveDraftFiles } from '../../lib/enquiryDraftFiles';

export const CONTACT_DRAFT_FIELDS = ['name', 'suburb', 'email', 'phone', 'message', 'company', 'projectRole', 'projectStage', 'widthM', 'depthM', 'heightM', 'style', 'roofMaterials', 'addOns', 'preferredTiming', 'budgetPreference', 'budgetHint'] as const;
const FILE_WARNING = 'Your browser could not save these attachments for a later visit. Keep this page open to send them, or add them again when you return.';
const TEXT_WARNING = 'Your browser could not save this draft for a later visit. Keep this page open to finish your enquiry.';

type Options = {
  scope: string; fields: readonly string[]; meta: Record<string, string>;
  onRestoreMeta: (meta: Record<string, string>, fields: DraftFields) => void;
  onRestoreFiles: (files: File[]) => void;
  legacySessionKey?: string;
};

/** Synchronous text writes cover an immediate Back, tab hide or navigation after the last edit. */
export function useEnquiryDraft(options: Options) {
  const formRef = useRef<HTMLFormElement>(null);
  const optionsRef = useRef(options); optionsRef.current = options;
  const current = useRef<EnquiryDraft | null>(null);
  const pendingFields = useRef<DraftFields>({});
  const stopped = useRef(false);
  const textSaved = useRef(true);
  const lastForm = useRef<HTMLFormElement | null>(null);
  const mountedScope = useRef(options.scope);
  const [hasDraft, setHasDraft] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [restoredFields, setRestoredFields] = useState<DraftFields>({});
  const [resetVersion, setResetVersion] = useState(0);

  const save = (meta?: Record<string, string>) => {
    if (stopped.current || !formRef.current) return;
    const opts = optionsRef.current;
    const previous = current.current;
    const draft: EnquiryDraft = {
      scope: opts.scope, updated: Date.now(),
      // Conditional controls can be temporarily absent while a pathway is restored.
      fields: { ...previous?.fields, ...pendingFields.current, ...captureDraftFields(formRef.current, opts.fields) },
      meta: { ...opts.meta, ...meta }, fileNames: previous?.fileNames ?? [], fileRevision: previous?.fileRevision ?? '',
    };
    current.current = draft;
    const persisted = saveEnquiryDraft(draft);
    textSaved.current = persisted;
    setHasDraft(true);
    if (!persisted) setWarning(TEXT_WARNING);
  };
  const saveFiles = (files: File[]) => {
    save();
    const draft = current.current;
    if (!draft) return;
    const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    current.current = { ...draft, fileNames: files.map(file => file.name), fileRevision: revision };
    textSaved.current = saveEnquiryDraft(current.current);
    void saveDraftFiles(optionsRef.current.scope, revision, files).then(saved => {
      if (current.current?.fileRevision === revision) setWarning(!textSaved.current ? TEXT_WARNING : saved || !files.length ? null : FILE_WARNING);
    });
  };
  const clear = () => {
    stopped.current = true;
    current.current = null; pendingFields.current = {};
    removeEnquiryDraft(optionsRef.current.scope);
    void removeDraftFiles(optionsRef.current.scope);
    setHasDraft(false); setWarning(null);
  };
  const discard = () => {
    clear(); formRef.current?.reset();
    optionsRef.current.onRestoreFiles([]);
    optionsRef.current.onRestoreMeta({}, {});
    setRestoredFields({});
    setResetVersion(version => version + 1);
    stopped.current = false;
    void pruneDraftFiles().catch(() => {});
  };

  useLayoutEffect(() => {
    stopped.current = false;
    void pruneDraftFiles().catch(() => {});
    if (mountedScope.current !== options.scope) {
      mountedScope.current = options.scope;
      formRef.current?.reset(); pendingFields.current = {};
      setRestoredFields({}); setHasDraft(false); setWarning(null);
      setResetVersion(version => version + 1);
      optionsRef.current.onRestoreFiles([]);
      optionsRef.current.onRestoreMeta({}, {});
    }
    let draft = readEnquiryDraft(options.scope);
    if (options.legacySessionKey) {
      try {
        const values: unknown = JSON.parse(sessionStorage.getItem(options.legacySessionKey) ?? 'null');
        if (!draft && values && typeof values === 'object' && !Array.isArray(values)) {
          const fields: DraftFields = {};
          for (const name of ['name', 'suburb', 'email', 'phone', 'message']) {
            const value = (values as Record<string, unknown>)[name];
            if (typeof value === 'string' && value.length <= 10000) fields[name] = [value];
          }
          if (Object.keys(fields).length) {
            draft = { scope: options.scope, updated: Date.now(), fields, meta: options.meta, fileNames: [], fileRevision: '' };
            saveEnquiryDraft(draft);
          }
        }
        // The previous writer had no context or timestamp; consume it once, never share it again.
        sessionStorage.removeItem(options.legacySessionKey);
      } catch { /* Browser storage is optional. */ }
    }
    current.current = draft;
    if (!draft) return;
    pendingFields.current = { ...draft.fields };
    setRestoredFields(draft.fields); setHasDraft(true);
    optionsRef.current.onRestoreMeta(draft.meta, draft.fields);
    let cancelled = false;
    if (draft.fileNames.length) void readDraftFiles(draft.scope, draft.fileRevision).then(files => {
      if (cancelled || current.current?.fileRevision !== draft.fileRevision) return;
      if (files) optionsRef.current.onRestoreFiles(files);
      else setWarning(`Please add these attachments again: ${draft.fileNames.join(', ')}. Your enquiry details have been restored.`);
    });
    return () => { cancelled = true; };
  }, [options.scope]);

  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) { lastForm.current = null; return; }
    if (lastForm.current !== form) { stopped.current = false; lastForm.current = form; }
    pendingFields.current = restoreDraftFields(form, pendingFields.current);
    const edit = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'file') return;
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (!optionsRef.current.fields.includes(target.name)) return;
      delete pendingFields.current[target.name];
      save();
    };
    const hide = () => { if (hasDraft) save(); };
    form.addEventListener('input', edit); form.addEventListener('change', edit);
    window.addEventListener('pagehide', hide); document.addEventListener('visibilitychange', hide);
    return () => {
      form.removeEventListener('input', edit); form.removeEventListener('change', edit);
      window.removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', hide);
    };
  });
  return { formRef, save, saveFiles, clear, discard, hasDraft, warning, restoredFields, resetVersion };
}
