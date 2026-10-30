import type { StudioCreateCommand } from './createCommand';
export function makeWebsiteFacadeCommand(): Extract<StudioCreateCommand, {schemaVersion:'studio_create.v4'}> {
  return {
    schemaVersion:'studio_create.v4', requestId:'40000000-0000-4000-8000-000000000001', mode:'website',
    sourceEstimateId:'est_20000000-0000-4000-8000-000000000001', expectedUpdatedAt:'2026-09-25T00:00:00.123456Z', expectedRevision:0,
    hostSource:{estimateId:'est_60000000-0000-4000-8000-000000000001',expectedUpdatedAt:'2026-09-25T00:00:01.654321Z',expectedDesignId:'host-design',expectedRevision:3,houseFormId:'house',wallId:'registry-wall'},
    enrichment:{family:'mono',connection:'facade_ledger',sourceConnectionConfirmed:true,houseGeometryReviewed:true,heightM:'2.800',pitchDeg:'5',postCount:'4',postConnectionType:'slab_anchors',ground:'easy',ledgerProfile:'150x50',rafterProfile:'150x50',postProfile:'100x100',position:{originXMm:'1000',originYMm:'0',rotationDeg:'0'},myEdgeIndex:0},
  };
}
