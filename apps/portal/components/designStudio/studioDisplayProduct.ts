import {websiteComposition} from '@/lib/designStudio/websiteComposition';

/** Presentation only. Retained reference geometry never becomes price authority. */
export function studioDisplayProduct(row:ReturnType<typeof websiteComposition>[number]){
  const referenceDisplay=Boolean(row.error);
  const geometryOptions=referenceDisplay&&row.reference?{supportDatumMm:row.reference.supportDatumMm}:row.geometryOptions;
  const design=row.design??(referenceDisplay?row.value?.selection:null);
  return {...row,design:design??null,geometryOptions,referenceDisplay,
    position:referenceDisplay&&row.reference?row.reference.position:row.position};
}
