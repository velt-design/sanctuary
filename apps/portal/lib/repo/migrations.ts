import type { Quote } from '@/lib/types/quote';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { readJson, writeJson } from './storage';
import { PORTAL_DEFAULT_ACCENT_HEX } from '@/lib/theme/presets';

const QUOTES_KEY = 'sp_quotes_v1';
const INSTALLERS_KEY = 'sp_installers_v1';
const SCHEDULE_ITEMS_KEY = 'sp_schedule_items_v1';

function readQuotes(): Quote[] {
  const raw = readJson<Quote[]>(QUOTES_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

function readInstallers(): Installer[] {
  const raw = readJson<Installer[]>(INSTALLERS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

function writeInstallers(installers: Installer[]): void {
  writeJson<Installer[]>(INSTALLERS_KEY, installers);
}

function readScheduleItems(): ScheduleItem[] {
  const raw = readJson<ScheduleItem[]>(SCHEDULE_ITEMS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

function writeScheduleItems(items: ScheduleItem[]): void {
  writeJson<ScheduleItem[]>(SCHEDULE_ITEMS_KEY, items);
}

export function ensureQuotesMigration(): void {
  if (typeof window === 'undefined') return;

  const quotes = readQuotes();
  if (!quotes.length) return;

  let changed = false;
  const now = nowIso();

  const parseSeq = (value: unknown): { year: number; seq: number } | null => {
    if (typeof value !== 'string') return null;
    const m = /^Q-(\d{4})-(\d{4,})$/i.exec(value.trim());
    if (!m) return null;
    const year = Number(m[1]);
    const seq = Number(m[2]);
    if (!Number.isFinite(year) || !Number.isFinite(seq)) return null;
    return { year, seq };
  };

  const maxSeqByYear = new Map<number, number>();
  for (const q of quotes) {
    const parsed = parseSeq((q as any).quoteNumber);
    if (!parsed) continue;
    maxSeqByYear.set(parsed.year, Math.max(maxSeqByYear.get(parsed.year) ?? 0, parsed.seq));
  }

  const ensureYear = (createdAt: string): number => {
    const d = new Date(createdAt);
    const y = Number.isFinite(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
    return y;
  };

  const nextSeqForYear = (year: number): number => {
    const next = (maxSeqByYear.get(year) ?? 0) + 1;
    maxSeqByYear.set(year, next);
    return next;
  };

  const numberForYear = (year: number): string => `Q-${year}-${String(nextSeqForYear(year)).padStart(4, '0')}`;

  const seriesQuoteNumber = new Map<string, string>();
  for (const q of quotes) {
    const rootId =
      typeof (q as any).rootQuoteId === 'string' && (q as any).rootQuoteId.trim()
        ? (q as any).rootQuoteId.trim()
        : typeof (q as any).id === 'string'
          ? (q as any).id
          : '';
    if (!rootId) continue;
    const n = typeof (q as any).quoteNumber === 'string' ? (q as any).quoteNumber.trim() : '';
    if (n) seriesQuoteNumber.set(rootId, n);
  }

  const seriesNeedsNumber: Array<{ rootId: string; createdAt: string }> = [];
  for (const q of quotes) {
    const rootId =
      typeof (q as any).rootQuoteId === 'string' && (q as any).rootQuoteId.trim()
        ? (q as any).rootQuoteId.trim()
        : typeof (q as any).id === 'string'
          ? (q as any).id
          : '';
    if (!rootId) continue;
    if (seriesQuoteNumber.has(rootId)) continue;
    const createdAt = typeof (q as any).createdAt === 'string' && (q as any).createdAt ? (q as any).createdAt : now;
    seriesNeedsNumber.push({ rootId, createdAt });
  }

  seriesNeedsNumber.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.rootId.localeCompare(b.rootId));
  for (const s of seriesNeedsNumber) {
    if (seriesQuoteNumber.has(s.rootId)) continue;
    const year = ensureYear(s.createdAt);
    seriesQuoteNumber.set(s.rootId, numberForYear(year));
    changed = true;
  }

  const next = quotes.map((q) => {
    const nextQuote: Quote = { ...(q as Quote) };

    if (typeof nextQuote.id !== 'string' || !nextQuote.id.trim()) {
      nextQuote.id = newId('quo');
      changed = true;
    }
    if (typeof nextQuote.projectId !== 'string') {
      nextQuote.projectId = '';
      changed = true;
    }
    if (typeof nextQuote.rootQuoteId !== 'string' || !nextQuote.rootQuoteId.trim()) {
      nextQuote.rootQuoteId = nextQuote.id;
      changed = true;
    }
    if (typeof nextQuote.quoteNumber !== 'string' || !nextQuote.quoteNumber.trim()) {
      const seriesNumber = nextQuote.rootQuoteId ? seriesQuoteNumber.get(nextQuote.rootQuoteId) : undefined;
      if (seriesNumber) {
        (nextQuote as any).quoteNumber = seriesNumber;
        changed = true;
      }
    }
    if (typeof nextQuote.version !== 'number' || !Number.isFinite(nextQuote.version) || nextQuote.version < 1) {
      nextQuote.version = 1;
      changed = true;
    }
    if (typeof nextQuote.createdAt !== 'string' || !nextQuote.createdAt) {
      nextQuote.createdAt = now;
      changed = true;
    }
    if (typeof nextQuote.updatedAt !== 'string' || !nextQuote.updatedAt) {
      nextQuote.updatedAt = nextQuote.createdAt;
      changed = true;
    }
    {
      const s = typeof nextQuote.status === 'string' ? nextQuote.status : 'draft';
      const isKnown = s === 'draft' || s === 'sent' || s === 'paid';
      if (!isKnown) {
        nextQuote.status = 'draft';
        changed = true;
      }
    }

    if (typeof nextQuote.quoteNumber !== 'undefined' && typeof nextQuote.quoteNumber !== 'string') {
      delete (nextQuote as any).quoteNumber;
      changed = true;
    }

    if (!('customerTotalOverride' in nextQuote)) {
      (nextQuote as any).customerTotalOverride = null;
      changed = true;
    }
    if (
      nextQuote.customerTotalOverride !== null &&
      (typeof nextQuote.customerTotalOverride !== 'number' || !Number.isFinite(nextQuote.customerTotalOverride))
    ) {
      nextQuote.customerTotalOverride = null;
      changed = true;
    }

    if (!('notes' in nextQuote)) {
      (nextQuote as any).notes = null;
      changed = true;
    }
    if (typeof nextQuote.notes !== 'string' && nextQuote.notes !== null) {
      nextQuote.notes = null;
      changed = true;
    }

    return nextQuote;
  });

  if (changed) writeJson<Quote[]>(QUOTES_KEY, next);
}

const CREW_V2: Installer[] = [
  { id: 'crew_jayden', name: 'Jayden', color: PORTAL_DEFAULT_ACCENT_HEX, active: true, sortOrder: 1 },
  { id: 'crew_david', name: 'David', color: '#1f6f8b', active: true, sortOrder: 2 },
  { id: 'crew_alistair', name: 'Alistair', color: '#2a9d8f', active: true, sortOrder: 3 },
  { id: 'crew_eder', name: 'Eder', color: '#f4a261', active: true, sortOrder: 4 },
  { id: 'crew_jesse', name: 'Jesse', color: '#264653', active: true, sortOrder: 5 },
];

function isCrewV2Installed(installers: Installer[]): boolean {
  if (!installers.length) return false;
  const ids = new Set(installers.map((i) => i.id));
  return CREW_V2.every((c) => ids.has(c.id));
}

export function ensureSchedulingCrewsV2Migration(): { movedToUnscheduled: number; mapped: number; changed: boolean } {
  if (typeof window === 'undefined') return { movedToUnscheduled: 0, mapped: 0, changed: false };

  const existingInstallers = readInstallers();
  const existingItems = readScheduleItems();

  if (isCrewV2Installed(existingInstallers)) {
    // Still scrub schedule items that reference missing installers, so they don't "disappear".
    const validIds = new Set(CREW_V2.map((c) => c.id));
    const kept = existingItems.filter((i) => validIds.has(i.installerId));
    const movedToUnscheduled = existingItems.length - kept.length;
    if (movedToUnscheduled) writeScheduleItems(kept);
    return { movedToUnscheduled, mapped: 0, changed: Boolean(movedToUnscheduled) };
  }

  // If nothing exists yet, just seed the new crews.
  if (!existingInstallers.length) {
    writeInstallers(CREW_V2);
    return { movedToUnscheduled: 0, mapped: 0, changed: true };
  }

  // Build a best-effort mapping for legacy crews → v2 crews.
  const mapping = new Map<string, string>();
  const legacySorted = existingInstallers
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const legacyTop = legacySorted.slice(0, CREW_V2.length);
  for (let i = 0; i < legacyTop.length; i += 1) {
    mapping.set(legacyTop[i].id, CREW_V2[i].id);
  }

  // Always install the v2 crew set (deterministic IDs + names).
  const nextInstallers: Installer[] = CREW_V2.map((c) => {
    const idx = CREW_V2.findIndex((row) => row.id === c.id);
    const prevByOrder = legacyTop[idx] ?? null;
    const prevById = existingInstallers.find((i) => i.id === c.id) ?? null;
    const prev = prevById ?? prevByOrder;
    return prev ? { ...c, availableFrom: prev.availableFrom, active: prev.active } : c;
  });
  writeInstallers(nextInstallers);

  // Update schedule items to the new installer IDs, or unschedule if unmapped.
  const validIds = new Set(nextInstallers.map((c) => c.id));
  let mapped = 0;
  let movedToUnscheduled = 0;
  const nextItems: ScheduleItem[] = [];

  for (const item of existingItems) {
    const mappedInstallerId = mapping.get(item.installerId) ?? item.installerId;
    if (!validIds.has(mappedInstallerId)) {
      movedToUnscheduled += 1;
      continue;
    }
    if (mappedInstallerId !== item.installerId) mapped += 1;
    nextItems.push(mappedInstallerId === item.installerId ? item : { ...item, installerId: mappedInstallerId });
  }

  if (mapped || movedToUnscheduled) writeScheduleItems(nextItems);
  return { movedToUnscheduled, mapped, changed: true };
}
