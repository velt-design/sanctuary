import { getLocalFirstStoreOwner,flushLocalFirstStore } from '@/lib/localFirst/store';

type Participant = {
  actorId: string; epoch: number; attached: boolean; held: boolean;
  flush: () => Promise<boolean>; changed: () => void;
  release: (() => void) | null; acquiring: Promise<boolean> | null; settled: Promise<unknown> | null;
};
let epoch = 0;
const participants = new Set<Participant>();
const frozen = new Set<string>();
const lockName = (actorId: string) => `sanctuary-studio-session:${encodeURIComponent(actorId)}`;
const locks = () => typeof navigator !== 'undefined' ? navigator.locks : undefined;
const current = (p: Participant) => p.epoch === epoch && getLocalFirstStoreOwner() === p.actorId;
const notify = (actorId: string) => { for (const p of participants) if (p.actorId === actorId) p.changed(); };
async function bounded<T>(operation: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([operation, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Error(message)), 5000);
  })]).finally(() => clearTimeout(timer));
}

/** Auth identity transitions invalidate continuations even for A -> null -> A. */
export function invalidateStudioLifecycle() {
  epoch++;
  for (const p of participants) { p.release?.(); p.held = false; p.changed(); }
  participants.clear();
}

async function acquire(p: Participant): Promise<boolean> {
  if (!current(p) || !p.attached || frozen.has(p.actorId) || !locks()?.request) return false;
  if (p.held) return true;
  if (p.acquiring) return p.acquiring;
  p.acquiring = new Promise<boolean>(resolve => {
    p.settled = locks()!.request(lockName(p.actorId), { mode: 'shared' }, async lock => {
      if (!lock || !current(p) || !p.attached || frozen.has(p.actorId)) { resolve(false); return; }
      p.held = true;
      const held = new Promise<void>(release => { p.release = release; });
      resolve(true); p.changed();
      await held;
      p.held = false; p.release = null;
    }).catch(() => resolve(false));
  }).finally(() => { p.acquiring = null; });
  return p.acquiring;
}

export type StudioLifecycleRegistration = {
  ready: Promise<boolean>; valid: () => boolean; allowed: () => boolean; detach: () => void;
};

/** A participant remains registered after unmount until accepted edits are durable. */
export function registerStudioLifecycle(actorId: string, flush: () => Promise<boolean>, changed: () => void): StudioLifecycleRegistration {
  const p: Participant = { actorId, epoch, attached: true, held: false, flush, changed, release: null, acquiring: null, settled: null };
  participants.add(p);
  return {
    ready: acquire(p), valid: () => current(p),
    allowed: () => current(p) && p.held && !frozen.has(actorId),
    detach: () => {
      p.attached = false;
      void flush().then(durable => {
        if (durable || !current(p)) { p.release?.(); participants.delete(p); }
      }).catch(() => { /* Keep the failed participant: sign-out must not claim preservation. */ });
    },
  };
}

/** Raw authoring remains with its existing sessionStorage owner; this joins
 * that owner's synchronous snapshot to the same local navigation/sign-out drain. */
export function registerStudioPresentation(actorId:string,flush:()=>boolean) {
 const participant=registerStudioLifecycle(actorId,async()=>flush(),()=>{});
 return()=>participant.detach();
}

export type StudioRetentionSummary = { records: number; dirty: number; requests: number; confirmations: number; recovery: number };

type Prepared = { state: 'ready'; summary: StudioRetentionSummary; valid: () => boolean; release: () => void };
export type StudioSignOutPreparation = Prepared | { state: 'blocked'; message: string };

/** Fence new actions synchronously, without invalidating the owner that must
 * drain already accepted local writes. No server save or cross-tab sign-out. */
