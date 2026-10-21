import type { WebsiteSubmittedDesignV1 } from '../../website/contracts';
export type PreviewRoofChoices = WebsiteSubmittedDesignV1['roof'];
export const INITIAL_ROOF: PreviewRoofChoices = { family: 'mono', orientation: 'parallel', infills: false };
