import { redirect } from 'next/navigation';
import { buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';

/** Existing bookmarks lead into the shared designer; saved Simple inputs migrate there. */
export default function SimpleCoverCalculatorPage() {
  redirect(buildConfiguratorEnquiryHref({
    enquiryType:'residential', sourcePath:'/simple-cover-calculator', sourceComponent:'embedded_form',
  }));
}