export function prepareStudioNavigation(actorId:string) {
 const capturedEpoch=epoch;
 let released=false;
 let status:'pending'|'ready'|'failed'='pending';
 const valid=()=>epoch===capturedEpoch&&getLocalFirstStoreOwner()===actorId;
 const owned=!frozen.has(actorId);
 const release=()=>{
  if(released)return;released=true;
  if(!owned)return;
  frozen.delete(actorId);
  for(const p of participants)if(p.actorId===actorId&&p.attached)void acquire(p).then(()=>p.changed());
  notify(actorId);
 };
 if(owned){frozen.add(actorId);notify(actorId);}
 const ready=(async()=>{
  if(!owned)throw Error('Design changes are already being checked. Please try again.');
  const local=[...participants].filter(p=>p.actorId===actorId&&p.epoch===capturedEpoch);
  const results=await bounded(Promise.all([flushLocalFirstStore(actorId).then(()=>true),...local.map(p=>p.flush())]),'Design changes are still being stored locally. Please try again.');
  if(!valid())throw Error('The signed-in owner changed. Your retained work has not been removed.');
  if(results.some(v=>!v))throw Error('The latest design changes could not be stored on this device. Resolve the recovery message before leaving.');
 })().then(()=>{status='ready' as const;},error=>{status='failed' as const;throw error;});
 // A pagehide caller cannot await. Attach a handler immediately, while keeping
 // the rejection available to its ordinary navigation/re-entry owner.
 void ready.catch(()=>{});
 return{ready,valid,release,fenced:()=>owned&&!released,status:()=>status};
}

/** Freeze locally, flush accepted edits, then exclude other studio tabs through auth teardown. */
export async function prepareStudioLifecycleSignOut(actorId: string, sessionCurrent: () => boolean, inventoryStudioRetention:(actorId:string,stillCurrent:()=>boolean)=>Promise<StudioRetentionSummary>): Promise<StudioSignOutPreparation> {
  if (frozen.has(actorId)) return { state: 'blocked', message: 'Sign-out is already being checked.' };
  const capturedEpoch = epoch;
  const valid = () => epoch === capturedEpoch && sessionCurrent();
  let releaseExclusive: (() => void) | null = null;
  let released = false;
  const release = () => {
    if (released) return;
    released = true; releaseExclusive?.(); frozen.delete(actorId);
    for (const p of participants) if (p.actorId === actorId && p.attached) void acquire(p).then(() => p.changed());
    notify(actorId);
  };
  frozen.add(actorId); notify(actorId);
  try {
    const local = [...participants].filter(p => p.actorId === actorId && p.epoch === capturedEpoch);
    if (!locks()?.request) {
      const summary = await bounded(inventoryStudioRetention(actorId, valid), 'Retained design work could not be checked in time. Stay signed in and try again.');
      if (local.length || summary.records) throw Error('This browser cannot protect retained design work across tabs. Use a browser with Web Locks support.');
      return { state: 'ready', summary, valid, release };
    }
    const flushed = await bounded(Promise.all(local.map(p => p.flush())), 'Design changes are still being stored locally. Stay signed in and try again shortly.');
    if (!valid()) throw Error('The signed-in session changed. Sign-out was stopped.');
    if (flushed.some(result => !result)) throw Error('The latest design changes could not be stored on this device. Keep the editor open and resolve its save message before signing out.');
    const heldLocal = local.filter(p => p.held);
    for (const p of heldLocal) { p.release?.(); p.held = false; }
    // Wait for our shared lock callbacks to return before the non-blocking exclusive attempt.
    await bounded(Promise.all(heldLocal.map(p => p.settled)), 'Browser design coordination did not finish. Stay signed in and try again.');
    const exclusive = await bounded(new Promise<boolean>(resolve => {
      void locks()!.request(lockName(actorId), { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock || released || !valid()) { resolve(false); return; }
        const held = new Promise<void>(done => { releaseExclusive = done; });
        resolve(true); await held;
      }).catch(() => resolve(false));
    }), 'Browser design coordination did not finish. Stay signed in and try again.');
    if (!exclusive) throw Error('Another tab has an open design editor or creation action. Close that tab after its local changes are stored, then sign out here.');
    if (!valid()) throw Error('The signed-in session changed. Sign-out was stopped.');
    const summary = await bounded(inventoryStudioRetention(actorId, valid), 'Retained design work could not be checked in time. Stay signed in and try again.');
    if (!valid()) throw Error('The signed-in session changed. Sign-out was stopped.');
    return { state: 'ready', summary, valid, release };
  } catch (error) {
    release();
    return { state: 'blocked', message: error instanceof Error ? error.message : 'Retained design work could not be verified. Stay signed in and try again.' };
  }
}
