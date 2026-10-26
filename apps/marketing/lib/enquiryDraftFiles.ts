import { activeEnquiryDraftFiles, ENQUIRY_DRAFT_MAX_AGE } from './enquiryDraft';
import { validateEnquiryAttachmentDescriptors } from './enquiryAttachmentPolicy';

type StoredFiles = { scope: string; revision: string; updated: number; files: { blob: Blob; name: string; type: string; modified: number }[] };
const memory = new Map<string, { revision: string; files: File[]; updated: number }>();
let database: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Storage unavailable')); return; }
    const request = indexedDB.open('sanctuary-enquiry-drafts-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'scope' });
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Storage unavailable'));
  }).catch(error => { database = undefined; throw error; });
  return database!;
}
async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode);
    const request = operation(tx.objectStore('files'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
export async function saveDraftFiles(scope: string, revision: string, files: File[]): Promise<boolean> {
  memory.delete(scope);
  memory.set(scope, { revision, files, updated: Date.now() });
  let bytes = 0;
  for (const [key, value] of Array.from(memory).reverse()) {
    bytes += value.files.reduce((sum, file) => sum + file.size, 0);
    if (bytes > 60 * 1024 * 1024 || Date.now() - value.updated >= ENQUIRY_DRAFT_MAX_AGE) memory.delete(key);
  }
  try {
    if (!files.length) { await transaction('readwrite', store => store.delete(scope)); return true; }
    await transaction('readwrite', store => store.put({ scope, revision, updated: Date.now(), files: files.map(file => ({ blob: file, name: file.name, type: file.type, modified: file.lastModified })) } satisfies StoredFiles));
    await pruneDraftFiles();
    return true;
  } catch { return false; }
}
export async function pruneDraftFiles() {
  const rows = await transaction('readonly', store => store.getAll()) as StoredFiles[];
  const active = activeEnquiryDraftFiles();
  let bytes = 0;
  for (const row of rows.sort((a, b) => b.updated - a.updated)) {
    const size = row.files.reduce((sum, file) => sum + file.blob.size, 0);
    const valid = active.get(row.scope) === row.revision && Date.now() - row.updated < ENQUIRY_DRAFT_MAX_AGE;
    if (valid) bytes += size;
    if (!valid || bytes > 60 * 1024 * 1024) {
      // A new file selection may have committed after this pruning snapshot.
      await transaction('readwrite', store => {
        const request = store.get(row.scope);
        request.onsuccess = () => { if (request.result?.revision === row.revision) store.delete(row.scope); };
        return request;
      });
      if (memory.get(row.scope)?.revision === row.revision) memory.delete(row.scope);
    }
  }
}
export async function readDraftFiles(scope: string, revision: string): Promise<File[] | null> {
  if (memory.get(scope)?.revision === revision && Date.now() - memory.get(scope)!.updated < ENQUIRY_DRAFT_MAX_AGE) return memory.get(scope)!.files;
  try {
    await pruneDraftFiles();
    const row = await transaction('readonly', store => store.get(scope)) as StoredFiles | undefined;
    if (!row || row.revision !== revision || Date.now() - row.updated >= ENQUIRY_DRAFT_MAX_AGE) return null;
    const files = row.files.map(file => new File([file.blob], file.name, { type: file.type, lastModified: file.modified }));
    return validateEnquiryAttachmentDescriptors(files) ? null : files;
  } catch { return null; }
}
export async function removeDraftFiles(scope: string) {
  memory.delete(scope);
  try { await transaction('readwrite', store => store.delete(scope)); } catch { /* Storage is optional. */ }
}
