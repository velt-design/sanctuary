'use client';
import type { StudioDesignIdentity } from '@/lib/designStudio/studioDesignIdentity';

import Link from 'next/link';
import type { StudioAuthoringView } from '@/lib/designStudio/authoringView';
import type { StudioSaveScope } from '@/lib/designStudio/saveTransport';
import type { StudioWebsiteBrief } from '@/lib/designStudio/websiteBrief';
import { isEmptyWebsiteStart, parseStudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';
import {studioHouseScene} from '@/lib/designStudio/studioHouseScene';
import StudioWebsiteEditor from './StudioWebsiteEditor';
import css from './SavedStudioReview.module.css';
import type {StudioOpeningPrice} from '@/lib/designStudio/studioOpening';

/** The website workspace is the only live Studio editor. Legacy designs remain reviewable. */
export default function StudioEditor(props: {
  scope: StudioSaveScope; view: StudioAuthoringView; updatedAt: string | null;
  editable: boolean; versionLabel: string; identity?: StudioDesignIdentity; websiteBrief?: StudioWebsiteBrief;
  openingPrice?:StudioOpeningPrice;
}) {
  const { view, scope } = props;
  let houseSupported=true;try{studioHouseScene(view.site,view.spatial);}catch{houseSupported=false;}
  const supported = houseSupported && ( isEmptyWebsiteStart(view) || view.spatial.pergolas.every(pergola =>
    parseStudioWebsiteDesign(view.objectOptions.find(row => row.objectId === pergola.id)?.values.websiteDesign, pergola.id).ok));
  if (supported) return <StudioWebsiteEditor {...props} />;
  return <main className={css.review}><h1>Saved design</h1><p>This historical design is available in review. Its original choices and price are kept.</p>
    <Link href={`/staff/design-studio/${scope.projectId}/${scope.estimateId}`}>Review saved design</Link></main>;
}
