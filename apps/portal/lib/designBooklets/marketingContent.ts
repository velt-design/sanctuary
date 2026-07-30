import 'server-only';

import { getMarketingDesignBookletContent } from '../../../marketing/lib/designBookletContent';
import type { DesignBookletContentCatalog } from './types';

/**
 * Narrow server-only adapter. Marketing remains the owner of every generic
 * roof-form and roofing-choice sentence used by the booklet.
 */
export function getDesignBookletContentCatalog(): DesignBookletContentCatalog {
  return getMarketingDesignBookletContent();
}
