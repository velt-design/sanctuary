import type { PreviewDraft } from '../configurator-prototype/previewDraft';

export const PRODUCT_DESIGNS = {
  pitched: {
    family: 'mono', imageFamily: 'pitched', connection: 'fascia', orientation: 'parallel',
    introduction: 'A simple roofline. More room to enjoy outside.',
    attachment: 'House fascia attachment',
    assumptions: 'This starting design attaches to the house fascia at ground level.',
  },
  gable: {
    family: 'gable', imageFamily: 'gable', connection: 'fascia', orientation: 'parallel',
    introduction: 'A raised roofline. More height above your outdoor space.',
    attachment: 'House fascia attachment',
    assumptions: 'This starting design attaches to the house fascia at ground level with open gable ends. The house connection is confirmed for your selected ridge direction. Explore gable infills in the full designer.',
  },
  'box-perimeter': {
    family: 'box', imageFamily: 'box', connection: 'facade', orientation: 'parallel',
    introduction: 'A level outer frame. A clean line alongside your home.',
    attachment: 'House wall attachment',
    assumptions: 'This starting design attaches to the house wall at ground level. The level perimeter conceals an internal sloping roof; its layout follows your dimensions.',
  },
} as const satisfies Record<string, {
  family: PreviewDraft['roof']['family']; imageFamily: string; connection: PreviewDraft['input']['connection'];
  orientation: PreviewDraft['roof']['orientation']; introduction: string; attachment: string; assumptions: string;
}>;

export type ProductDesignType = keyof typeof PRODUCT_DESIGNS;
export function isProductDesignType(slug: string): slug is ProductDesignType {
  return Object.prototype.hasOwnProperty.call(PRODUCT_DESIGNS, slug);
}
export const productSelectionAnchor = (type: ProductDesignType) => `your-${type}-pergola`;

export const PRODUCT_FORM_CHOICES: { type: ProductDesignType; title: string; description: string; connection: string }[] = [
  { type: 'pitched', title: 'Pitched', description: 'A simple roof slope away from your home.', connection: 'Fascia attached' },
  { type: 'gable', title: 'Gable', description: 'A raised ridge for a more open overhead space.', connection: 'Fascia attached · Parallel ridge' },
  { type: 'box-perimeter', title: 'Box', description: 'A level outer frame that conceals the roof slope.', connection: 'Wall attached' },
];
