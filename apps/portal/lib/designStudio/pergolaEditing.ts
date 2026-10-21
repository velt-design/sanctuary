import {parseWebsiteAttachments} from './studioHouseScene';
import {parseWebsiteJoins} from './websiteJoinIntent';
import { parseStudioAuthoringEdit, type StudioAuthoringEdit } from './authoringView';
import { isStudioObject, type StudioJsonObject } from './contracts';
import { parseStudioWebsiteDesign, rebindStudioWebsiteDesign } from './websiteDesign';
import { duplicateCollections, type StudioPergolaDuplication } from './pergolaDuplication';

export type StudioPergolaEdit =
  | { kind: 'duplicate'; pergolaId: string; id: string; rowIds: { flashings: Record<string, string>; infills: Record<string, string> } }
  | { kind: 'remove'; pergolaId: string };
export function applyStudioPergolaEdit(input: StudioAuthoringEdit, command: StudioPergolaEdit,
  context: { persistedObjectIds: readonly string[]; baselineObjectOptions?: StudioAuthoringEdit['objectOptions']; savePending?: boolean }): { ok: true; edit: StudioAuthoringEdit; selectedObjectId: string | null; notice?: string } | { ok: false; message: string } {
  try {
    const parsed = parseStudioAuthoringEdit(input);
    if (!parsed.ok) throw Error('The design could not be verified.');
    const edit = parsed.value, source = edit.spatial.pergolas.find(p => p.id === command.pergolaId);
    if (!source) throw Error('The selected pergola is no longer available.');
    if (command.kind === 'remove') {
      const dependent = edit.spatial.pergolas.find(p => p.id !== source.id && p.attachment?.host?.objectId === source.id);
      if (dependent) throw Error(`Detach ${dependent.label} before deleting this pergola.`);
      if (edit.spatial.pergolas.some(p => p.id !== source.id && !p.attachment?.host && (p.attachmentEdgeId !== null || p.attachmentZoneId !== null)))
        throw Error('Resolve the other pergola connections before deleting this pergola.');
      const index = edit.spatial.pergolas.indexOf(source);
      edit.spatial.pergolas.splice(index, 1);
      if(edit.site.websiteJoins){const joins=parseWebsiteJoins(edit.site.websiteJoins);joins.joins=joins.joins.filter(j=>j.a.objectId!==source.id&&j.b.objectId!==source.id);edit.site.websiteJoins=joins as unknown as StudioJsonObject;}
      if(edit.site.websiteAttachments){const a=parseWebsiteAttachments(edit.site.websiteAttachments);a.attachments=a.attachments.filter(a=>a.objectId!==source.id);edit.site.websiteAttachments=a as unknown as StudioJsonObject;}
      edit.objectOptions = edit.objectOptions.filter(row => row.objectId !== source.id);
      edit.deletions = edit.deletions.filter(row => row.scope === 'site' || row.objectId !== source.id);
      edit.deletions.push({ scope: 'object-options', objectId: source.id });
      if (edit.duplications) edit.duplications = edit.duplications.filter(row => row.targetId !== source.id);
      const valid = parseStudioAuthoringEdit(edit); if (!valid.ok) throw Error(valid.message);
      return { ok: true, edit: valid.value, selectedObjectId: edit.spatial.pergolas[index]?.id ?? edit.spatial.pergolas[index - 1]?.id ?? null };
    }
    if (context.savePending) throw Error('Finish saving before making another copy.');
    if (command.kind !== 'duplicate') throw Error('Unsupported pergola action.');
    if (!context.baselineObjectOptions) throw Error('Reload the saved design before making a copy.');
    const ancestor = edit.duplications?.find(row => row.targetId === source.id);
    const values = structuredClone(edit.objectOptions.find(row => row.objectId === source.id)?.values ?? {});
    if (values.websiteDesign) {
      const website = parseStudioWebsiteDesign(values.websiteDesign, source.id);
      if (!website.ok) throw Error(website.message);
      values.websiteDesign = rebindStudioWebsiteDesign(website.value, command.id) as unknown as StudioJsonObject;
    }
    const operation: StudioPergolaDuplication = { targetId: command.id,
      sourceId: ancestor ? ancestor.sourceId : context.persistedObjectIds.includes(source.id) ? source.id : null,
      values, rowOrigins: { flashings: {}, infills: {} } };
    for (const [section, collection] of duplicateCollections) {
      const container = values[section], rows = isStudioObject(container) ? container[collection] : undefined;
      const entries = Array.isArray(rows) ? rows : [];
      if (Object.keys(command.rowIds[section]).length !== entries.length) throw Error('The copied row identities do not match the selected pergola.');
      for (const row of entries) {
        if (!isStudioObject(row) || typeof row.id !== 'string') throw Error('Invalid selected row.');
        const old = row.id, id = command.rowIds[section][old];
        if (!id || id === old || Object.hasOwn(operation.rowOrigins[section], id)) throw Error('Each copied row needs a new unique identity.');
        const baseline = context.baselineObjectOptions.find(item => item.objectId === source.id)?.values[section];
        const baselineRows = isStudioObject(baseline) && Array.isArray(baseline[collection]) ? baseline[collection] : [];
        operation.rowOrigins[section][id] = ancestor ? ancestor.rowOrigins[section][old] ?? null : operation.sourceId && baselineRows.some(item => isStudioObject(item) && item.id === old) ? old : null;
        row.id = id;
      }
    }
    edit.schemaVersion = 'studio_authoring_edit.v2';
    edit.duplications = [...(edit.duplications ?? []), operation];
    edit.spatial.pergolas.push({ ...structuredClone(source), id: command.id, label: `Copy of ${source.label}` });
    edit.objectOptions.push({ objectId: command.id, values: structuredClone(values) });
    if(edit.site.websiteAttachments){const a=parseWebsiteAttachments(edit.site.websiteAttachments),binding=a.attachments.find(a=>a.objectId===source.id);if(binding)a.attachments.push({...structuredClone(binding),objectId:command.id});edit.site.websiteAttachments=a as unknown as StudioJsonObject;}
    const valid = parseStudioAuthoringEdit(edit); if (!valid.ok) throw Error(valid.message);
    return { ok: true, edit: valid.value, selectedObjectId: command.id, notice: 'Copy created at the same position. Move it in Plan.' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'The pergola could not be changed.' }; }
}
