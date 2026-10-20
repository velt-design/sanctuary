'use client';
import { useMemo } from 'react';
import { ContextSectionMesh } from '@sp/configurator/react';
import type { Assembly3D } from '@sp/geometry';
import type { StudioHouse, HouseSide } from '@/lib/designStudio/studioHouseScene';
import { studioWebsiteBrackets } from '@/lib/designStudio/studioHouseWebsiteBrackets';

export default function WebsiteConnectionDetail({house,side,assembly,pose,widthMm}:{house:StudioHouse;side:HouseSide;assembly:Assembly3D;pose:{x:number;y:number;rotation:number};widthMm:number}) {
  const sections=useMemo(()=>studioWebsiteBrackets(house,side,assembly,pose,widthMm),[house,side,assembly,pose,widthMm]);
  return <group name="website-soffit-support-detail">{sections.map(section=><ContextSectionMesh key={section.id} section={section} color="#242824"/>)}</group>;
}
