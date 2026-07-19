import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  CALCULATOR_MULTI_MODULE_SCENARIO_REVISION,
  PORTAL_SCENARIO_STATE_PATH,
  seededPortalScenarios,
  type PortalScenarioId,
  type PortalScenarioStateFile,
  type PortalScenarioStateRecord,
} from '../playwright/support/portalScenarioRegistry';
import {
  isCalculatorInputsV2,
  migrateLegacyCalculatorInputsToV2,
  type CalculatorInputs,
  type CalculatorModuleInputs,
  type LegacyCalculatorInputsV1,
} from '../apps/portal/lib/types/calculator';

export type PortalScenarioTarget = 'local' | 'staging';

export interface PortalScenarioConfig {
  email: string;
  password: string;
  scenarioTarget: PortalScenarioTarget;
  supabaseUrl: string;
  serviceRoleKey: string;
  scenarioPrefix: string;
  scenarios: PortalScenarioId[];
}

type PortalScenarioEnv = Partial<Record<string, string | undefined>>;

const REQUIRED_ENV = [
  'PORTAL_TEST_EMAIL',
  'PORTAL_TEST_PASSWORD',
  'PORTAL_TEST_SCENARIO_TARGET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const SEEDED_SCENARIO_IDS = new Set<PortalScenarioId>(seededPortalScenarios.map((scenario) => scenario.id));

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
  loadEnvFile(path.resolve(cwd, '.env.agent.local'));
  loadEnvFile(path.resolve(cwd, '.env.local'));
  loadEnvFile(path.resolve(cwd, '.env'));
}

function readRequiredEnv(env: PortalScenarioEnv, name: (typeof REQUIRED_ENV)[number]): string {
  const value = env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${name} is required for portal scenario provisioning.`);
}

function parseScenarioList(value: string | undefined): PortalScenarioId[] {
  if (!value?.trim()) return [...SEEDED_SCENARIO_IDS];

  const requested = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as PortalScenarioId[];

  if (requested.length === 0) return [...SEEDED_SCENARIO_IDS];

  const known = new Set(seededPortalScenarios.map((scenario) => scenario.id));
  const unknown = requested.filter((scenario) => !known.has(scenario));
  if (unknown.length > 0) {
    throw new Error(`PORTAL_SCENARIOS includes scenarios that are not seedable in this PR: ${unknown.join(', ')}`);
  }

  return requested;
}

export function readPortalScenarioConfig(env: PortalScenarioEnv = process.env): PortalScenarioConfig {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required env for portal scenario provisioning: ${missing.join(', ')}`);
  }

  const scenarioTarget = readRequiredEnv(env, 'PORTAL_TEST_SCENARIO_TARGET');
  if (scenarioTarget === 'production') {
    throw new Error('PORTAL_TEST_SCENARIO_TARGET=production is not allowed.');
  }
  if (scenarioTarget !== 'local' && scenarioTarget !== 'staging') {
    throw new Error('PORTAL_TEST_SCENARIO_TARGET must be "local" or "staging".');
  }

  const scenarioPrefix = env.PORTAL_SCENARIO_PREFIX?.trim() || 'agent';
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(scenarioPrefix)) {
    throw new Error('PORTAL_SCENARIO_PREFIX must contain only letters, numbers, underscores, or hyphens.');
  }

  return {
    email: readRequiredEnv(env, 'PORTAL_TEST_EMAIL'),
    password: readRequiredEnv(env, 'PORTAL_TEST_PASSWORD'),
    scenarioTarget,
    supabaseUrl: readRequiredEnv(env, 'NEXT_PUBLIC_SUPABASE_URL'),
    serviceRoleKey: readRequiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    scenarioPrefix,
    scenarios: parseScenarioList(env.PORTAL_SCENARIOS),
  };
}

export function redactPortalScenarioSecrets(
  message: unknown,
  config: Pick<PortalScenarioConfig, 'password' | 'serviceRoleKey'>,
): string {
  let text = typeof message === 'string' ? message : message instanceof Error ? message.message : String(message);
  for (const secret of [config.password, config.serviceRoleKey]) {
    if (!secret) continue;
    text = text.split(secret).join('[redacted]');
  }
  return text;
}

