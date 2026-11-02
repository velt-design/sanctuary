/** Routing/display metadata only. Authoring rechecks current edit authority. */
export type StudioProjectDesign = {
  id: string; label: string; versionLabel: string; createdAt: string; history: string;
  quoteLabel: string | null; canOpenEditor: boolean; status: string;
  commercialScopeId: string | null; isActiveDraft: boolean;
  designId?: string | null;
};
export type StudioProjectDesigns = {
  project: { id: string; name: string }; designs: StudioProjectDesign[]; loadError: boolean;
};
export function studioDesignHref(projectId: string, design: StudioProjectDesign) {
  return `/staff/design-studio/${projectId}/${design.id}/edit`;
}
/** Deliberate options can be remembered. Automatic fallback stays in base scope. */
export function selectStudioProjectDesign(designs: StudioProjectDesign[], remembered: string | null) {
  const visible = designs.filter(design => design.status !== 'archived');
  return visible.find(design => design.id === remembered)
    ?? visible.find(design => !design.commercialScopeId && design.isActiveDraft)
    ?? visible.find(design => !design.commercialScopeId)
    ?? visible[0] ?? designs[0] ?? null;
}
export function studioProjectChoiceKey(actorId: string, projectId: string) {
  // localStorage is origin-scoped. This is not cached design data or authority.
  return `sanctuary-studio-project-choice:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(projectId)}`;
}
export function readStudioProjectChoice(actorId: string, projectId: string) {
  try { return localStorage.getItem(studioProjectChoiceKey(actorId, projectId)); } catch { return null; }
}
export function rememberStudioProjectChoice(actorId: string, projectId: string, estimateId: string) {
  try { localStorage.setItem(studioProjectChoiceKey(actorId, projectId), estimateId); }
  catch { /* Optional routing hint. Fresh project reads remain authoritative. */ }
}
