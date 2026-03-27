import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

type ActionOverrideRow = {
  action_id: string;
  base_minutes: number;
};

type CurvePoint = {
  length_m: number;
  minutes_per_m: number;
};

type CurveOverrideRow = {
  curve_key: string;
  points_json: unknown;
};

const DEFAULT_FACTOR = 1.2;
const UPDATED_BY = 'costing-rebaseline-v1.7-2026-03-27';

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

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function roundWhole(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function parseCurvePoints(value: unknown): CurvePoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const lengthM = Number((entry as any)?.length_m);
      const minutesPerM = Number((entry as any)?.minutes_per_m);
      if (!Number.isFinite(lengthM) || !Number.isFinite(minutesPerM)) return null;
      return {
        length_m: round2(Math.max(0, lengthM)),
        minutes_per_m: round2(Math.max(0, minutesPerM)),
      };
    })
    .filter((entry): entry is CurvePoint => entry !== null);
}

function getFlagValue(flag: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

loadEnvFromRepo();

const factorRaw = getFlagValue('--factor');
const factor = factorRaw ? Number(factorRaw) : DEFAULT_FACTOR;
if (!Number.isFinite(factor) || factor <= 0) {
  throw new Error('Factor must be a positive number.');
}

const apply = hasFlag('--apply');

const supabase = createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function main() {
  const actionRes = await supabase.from('install_action_minutes_overrides').select('action_id, base_minutes').order('action_id');
  if (actionRes.error) throw actionRes.error;

  const curveRes = await supabase.from('install_driver_curve_overrides').select('curve_key, points_json').order('curve_key');
  if (curveRes.error) throw curveRes.error;

  const actionRows = ((actionRes.data ?? []) as ActionOverrideRow[]).filter((row) => row?.action_id);
  const curveRows = ((curveRes.data ?? []) as CurveOverrideRow[]).filter((row) => row?.curve_key);

  const scaledActions = actionRows.map((row) => ({
    action_id: row.action_id,
    before: row.base_minutes,
    after: roundWhole(Number(row.base_minutes ?? 0) * factor),
  }));

  const scaledCurves = curveRows.map((row) => ({
    curve_key: row.curve_key,
    before: parseCurvePoints(row.points_json),
    after: parseCurvePoints(row.points_json).map((point) => ({
      length_m: point.length_m,
      minutes_per_m: round2(point.minutes_per_m * factor),
    })),
  }));

  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`);
  console.log(`Factor: ${factor}`);
  console.log(`Action override rows: ${scaledActions.length}`);
  console.log(`Curve override rows: ${scaledCurves.length}`);

  if (scaledActions.length) {
    console.log('Sample action overrides:');
    for (const row of scaledActions.slice(0, 10)) {
      console.log(`  ${row.action_id}: ${row.before} -> ${row.after}`);
    }
  }

  if (scaledCurves.length) {
    console.log('Sample curve overrides:');
    for (const row of scaledCurves.slice(0, 3)) {
      const preview = row.after.map((point) => `${point.length_m}m=${point.minutes_per_m}`).join(', ');
      console.log(`  ${row.curve_key}: ${preview}`);
    }
  }

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write the scaled overrides.');
    return;
  }

  if (scaledActions.length) {
    const payload = scaledActions.map((row) => ({
      action_id: row.action_id,
      base_minutes: row.after,
      updated_by: UPDATED_BY,
    }));
    const writeActions = await supabase.from('install_action_minutes_overrides').upsert(payload, { onConflict: 'action_id' });
    if (writeActions.error) throw writeActions.error;
  }

  if (scaledCurves.length) {
    const payload = scaledCurves.map((row) => ({
      curve_key: row.curve_key,
      points_json: row.after,
      updated_by: UPDATED_BY,
    }));
    const writeCurves = await supabase.from('install_driver_curve_overrides').upsert(payload, { onConflict: 'curve_key' });
    if (writeCurves.error) throw writeCurves.error;
  }

  console.log('Override rebaseline complete.');
}

main().catch((err) => {
  console.error('Failed to inspect/rebaseline install overrides:', err instanceof Error ? err.message : err);
  process.exit(1);
});
