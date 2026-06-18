import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { normalizePipelineStageKey } from '../apps/portal/lib/projects/pipelineDefinition';
import {
  LEGACY_RUNNING_JOB_SOURCE_COLUMNS,
  emptyLegacySourceCells,
  inferLegacyGroupYear,
  isLegacyProjectRow,
  isLegacyYearDividerText,
  normalizeLegacyAddress,
  normalizeLegacyClientName,
  normalizeLegacyPhone,
  parseLegacyBoolean,
  parseLegacyExcelDateYmd,
  parseLegacyPositiveInt,
  parseLegacyStatusValue,
  toLegacyDisplayCells,
  type LegacyRunningJobDisplayCells,
  type LegacyRunningJobSourceCells,
} from '../apps/portal/lib/runningJobs/legacy';

const INCLUDED_STAGES = new Set(['SENT', 'DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID']);
const DEFAULT_WORKBOOK_PATH = path.resolve(process.cwd(), 'tmp/running-jobs-legacy/03-Running Job-List.xlsx');

type LiveMatchCandidate = {
  projectId: string;
  normalizedClientName: string | null;
  normalizedPhone: string | null;
  normalizedAddress: string | null;
};

type ParsedLegacyImportRow = {
  sourceRowNumber: number;
  rawCells: LegacyRunningJobSourceCells;
  displayCells: LegacyRunningJobDisplayCells;
  normalizedClientName: string | null;
  normalizedPhone: string | null;
  normalizedAddress: string | null;
  groupYear: number | null;
  sortDate: string | null;
  matchStatus: 'unmatched' | 'matched_live';
  matchedProjectId: string | null;
  matchMethod: string | null;
};

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleaned = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = cleaned.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = cleaned.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = cleaned.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadEnvFromRepo() {
  const cwd = process.cwd();
  loadEnvFile(path.resolve(cwd, '.env.local'));
  loadEnvFile(path.resolve(cwd, '.env'));
}

