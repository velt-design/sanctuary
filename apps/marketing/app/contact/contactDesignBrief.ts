import { getRoofFinish, hasSimpleRoofPrice, roofFinishDescription } from "../../components/configurator-prototype/roofFinish";
import type { PreviewSelection } from '@/components/configurator-prototype/ConfiguratorPrototype';
import type { SimpleCoverHandoff } from '@/lib/simpleCoverHandoff';

export type ContactDesignBrief = {
  roofMaterials: ('acrylic' | 'timber')[];
  label: string;
  description: string;
  dimensions: { widthM: number; depthM: number; heightM: null };
  style: 'pitched' | 'gable' | 'perimeter';
  estimate: SimpleCoverHandoff | null;
};

/** Same-page presentation handoff; commercial prices still require the server's signed reference. */
export function buildContactDesignBrief({ input, roof, result }: PreviewSelection): ContactDesignBrief {
  const finish = getRoofFinish(roof);
  const material = finish.material === 'acrylic' ? 'acrylic' : finish.material === 'solid' ? 'solid' : 'combination';
  const label = (roof.family === 'mono' ? 'Pitched acrylic pergola' : roof.family === 'gable' ? 'Gable acrylic pergola' : 'Box perimeter acrylic pergola').replace('acrylic', material);
  const connection = roof.family === 'gable' && roof.orientation === 'away'
    ? 'Dutch-gable fascia attachment'
    : `${input.connection === 'soffit' ? 'Soffit brackets' : input.connection === 'facade' ? 'Facade' : 'Fascia'} attachment`;
  const description = [
    label,
    `${(input.widthMm / 1000).toFixed(1)} m wide × ${(input.projectionMm / 1000).toFixed(1)} m projection`,
    ...(finish.material === "acrylic" ? [] : [roofFinishDescription(roof)]),
    connection,
    input.level === 'ground' ? 'Ground level' : 'Elevated',
    ...(roof.family === 'gable' ? [roof.orientation === 'parallel' ? 'Ridge parallel to house' : 'Ridge away from house', roof.infills ? 'Gable infills included' : 'Open gable ends'] : []),
  ].join(' · ');
  const priced = hasSimpleRoofPrice(roof) && result?.status === 'priced' ? result : null;
  return {
    roofMaterials: finish.material === "acrylic" ? ["acrylic"] : finish.material === "solid" ? ["timber"] : ["acrylic", "timber"],
    label, description,
    dimensions: { widthM: input.widthMm / 1000, depthM: input.projectionMm / 1000, heightM: null },
    style: roof.family === 'mono' ? 'pitched' : roof.family === 'gable' ? 'gable' : 'perimeter',
    estimate: !hasSimpleRoofPrice(roof) ? null : {
      schemaVersion: 'simple-cover-handoff.v1', input,
      status: priced ? 'priced' : result?.status === 'custom' ? 'custom' : 'unavailable',
      calculationRef: priced?.calculationRef ?? null,
      displayedPriceIncGst: priced?.price.fromIncGst ?? null,
      configurationVersion: priced?.configuration.versionNumber ?? null,
    },
  };
}
