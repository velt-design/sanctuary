import type {
  HouseFormModel,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

export function resolvePergolaForGeometryModule(input: {
  projectModel: WorkbenchProjectModel;
  module: CalculatorModuleInputs;
  moduleId: string | null;
}): PergolaObjectModel | null {
  const pergolaId = typeof input.module.pergolaId === 'string' ? input.module.pergolaId.trim() : '';
  if (pergolaId) {
    const byPergolaId = input.projectModel.pergolas.find((pergola) => pergola.id === pergolaId) ?? null;
    if (byPergolaId) return byPergolaId;
  }

  if (input.moduleId) {
    return input.projectModel.pergolas.find((pergola) => pergola.id === input.moduleId) ?? null;
  }

  return null;
}

function resolvePergolaSourceFormIds(input: {
  projectModel: WorkbenchProjectModel;
  pergola: PergolaObjectModel | null;
}): string[] {
  const envelope = input.projectModel.houseAssembly?.derivedEnvelope ?? null;
  if (!envelope || !input.pergola) return [];

  const attachmentZone = input.pergola.attachmentZoneId
    ? envelope.attachmentZones.find((zone) => zone.id === input.pergola?.attachmentZoneId) ?? null
    : null;
  if (attachmentZone?.sourceFormIds.length) return attachmentZone.sourceFormIds;

  const attachmentEdge = input.pergola.attachmentEdgeId
    ? envelope.edges.find((edge) => edge.id === input.pergola?.attachmentEdgeId) ?? null
    : null;
  return attachmentEdge?.sourceFormIds ?? [];
}

export function resolveModuleHouseForm(input: {
  projectModel: WorkbenchProjectModel | null;
  module: CalculatorModuleInputs;
  moduleId: string | null;
}): HouseFormModel | null {
  const forms = input.projectModel?.houseAssembly?.houseForms ?? [];
  if (!forms.length || !input.projectModel) return null;

  const pergola = resolvePergolaForGeometryModule({
    projectModel: input.projectModel,
    module: input.module,
    moduleId: input.moduleId,
  });
  const attachmentHostFormId =
    pergola?.attachment?.host?.objectFamily === 'house_forms'
      ? pergola.attachment.host.objectId
      : null;
  const attachmentHostForm = attachmentHostFormId
    ? forms.find((form) => form.id === attachmentHostFormId) ?? null
    : null;
  if (attachmentHostForm) return attachmentHostForm;

  const pergolaSourceFormIds = new Set(resolvePergolaSourceFormIds({
    projectModel: input.projectModel,
    pergola,
  }));
  const pergolaForm = forms.find((form) => pergolaSourceFormIds.has(form.id)) ?? null;
  if (pergolaForm) return pergolaForm;

  if (input.moduleId) {
    const sourceModuleForm = forms.find((form) => form.sourceModuleIds?.includes(input.moduleId ?? '')) ?? null;
    if (sourceModuleForm) return sourceModuleForm;
  }

  return forms[0] ?? null;
}
