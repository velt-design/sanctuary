import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';

export type PreviewDraft = { version: 1; input: SimpleCoverInput; roof: PreviewRoofChoices };