function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${name} is not set. Add it to .env.local or your shell env.`);
}

function readFlag(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function toYmdFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseExcelSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  const excelEpochUtc = Date.UTC(1899, 11, 30);
  return toYmdFromDate(new Date(excelEpochUtc + Math.round(serial) * 24 * 60 * 60 * 1000));
}

function worksheetCellDisplayText(cell: XLSX.CellObject | undefined): string | null {
  if (!cell) return null;
  const display = typeof cell.w === 'string' && cell.w.trim() ? cell.w : cell.v === undefined || cell.v === null ? '' : String(cell.v);
  const normalized = display.replace(/\u00a0/g, ' ').trim();
  return normalized || null;
}

function worksheetCellDateYmd(cell: XLSX.CellObject | undefined): string | null {
  if (!cell) return null;
  if (typeof cell.v === 'number') return parseExcelSerialDate(cell.v);
  if (cell.v instanceof Date) return toYmdFromDate(cell.v);
  return parseLegacyExcelDateYmd(worksheetCellDisplayText(cell));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function buildNameAddressKey(name: string | null, address: string | null): string | null {
  if (!name || !address) return null;
  return `${name}::${address}`;
}

function normalizeLegacyPipelineStatus(raw: unknown): string {
  const stage = normalizePipelineStageKey(typeof raw === 'string' ? raw : null);
  return stage ? stage.toUpperCase() : 'NEW';
}

function readSourceCells(sheet: XLSX.WorkSheet, rowNumber: number): LegacyRunningJobSourceCells {
  const cells = emptyLegacySourceCells();
  for (const column of LEGACY_RUNNING_JOB_SOURCE_COLUMNS) {
    cells[column] = worksheetCellDisplayText(sheet[`${column}${rowNumber}`]);
  }
  return cells;
}

function toDisplayCells(sheet: XLSX.WorkSheet, rowNumber: number, sourceCells: LegacyRunningJobSourceCells): LegacyRunningJobDisplayCells {
  const display = toLegacyDisplayCells(sourceCells);

  const depositDate = worksheetCellDateYmd(sheet[`E${rowNumber}`]);
  const estimatedStart = worksheetCellDateYmd(sheet[`H${rowNumber}`]);
  const finalPayment = worksheetCellDateYmd(sheet[`I${rowNumber}`]);
  const installDays = parseLegacyPositiveInt(sourceCells.N);

  if (depositDate) display.deposit_paid_date = depositDate;
  if (estimatedStart) display.estimated_start_date = estimatedStart;
  if (finalPayment) display.final_payment_date = finalPayment;
  if (installDays !== null) display.install_days = String(installDays);

  return display;
}

function parseWorkbook(filePath: string, requestedSheetName?: string | null): { sheetName: string; rows: ParsedLegacyImportRow[] } {
  const workbook = XLSX.readFile(filePath, { raw: true, cellDates: false, dense: false });
  const sheetName = requestedSheetName?.trim() || workbook.SheetNames[0] || '';
  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error(`Sheet '${requestedSheetName ?? ''}' was not found in ${path.basename(filePath)}.`);
  }

  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const rows: ParsedLegacyImportRow[] = [];

  let currentExplicitYear: number | null = null;

  for (let rowNumber = 12; rowNumber <= range.e.r + 1; rowNumber += 1) {
    const rawCells = readSourceCells(sheet, rowNumber);

    if (isLegacyYearDividerText(rawCells.A)) {
      currentExplicitYear = Number.parseInt(rawCells.A ?? '', 10);
      continue;
    }

    if (!isLegacyProjectRow(rowNumber, rawCells)) continue;

    const displayCells = toDisplayCells(sheet, rowNumber, rawCells);
    const estimatedStart = worksheetCellDateYmd(sheet[`H${rowNumber}`]);
    const finalPayment = worksheetCellDateYmd(sheet[`I${rowNumber}`]);
    const depositPaid = worksheetCellDateYmd(sheet[`E${rowNumber}`]);

    rows.push({
      sourceRowNumber: rowNumber,
      rawCells,
      displayCells,
      normalizedClientName: normalizeLegacyClientName(rawCells.A),
      normalizedPhone: normalizeLegacyPhone(rawCells.B),
      normalizedAddress: normalizeLegacyAddress(rawCells.C),
      groupYear: inferLegacyGroupYear({
        explicitYear: currentExplicitYear,
        estimatedStart,
        finalPayment,
        depositPaid,
      }),
      sortDate: estimatedStart,
      matchStatus: 'unmatched',
      matchedProjectId: null,
      matchMethod: null,
    });
  }

  return { sheetName, rows };
}

async function loadLiveMatchCandidates(supabase: any): Promise<LiveMatchCandidate[]> {
  const [projectsRes, scheduledJobsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, site_address, pipeline_stage, archived_at, contacts ( name, phone )')
      .is('archived_at', null),
    supabase.from('scheduled_jobs').select('job_id'),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (scheduledJobsRes.error) throw scheduledJobsRes.error;

  const scheduledProjectIds = new Set(
    (Array.isArray(scheduledJobsRes.data) ? scheduledJobsRes.data : [])
      .map((row: any) => (typeof row?.job_id === 'string' ? row.job_id : ''))
      .filter(Boolean),
  );

  return (Array.isArray(projectsRes.data) ? projectsRes.data : [])
    .map((row: any) => {
      const normalizedStage = normalizeLegacyPipelineStatus(row?.pipeline_stage);
      const id = typeof row?.id === 'string' ? row.id : '';
      if (!id) return null;
      if (!INCLUDED_STAGES.has(normalizedStage) && !scheduledProjectIds.has(id)) return null;

      const contact = Array.isArray(row?.contacts) ? row.contacts[0] ?? null : row?.contacts ?? null;
      const name = typeof contact?.name === 'string' && contact.name.trim() ? contact.name : typeof row?.name === 'string' ? row.name : null;
      const phone = typeof contact?.phone === 'string' ? contact.phone : null;
      const address = typeof row?.site_address === 'string' ? row.site_address : null;

      return {
        projectId: id,
        normalizedClientName: normalizeLegacyClientName(name),
        normalizedPhone: normalizeLegacyPhone(phone),
        normalizedAddress: normalizeLegacyAddress(address),
      } satisfies LiveMatchCandidate;
    })
    .filter((candidate): candidate is LiveMatchCandidate => Boolean(candidate));
}

function matchLegacyRows(rows: ParsedLegacyImportRow[], candidates: LiveMatchCandidate[]): ParsedLegacyImportRow[] {
  const byPhone = new Map<string, LiveMatchCandidate[]>();
  const byNameAddress = new Map<string, LiveMatchCandidate[]>();

  for (const candidate of candidates) {
    if (candidate.normalizedPhone) {
      const bucket = byPhone.get(candidate.normalizedPhone) ?? [];
      bucket.push(candidate);
      byPhone.set(candidate.normalizedPhone, bucket);
    }

    const key = buildNameAddressKey(candidate.normalizedClientName, candidate.normalizedAddress);
    if (key) {
      const bucket = byNameAddress.get(key) ?? [];
      bucket.push(candidate);
      byNameAddress.set(key, bucket);
    }
  }

  return rows.map((row) => {
    const matched = { ...row };

    const phoneMatches = row.normalizedPhone ? byPhone.get(row.normalizedPhone) ?? [] : [];
    if (phoneMatches.length === 1) {
      matched.matchStatus = 'matched_live';
      matched.matchedProjectId = phoneMatches[0].projectId;
      matched.matchMethod = 'phone_exact';
      return matched;
    }

    if (phoneMatches.length > 1) {
      const narrowed = phoneMatches.filter(
        (candidate) =>
          candidate.normalizedClientName === row.normalizedClientName && candidate.normalizedAddress === row.normalizedAddress,
      );
      if (narrowed.length === 1) {
        matched.matchStatus = 'matched_live';
        matched.matchedProjectId = narrowed[0].projectId;
        matched.matchMethod = 'phone_name_address_exact';
        return matched;
      }
    }

    const nameAddressKey = buildNameAddressKey(row.normalizedClientName, row.normalizedAddress);
    const nameAddressMatches = nameAddressKey ? byNameAddress.get(nameAddressKey) ?? [] : [];
    if (nameAddressMatches.length === 1) {
      matched.matchStatus = 'matched_live';
      matched.matchedProjectId = nameAddressMatches[0].projectId;
      matched.matchMethod = 'name_address_exact';
      return matched;
    }

    return matched;
  });
}

function summarizeRows(rows: ParsedLegacyImportRow[]) {
  const matched = rows.filter((row) => row.matchStatus === 'matched_live').length;
  return {
    imported: rows.length,
    matched,
    visible: rows.length - matched,
    byYear: rows.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.groupYear ?? 'unknown');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

async function persistImport(params: {
  supabase: any;
  sourceFilename: string;
  sourceSheetName: string;
  sourceSha256: string;
  rows: ParsedLegacyImportRow[];
}) {
  const summary = summarizeRows(params.rows);

  const deactivateRes = await params.supabase.from('running_job_legacy_import_batches').update({ is_active: false }).eq('is_active', true);
  if (deactivateRes.error) throw deactivateRes.error;

  const batchRes = await params.supabase
    .from('running_job_legacy_import_batches')
    .insert({
      source_filename: params.sourceFilename,
      source_sheet_name: params.sourceSheetName,
      source_file_sha256: params.sourceSha256,
      imported_row_count: summary.imported,
      matched_row_count: summary.matched,
      visible_row_count: summary.visible,
      is_active: true,
    })
    .select('id')
    .single();

  if (batchRes.error) throw batchRes.error;
  const batchId = String((batchRes.data as any)?.id ?? '');

  const dbRows = params.rows.map((row) => ({
    batch_id: batchId,
    source_row_number: row.sourceRowNumber,
    raw_cells: row.rawCells,
    display_cells: row.displayCells,
    normalized_client_name: row.normalizedClientName,
    normalized_phone: row.normalizedPhone,
    normalized_address: row.normalizedAddress,
    group_year: row.groupYear,
    sort_date: row.sortDate,
    match_status: row.matchStatus,
    matched_project_id: row.matchedProjectId,
    match_method: row.matchMethod,
  }));

  for (const rowsChunk of chunk(dbRows, 200)) {
    const insertRes = await params.supabase.from('running_job_legacy_rows').insert(rowsChunk);
    if (insertRes.error) throw insertRes.error;
  }

  return { batchId, summary };
}

function printSummary(label: string, rows: ParsedLegacyImportRow[]) {
  const summary = summarizeRows(rows);
  console.log(`\n${label}`);
  console.log(`  imported rows: ${summary.imported}`);
  console.log(`  matched live rows: ${summary.matched}`);
  console.log(`  visible legacy rows: ${summary.visible}`);
  console.log('  rows by year:', summary.byYear);
  console.log('  sample visible rows:');
  for (const row of rows.filter((item) => item.matchStatus === 'unmatched').slice(0, 10)) {
    console.log(
      `   - row ${row.sourceRowNumber}: ${row.displayCells.client_name ?? '(unnamed)'} | ${row.displayCells.site_address ?? '-'} | year ${row.groupYear ?? '?'}`,
    );
  }
}

async function main() {
  loadEnvFromRepo();

  const args = process.argv.slice(2);
  const workbookPath = path.resolve(process.cwd(), readFlag(args, '--file') ?? DEFAULT_WORKBOOK_PATH);
  const requestedSheetName = readFlag(args, '--sheet');
  const apply = args.includes('--apply');

  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Workbook not found: ${workbookPath}`);
  }

  const supabase = createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const fileBuffer = fs.readFileSync(workbookPath);
  const sourceSha256 = createHash('sha256').update(fileBuffer).digest('hex');
  const parsed = parseWorkbook(workbookPath, requestedSheetName);
  const candidates = await loadLiveMatchCandidates(supabase);
  const matchedRows = matchLegacyRows(parsed.rows, candidates);

  printSummary(`Legacy import dry run for ${path.basename(workbookPath)} (${parsed.sheetName})`, matchedRows);

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply after the migration is applied.');
    return;
  }

  const persisted = await persistImport({
    supabase,
    sourceFilename: path.basename(workbookPath),
    sourceSheetName: parsed.sheetName,
    sourceSha256,
    rows: matchedRows,
  });

  console.log('\nLegacy import persisted.');
  console.log(`  batch id: ${persisted.batchId}`);
  console.log(`  visible rows: ${persisted.summary.visible}`);
}

main().catch((error) => {
  console.error('Failed to import legacy running-job rows:', error instanceof Error ? error.message : error);
  process.exit(1);
});