export function stableScenarioUuid(prefix: string, scenarioId: PortalScenarioId, entityName: string): string {
  const digest = crypto.createHash('sha256').update(`${prefix}:${scenarioId}:${entityName}`).digest('hex');
  const chars = digest.slice(0, 32).split('');
  chars[12] = '4';
  chars[16] = ((Number.parseInt(chars[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function appId(prefix: string, uuid: string): string {
  return `${prefix}_${uuid}`;
}

function titleFromScenarioId(scenarioId: PortalScenarioId): string {
  return scenarioId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function upsertOrThrow(supabase: SupabaseClient, table: string, row: Record<string, unknown>, onConflict = 'id') {
  const { error } = await supabase.from(table).upsert(row as any, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

function buildEstimateOutputs(projectName: string, contactName: string) {
  return {
    cost_snapshot_version: 'v2',
    materials: {
      totals: { materials_ex_gst: 12000 },
    },
    install: {
      totals: { install_ex_gst: 5500 },
    },
    overhead: {
      total_ex_gst: 2500,
    },
    totals: {
      cost_ex_gst: 20000,
      cost_inc_gst: 23000,
    },
    warnings: [],
    projectSnapshot: {
      projectName,
      customerName: contactName,
      siteAddress: '10 Agent Scenario Lane',
      region: 'Auckland',
    },
    snapshot: {
      projectName,
      customerName: contactName,
      siteAddress: '10 Agent Scenario Lane',
      region: 'Auckland',
    },
    version: 1,
  };
}

export function buildCalculatorScenarioInputs(projectName: string, quoteRef = ''): CalculatorInputs {
  const legacy: LegacyCalculatorInputsV1 = {
    projectName,
    quoteRef,
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'Black',
    powdercoatStandardColour: '',
    powdercoatIsCustom: false,
    powdercoatCustomColour: '',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0.2',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: true,
    mixedSkylightStripCount: '1',
    mixedSkylightStripWidthM: '0.62',
    postCount: '4',
    houseConnectionType: 'soffit',
    postConnectionType: 'deck_bracket',
    access: 'normal',
    height: 'single_storey',
    ground: 'easy',
    lengthM: '6',
    projectionM: '3',
    postCutHeightM: '2.4',
    travelExGst: '0',
    extrasAllowanceExGst: '0',
    timberRoofAllowanceExGst: '0',
    quoteDiscountPct: '0',
    blinds: { items: [] },
  };
  const inputs = migrateLegacyCalculatorInputsToV2(legacy);
  if (!isCalculatorInputsV2(inputs) || inputs.modules.length === 0) {
    throw new Error('Calculator scenario inputs must satisfy the current V2 contract.');
  }
  return inputs;
}

function cloneScenarioModule(
  source: CalculatorModuleInputs,
  key: string,
  overrides: Partial<CalculatorModuleInputs>,
): CalculatorModuleInputs {
  const cloned = structuredClone(source);
  return {
    ...cloned,
    ...overrides,
    flashings: cloned.flashings
      ? {
          rows: cloned.flashings.rows.map((row, index) => ({
            ...row,
            id: `scenario-flashing-${key}-${index + 1}`,
          })),
        }
      : undefined,
    infills: cloned.infills
      ? {
          items: cloned.infills.items.map((item, index) => ({
            ...item,
            id: `scenario-infill-${key}-${index + 1}`,
          })),
        }
      : undefined,
  };
}

export function buildGuidedCalculatorScenarioInputs(projectName: string): CalculatorInputs {
  const base = buildCalculatorScenarioInputs(projectName);
  const source = base.modules[0];
  if (!source) throw new Error('Guided calculator scenario requires a starter module.');

  const guided: CalculatorInputs = {
    ...base,
    pergolas: [
      { id: 'pergola-1', label: 'Pergola 1' },
      { id: 'pergola-2', label: 'Pergola 2' },
    ],
    modules: [
      cloneScenarioModule(source, 'p1-m1', {
        pergolaId: 'pergola-1',
        pergolaStyle: 'pitched',
        lengthM: '6',
        projectionM: '3',
      }),
      cloneScenarioModule(source, 'p1-m2', {
        pergolaId: 'pergola-1',
        pergolaStyle: 'gable',
        lengthM: '4.8',
        projectionM: '3.2',
      }),
      cloneScenarioModule(source, 'p2-m1', {
        pergolaId: 'pergola-2',
        pergolaStyle: 'hip',
        lengthM: '5.4',
        projectionM: '3.6',
      }),
    ],
  };

  if (!isCalculatorInputsV2(guided) || guided.modules.length !== 3 || guided.pergolas?.length !== 2) {
    throw new Error('Guided calculator scenario inputs must satisfy the current multi-module V2 contract.');
  }
  return guided;
}

export function buildPortalScenarioInputs(
  scenarioId: PortalScenarioId,
  projectName: string,
  quoteRef = '',
): CalculatorInputs {
  return scenarioId === 'calculator-multi-module'
    ? buildGuidedCalculatorScenarioInputs(projectName)
    : buildCalculatorScenarioInputs(projectName, quoteRef);
}

async function seedProjectScenario(
  supabase: SupabaseClient,
  config: PortalScenarioConfig,
  scenarioId: PortalScenarioId,
): Promise<PortalScenarioStateRecord> {
  const title = titleFromScenarioId(scenarioId);
  const contactUuid = stableScenarioUuid(config.scenarioPrefix, scenarioId, 'contact');
  const projectUuid = stableScenarioUuid(config.scenarioPrefix, scenarioId, 'project');
  const estimateUuid = stableScenarioUuid(config.scenarioPrefix, scenarioId, 'estimate');
  const contactName = `[Agent Scenario] ${title} Contact`;
  const projectName = `[Agent Scenario] ${title}`;

  await upsertOrThrow(supabase, 'contacts', {
    id: contactUuid,
    name: contactName,
    email: `portal-agent+${scenarioId}@sanctuarypergolas.co.nz`,
    phone: '+64 21 000 000',
    address: '10 Agent Scenario Lane',
    updated_at: new Date().toISOString(),
  });

  await upsertOrThrow(supabase, 'projects', {
    id: projectUuid,
    contact_id: contactUuid,
    name: projectName,
    quote_ref: scenarioId === 'quote-ready' ? `${config.scenarioPrefix.toUpperCase()}-QUOTE-READY` : null,
    region: 'Auckland',
    site_address: '10 Agent Scenario Lane',
    pipeline_stage: 'NEW',
    notes: `Deterministic portal scenario seeded by ${config.scenarioPrefix}.`,
    updated_at: new Date().toISOString(),
  });

  await upsertOrThrow(supabase, 'estimates', {
    id: estimateUuid,
    project_id: projectUuid,
    status: 'draft',
    version: 1,
    created_by: 'portal-agent-scenario',
    summary_json: {
      title: `${projectName} estimate`,
      scenarioId,
      fixtureRevision:
        scenarioId === 'calculator-multi-module' ? CALCULATOR_MULTI_MODULE_SCENARIO_REVISION : undefined,
      totals: {
        materials_ex_gst: 12000,
        install_payout_ex_gst: 5500,
        overhead_ex_gst: 2500,
        total_ex_gst: 20000,
        total_inc_gst: 23000,
      },
    },
    internal_notes: `Seeded ${scenarioId} estimate.`,
    inputs: buildPortalScenarioInputs(
      scenarioId,
      projectName,
      scenarioId === 'quote-ready' ? `${config.scenarioPrefix.toUpperCase()}-QUOTE-READY` : '',
    ),
    outputs: buildEstimateOutputs(projectName, contactName),
    warnings: [],
    updated_at: new Date().toISOString(),
  });

  const state: PortalScenarioStateRecord = {
    scenarioId,
    fixtureRevision:
      scenarioId === 'calculator-multi-module' ? CALCULATOR_MULTI_MODULE_SCENARIO_REVISION : undefined,
    contactId: appId('ct', contactUuid),
    projectId: appId('proj', projectUuid),
    estimateId: appId('est', estimateUuid),
    labels: { contactName, projectName },
  };

  if (scenarioId !== 'quote-ready') return state;

  const quoteUuid = stableScenarioUuid(config.scenarioPrefix, scenarioId, 'quote');
  const quoteVersionUuid = stableScenarioUuid(config.scenarioPrefix, scenarioId, 'quote-version');
  const lineItemOneUuid = stableScenarioUuid(config.scenarioPrefix, scenarioId, 'quote-line-item-1');
  const lineItemTwoUuid = stableScenarioUuid(config.scenarioPrefix, scenarioId, 'quote-line-item-2');
  const quoteRef = `${config.scenarioPrefix.toUpperCase()}-Q-READY`;

  await upsertOrThrow(supabase, 'quotes', {
    id: quoteUuid,
    project_id: projectUuid,
    quote_ref: quoteRef,
    created_by: 'portal-agent-scenario',
  });

  await upsertOrThrow(supabase, 'quote_versions', {
    id: quoteVersionUuid,
    quote_id: quoteUuid,
    version_number: 1,
    status: 'DRAFT',
    source_estimate_version_id: estimateUuid,
    created_by: 'portal-agent-scenario',
    reference: quoteRef,
    customer_name: contactName,
    intro_text: 'Seeded agent scenario quote.',
    terms_text: 'Seeded local/staging scenario only.',
    total_inc_gst_cents: 2300000,
    total_ex_gst_cents: 2000000,
    gst_cents: 300000,
    updated_at: new Date().toISOString(),
  });

  const deleteResult = await supabase.from('quote_line_items').delete().eq('quote_version_id', quoteVersionUuid);
  if (deleteResult.error) throw new Error(`quote_line_items delete: ${deleteResult.error.message}`);

  const insertResult = await supabase.from('quote_line_items').insert([
    {
      id: lineItemOneUuid,
      quote_version_id: quoteVersionUuid,
      sort_order: 0,
      description: '[Agent Scenario] Pergola package',
      qty: 1,
      unit_price_inc_gst_cents: 1840000,
      line_total_inc_gst_cents: 1840000,
    },
    {
      id: lineItemTwoUuid,
      quote_version_id: quoteVersionUuid,
      sort_order: 1,
      description: '[Agent Scenario] Installation',
      qty: 1,
      unit_price_inc_gst_cents: 460000,
      line_total_inc_gst_cents: 460000,
    },
  ] as any);
  if (insertResult.error) throw new Error(`quote_line_items insert: ${insertResult.error.message}`);

  return {
    ...state,
    quoteId: appId('qt', quoteUuid),
    quoteVersionId: appId('qv', quoteVersionUuid),
    labels: { ...state.labels, quoteRef },
  };
}

async function ensurePortalScenarios(config: PortalScenarioConfig): Promise<PortalScenarioStateFile> {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const scenarios: PortalScenarioStateFile['scenarios'] = {};
  for (const scenarioId of config.scenarios) {
    scenarios[scenarioId] = await seedProjectScenario(supabase, config, scenarioId);
    console.log(`Seeded portal scenario: ${scenarioId}`);
  }

  const state: PortalScenarioStateFile = {
    generatedAt: new Date().toISOString(),
    target: config.scenarioTarget,
    prefix: config.scenarioPrefix,
    scenarios,
  };

  fs.mkdirSync(path.dirname(PORTAL_SCENARIO_STATE_PATH), { recursive: true });
  fs.writeFileSync(PORTAL_SCENARIO_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`Portal scenario state written: ${path.relative(process.cwd(), PORTAL_SCENARIO_STATE_PATH)}`);
  return state;
}

async function main() {
  loadEnvFromRepo();
  const config = readPortalScenarioConfig();
  try {
    await ensurePortalScenarios(config);
  } catch (error) {
    console.error(`Failed to ensure portal scenarios: ${redactPortalScenarioSecrets(error, config)}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to ensure portal scenarios: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
