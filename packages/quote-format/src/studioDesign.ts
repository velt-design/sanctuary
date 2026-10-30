/** Customer-safe immutable design view. No authored payloads or private costing. */
export type StudioQuoteView = {
  schemaVersion: 'studio_quote_snapshot.v1' | 'studio_quote_snapshot.v2';
  /** New image-independent documents. Absence retains exact historical v1 rendering. */
  documentMode?: 'separate_v1';
  /** Absent on historical snapshots: preserve their exact original PDF. */
  quotePresentationVersion?: 'sanctuary-quote.v3';
  snapshotId: string;
  contentHash: string;
  designId: string;
  revision: number;
  publicationVersion: number;
  /** Historical wire name: own frozen site destination for all new Studio quotes, including manual travel. */
  travelContext?: {schemaVersion:'studio_quote_travel.v1';destinationCanonical:string};
  selections: Array<{ label: string; details: string[] }>;
  images: Array<{ kind: 'plan' | 'perspective'; dataUrl: string; sha256: string; width: number; height: number }>;
};
/** New quotes retain their own destination. Legacy unmarked quotes keep their prior fallback. */
export function studioQuoteSiteAddress(view:StudioQuoteView|undefined,legacy:string|null):string|null {
  if(!view||!Object.hasOwn(view,'travelContext'))return legacy;
  const context=view.travelContext;
  if(!context||context.schemaVersion!=='studio_quote_travel.v1'||typeof context.destinationCanonical!=='string'
    ||!context.destinationCanonical.trim()||context.destinationCanonical.length>280||Object.keys(context).sort().join(',')!=='destinationCanonical,schemaVersion')throw Error('The frozen quote destination is unavailable.');
  return context.destinationCanonical;
}
