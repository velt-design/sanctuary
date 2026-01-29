import type { Estimate } from '@/lib/types/estimate';
import type { CalculatorInputs, CalculatorModuleInputs, LegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import type { InstallActionV1, MaterialsLineV1 } from '@/src/costing/engine/types';
import type { AcrylicLine, HardwareLine, InstallPhase, JobPack, PowdercoatLine } from './types';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferColourFromLabel(label: string): string {
  const match = label.match(/\(([^)]+)\)(?!.*\([^)]*\))/);
  if (!match) return '';
  return normaliseWhitespace(match[1] ?? '');
}

function inferStockLengthFromLabel(label: string): number | null {
  const match = label.match(/(\d+(?:\.\d+)?)m\b/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1] ?? '');
  return Number.isFinite(n) ? n : null;
}

function stripPrefix(label: string): string {
  return label.replace(/^\[[^\]]+\]\s*/g, '').trim();
}

function normaliseWarningMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const msg = item.trim();
      if (msg) out.push(msg);
      continue;
    }
    if (item && typeof item === 'object') {
      const msg = String((item as any).message ?? '').trim();
      if (msg) out.push(msg);
    }
  }
  return out;
}

function classifyMaterialsLine(line: MaterialsLineV1): { powdercoat: boolean; acrylic: boolean; hardware: boolean } {
  const id = (line.id ?? '').toLowerCase();
  const label = (line.label ?? '').toLowerCase();
  const profile = (line.profile ?? '').toString().toLowerCase();

  const powdercoat = id.includes('aluminium-extrusion');

  const acrylic =
    id.startsWith('m1.roofing') ||
    id.includes('.roofing') ||
    label.includes('crystalite') ||
    label.includes('acrylic') ||
    label.includes('joiner') ||
    profile.includes('joiner') ||
    label.includes('rubber') ||
    label.includes('foam') ||
    label.includes('flashing');

  const hardware = id.includes('.fixing') || id.includes('.consumable') || id.includes('hardware');

  return { powdercoat, acrylic, hardware };
}

function groupPowdercoat(lines: MaterialsLineV1[]): PowdercoatLine[] {
  const groups = new Map<string, PowdercoatLine>();
  for (const line of lines) {
    const rawProfile = line.profile ? String(line.profile) : stripPrefix(line.label);
    const profile = normaliseWhitespace(rawProfile);
    const colour = inferColourFromLabel(line.label) || '—';
    const stockLength = inferStockLengthFromLabel(line.label) ?? 6;
    const unit = line.unit;
    const key = `${profile}|${colour}|${stockLength}|${unit}`;

    const existing = groups.get(key);
    const notes = [line.notes, 'Bar optimisation assumed, includes waste.'].filter(Boolean).join(' ');
    if (!existing) {
      groups.set(key, {
        profile,
        colour,
        stock_length_m: stockLength,
        unit,
        qty: line.qty,
        notes: notes || undefined,
      });
    } else {
      existing.qty += line.qty;
      if (notes && existing.notes && !existing.notes.includes(notes)) existing.notes = `${existing.notes} | ${notes}`;
      else if (notes && !existing.notes) existing.notes = notes;
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.profile.localeCompare(b.profile));
}

function groupAcrylic(lines: MaterialsLineV1[]): AcrylicLine[] {
  const groups = new Map<string, AcrylicLine>();
  for (const line of lines) {
    const item = stripPrefix(line.label);
    const profile = line.profile ? String(line.profile) : undefined;
    const colour = inferColourFromLabel(line.label) || undefined;
    const stockLength = inferStockLengthFromLabel(line.label) ?? undefined;
    const key = `${item}|${line.unit}`;

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        item,
        profile,
        colour,
        stock_length_m: stockLength ?? undefined,
        unit: line.unit,
        qty: line.qty,
        notes: line.notes ?? undefined,
      });
    } else {
      existing.qty += line.qty;
      const notes = line.notes ?? '';
      if (notes && existing.notes && !existing.notes.includes(notes)) existing.notes = `${existing.notes} | ${notes}`;
      else if (notes && !existing.notes) existing.notes = notes;
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.item.localeCompare(b.item));
}

