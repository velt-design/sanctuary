export const ENQUIRY_DRAFT_KEY = 'sanctuary.enquiry-drafts.v1';
export const ENQUIRY_DRAFT_MAX_AGE = 24 * 60 * 60 * 1000;
const MAX_CONTEXTS = 10;
export type DraftFields = Record<string, string[]>;
export type EnquiryDraft = {
  scope: string; updated: number; fields: DraftFields; meta: Record<string, string>;
  fileNames: string[]; fileRevision: string;
};
const memory = new Map<string, EnquiryDraft>();

function valid(value: unknown): value is EnquiryDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as EnquiryDraft;
  return typeof v.scope === 'string' && v.scope.length < 4096 && Number.isFinite(v.updated)
    && Date.now() - v.updated >= 0 && Date.now() - v.updated < ENQUIRY_DRAFT_MAX_AGE
    && !!v.fields && typeof v.fields === 'object' && !Array.isArray(v.fields)
    && Object.keys(v.fields).length <= 60 && Object.values(v.fields).every(values => Array.isArray(values) && values.length <= 20 && values.every(x => typeof x === 'string' && x.length <= 10000))
    && Object.values(v.fields).flat().reduce((total, text) => total + text.length, 0) <= 32768
    && !!v.meta && typeof v.meta === 'object' && !Array.isArray(v.meta)
    && Object.keys(v.meta).length <= 10 && Object.values(v.meta).every(x => typeof x === 'string' && x.length < 500)
    && Array.isArray(v.fileNames) && v.fileNames.length <= 8 && v.fileNames.every(x => typeof x === 'string' && x.length < 256)
    && typeof v.fileRevision === 'string' && v.fileRevision.length < 100;
}
function allDrafts(): EnquiryDraft[] {
  let stored: unknown;
  let available = false;
  try { stored = JSON.parse(localStorage.getItem(ENQUIRY_DRAFT_KEY) ?? '[]'); available = true; } catch { /* Memory fallback. */ }
  const drafts = new Map<string, EnquiryDraft>();
  if (Array.isArray(stored)) stored.slice(-MAX_CONTEXTS).filter(valid).forEach(draft => drafts.set(draft.scope, draft));
  if (!available) for (const draft of memory.values()) if (valid(draft)) drafts.set(draft.scope, draft);
  return Array.from(drafts.values()).sort((a, b) => a.updated - b.updated).slice(-MAX_CONTEXTS);
}
function write(drafts: EnquiryDraft[]): boolean {
  memory.clear(); drafts.forEach(draft => memory.set(draft.scope, draft));
  try { localStorage.setItem(ENQUIRY_DRAFT_KEY, JSON.stringify(drafts)); return true; } catch { return false; }
}
export function readEnquiryDraft(scope: string): EnquiryDraft | null {
  const drafts = allDrafts(); write(drafts);
  return drafts.find(draft => draft.scope === scope) ?? null;
}
export function saveEnquiryDraft(draft: EnquiryDraft): boolean {
  if (!valid(draft)) return false;
  return write([...allDrafts().filter(item => item.scope !== draft.scope), draft].slice(-MAX_CONTEXTS));
}
export function removeEnquiryDraft(scope: string) { write(allDrafts().filter(item => item.scope !== scope)); }
export function activeEnquiryDraftFiles(): Map<string, string> {
  return new Map(allDrafts().filter(draft => draft.fileNames.length).map(draft => [draft.scope, draft.fileRevision]));
}

/** Only visible enquiry fields are admitted; attribution, tokens, price and honeypot are never drafts. */
export function captureDraftFields(form: HTMLFormElement, names: readonly string[]): DraftFields {
  const fields: DraftFields = Object.create(null);
  for (const name of names) {
    const controls = Array.from(form.elements).filter((el): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && el.name === name && el.type !== 'hidden' && el.type !== 'file');
    if (!controls.length) continue;
    fields[name] = controls.filter(el => !(el instanceof HTMLInputElement) || !['radio', 'checkbox'].includes(el.type) || el.checked).map(el => el.value.slice(0, 10000));
  }
  return fields;
}

export function restoreDraftFields(form: HTMLFormElement, fields: DraftFields): DraftFields {
  const remaining = { ...fields };
  for (const [name, values] of Object.entries(fields)) {
    const controls = Array.from(form.elements).filter((el): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && el.name === name && el.type !== 'hidden' && el.type !== 'file');
    if (!controls.length) continue;
    for (const el of controls) {
      if (el instanceof HTMLInputElement && ['radio', 'checkbox'].includes(el.type)) el.checked = values.includes(el.value);
      else if (el instanceof HTMLSelectElement || !el.value || el.value === el.defaultValue) el.value = values[0] ?? '';
    }
    delete remaining[name];
  }
  return remaining;
}
