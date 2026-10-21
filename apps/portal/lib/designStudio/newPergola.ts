import { buildNewObjectWorkbenchPergolaDraft } from '@/app/staff/projects/[projectId]/design-workbench/objectWorkbenchDraftActions';

/** Explicit authored product seed. Existing pitched product specifications use
 * 100x100 posts; geometry's 90x90 representative fallback is not this product.
 * Persist the section on creation so later product defaults cannot change it.
 * This is not automatic engineering selection or conversion of an existing design.
 */
export function buildNewStudioPergolaDraft(input: Parameters<typeof buildNewObjectWorkbenchPergolaDraft>[0]) {
  const pergola = buildNewObjectWorkbenchPergolaDraft(input);
  return {
    ...pergola,
    geometry: { ...pergola.geometry, overrides: { ...pergola.geometry?.overrides, postProfile: '100x100' } },
  };
}