function groupHardware(lines: MaterialsLineV1[]): HardwareLine[] {
  const groups = new Map<string, HardwareLine>();
  for (const line of lines) {
    const item = stripPrefix(line.label);
    const key = `${item}|${line.unit}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        item,
        unit: line.unit,
        qty: line.qty,
        notes: line.notes ?? undefined,
      });
    } else {
      existing.qty += line.qty;
      const notes = line.notes ?? '';
      if (notes && existing.notes && !existing.notes.includes(notes)) existing.notes = `${existing.notes} | ${notes}`;
      else if (notes && !existing.notes) existing.notes = notes;
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.item.localeCompare(b.item));
}

function phaseForAction(action: InstallActionV1): { id: string; label: string } {
  const id = (action.id ?? '').toLowerCase();
  const category = (action.category ?? '').toLowerCase();

  if (id.includes('.mob.') || id.startsWith('job.mob') || category.includes('mobil')) return { id: 'mobilisation', label: 'Mobilisation' };
  if (id.includes('.posts.') || category.includes('posts') || category.includes('footings')) return { id: 'posts', label: 'Posts / foundations' };
  if (id.includes('.frame.') || id.includes('.beams.') || id.includes('.rafters.') || category.includes('frame'))
    return { id: 'frame', label: 'Frame' };
  if (id.includes('.roof') || id.includes('.acrylic') || id.includes('.roofing') || category.includes('roof')) return { id: 'roof', label: 'Roof system' };
  if (id.includes('.finish') || id.includes('.demob') || category.includes('finish') || category.includes('demob'))
    return { id: 'finish', label: 'Finish / packdown' };
  return { id: 'other', label: 'Other' };
}

function buildInstallPhases(actions: InstallActionV1[]): { phases: InstallPhase[]; totals: { minutes: number; crewHours: number; siteDaysAt9h: number } } {
  const phasesMap = new Map<string, InstallPhase>();
  for (const action of actions) {
    const phase = phaseForAction(action);
    const existing = phasesMap.get(phase.id);
    if (!existing) {
      phasesMap.set(phase.id, {
        phaseId: phase.id,
        label: phase.label,
        minutes: action.minutes,
        costExGst: action.cost_ex_gst,
        actions: [action],
      });
    } else {
      existing.minutes += action.minutes;
      existing.costExGst += action.cost_ex_gst;
      existing.actions.push(action);
    }
  }

  const phases = Array.from(phasesMap.values()).sort((a, b) => {
    const order = ['mobilisation', 'posts', 'frame', 'roof', 'finish', 'other'];
    return order.indexOf(a.phaseId) - order.indexOf(b.phaseId);
  });

  const minutes = phases.reduce((sum, p) => sum + p.minutes, 0);
  const crewHours = minutes / 60;
  const siteDaysAt9h = crewHours / 9;
  return { phases, totals: { minutes, crewHours, siteDaysAt9h } };
}

function formatModuleSummary(module: CalculatorModuleInputs): string {
  const length = toNumber(module.lengthM);
  const projection = toNumber(module.projectionM);
  const pitch = toNumber(module.roofPitchDeg);
  const pitchLabel = pitch !== null ? `${pitch.toFixed(0)}°` : 'default pitch';
  return `${module.pergolaStyle} · ${module.roofMaterial} · ${length ?? '—'}×${projection ?? '—'}m · ${pitchLabel}`;
}

function getFirstModule(inputs: CalculatorInputs | LegacyCalculatorInputsV1): CalculatorModuleInputs | null {
  if (isCalculatorInputsV2(inputs)) return inputs.modules[0] ?? null;
  if (isLegacyCalculatorInputsV1(inputs)) {
    return {
      pergolaStyle: inputs.pergolaStyle,
      roofMaterial: inputs.roofMaterial,
      extrusionColour: inputs.extrusionColour,
      boxPerimeterEnabled: inputs.boxPerimeterEnabled,
      internalRoofType: inputs.internalRoofType,
      fallDistanceMm: inputs.fallDistanceMm,
      roofPitchDeg: inputs.roofPitchDeg,
      boxGutterHouseEdge: inputs.boxGutterHouseEdge ?? 'house',
      boxGutterFarEdge: inputs.boxGutterFarEdge ?? 'our',
      downpipeCount: inputs.downpipeCount ?? '0',
      overhangEnabled: inputs.overhangEnabled ?? false,
      overhangAmountM: inputs.overhangAmountM ?? '0.2',
      overhangSupportBeamProfile: inputs.overhangSupportBeamProfile ?? '150x50',
      invertedEnabled: inputs.invertedEnabled ?? false,
      invertedHouseGutter: inputs.invertedHouseGutter ?? true,
      mixedSkylightStripCount: inputs.mixedSkylightStripCount,
      mixedSkylightStripWidthM: inputs.mixedSkylightStripWidthM,
      mixedAcrylicBaysMain: inputs.mixedAcrylicBaysMain ?? '0',
      mixedAcrylicBaysA: inputs.mixedAcrylicBaysA ?? '0',
      mixedAcrylicBaysB: inputs.mixedAcrylicBaysB ?? '0',
      postCount: inputs.postCount,
      houseConnectionType: inputs.houseConnectionType,
      postConnectionType: inputs.postConnectionType,
      ground: inputs.ground,
      lengthM: inputs.lengthM,
      projectionM: inputs.projectionM,
      hipCornerLengthBM: '0',
      hipCornerProjectionBM: '0',
      postCutHeightM: inputs.postCutHeightM,
      timberRoofAllowanceExGst: inputs.timberRoofAllowanceExGst,
    };
  }
  return null;
}

function getSnapshotFields(estimate: Estimate): { projectName?: string; siteAddress?: string } {
  const snap = (estimate as any).snapshot;
  if (snap && typeof snap === 'object' && snap.project) {
    const p = (snap as any).project;
    return {
      projectName: typeof p.projectName === 'string' ? p.projectName : undefined,
      siteAddress: typeof p.siteAddress === 'string' ? p.siteAddress : undefined,
    };
  }
  const legacy = (estimate as any).projectSnapshot as any;
  return {
    projectName: typeof legacy?.name === 'string' ? legacy.name : undefined,
    siteAddress: typeof legacy?.address === 'string' ? legacy.address : undefined,
  };
}

export function buildJobPack(estimate: Estimate): JobPack {
  const inputs = (estimate as any).inputs as unknown;
  const firstModule = (inputs && typeof inputs === 'object' ? getFirstModule(inputs as any) : null) ?? null;

  const moduleCount = isCalculatorInputsV2(inputs) ? inputs.modules.length : 1;
  const roofType = firstModule?.pergolaStyle ?? '—';
  const roofMaterialMode = firstModule?.roofMaterial ?? '—';
  const pitchDeg = typeof (estimate as any).derived?.roof_pitch_deg_used === 'number' ? (estimate as any).derived.roof_pitch_deg_used : toNumber(firstModule?.roofPitchDeg ?? '');
  const lengthM = toNumber(firstModule?.lengthM ?? '');
  const projectionM = toNumber(firstModule?.projectionM ?? '');

  const snapshotFields = getSnapshotFields(estimate);

  const materials = estimate.outputs.materials.lines ?? [];
  const installActions = estimate.outputs.install.actions ?? [];

  const powdercoatSource = materials.filter((l) => classifyMaterialsLine(l).powdercoat);
  const acrylicSource = materials.filter((l) => classifyMaterialsLine(l).acrylic);
  const hardwareSource = materials.filter((l) => classifyMaterialsLine(l).hardware);

  const powdercoat = groupPowdercoat(powdercoatSource);
  const acrylic = groupAcrylic(acrylicSource);
  const hardware = groupHardware(hardwareSource);

  const installPhases = buildInstallPhases(installActions);

  const assumptions = normaliseWarningMessages(
    (estimate.outputs as any).warnings ?? (estimate.outputs.totals as any).warnings ?? (estimate.outputs.totals as any).notes_and_warnings,
  );

  const specLines: string[] = [];
  specLines.push(`# Builder spec (v1)`);
  if (snapshotFields.projectName) specLines.push(`Project: ${snapshotFields.projectName}`);
  if (snapshotFields.siteAddress) specLines.push(`Site: ${snapshotFields.siteAddress}`);
  specLines.push(`Estimate: ${estimate.id} (${estimate.createdAt})`);
  specLines.push(`Roof: ${roofType} · ${roofMaterialMode}${pitchDeg !== null ? ` · ${pitchDeg.toFixed(0)}°` : ''}`);
  if (moduleCount > 1 && firstModule) specLines.push(`Modules: ${moduleCount} (module 1: ${formatModuleSummary(firstModule)})`);
  if (lengthM !== null && projectionM !== null) {
    specLines.push(`Geometry: ${lengthM}m (roof length) × ${projectionM}m (roof span, eave‑to‑eave)`);
  }
  specLines.push(`Standards: 642mm rafter centres; 1.2m max bracket spacing (assumed)`);
  specLines.push(`Post cut height default: 2.4m (editable)`);
  if (firstModule) {
    specLines.push(`Connections: house=${firstModule.houseConnectionType}; posts=${firstModule.postConnectionType}`);
  }
  if (assumptions.length) {
    specLines.push('');
    specLines.push(`Assumptions / warnings:`);
    for (const msg of assumptions) specLines.push(`- ${msg}`);
  }

  return {
    summary: {
      projectName: snapshotFields.projectName,
      siteAddress: snapshotFields.siteAddress,
      createdAt: estimate.createdAt,
      roofType,
      roofMaterialMode,
      pitchDeg: pitchDeg ?? undefined,
      moduleCount,
      lengthM: lengthM ?? undefined,
      projectionM: projectionM ?? undefined,
      totals: {
        materialsExGst: estimate.outputs.materials.totals.materials_ex_gst,
        installExGst: estimate.outputs.install.totals.install_ex_gst,
        overheadExGst: estimate.outputs.overhead.total_ex_gst,
        trueCostExGst: estimate.outputs.totals.cost_ex_gst,
      },
    },
    orderLists: {
      powdercoat,
      acrylic,
      hardware,
    },
    installPhases,
    specText: specLines.join('\n'),
    assumptions,
  };
}
