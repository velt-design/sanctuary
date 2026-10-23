import type { ReactNode } from 'react';
import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import { ProjectCommercialDetailsSurface } from '../ProjectOverviewSurface';
import { useProjectCommercialContext } from '../../ProjectCommercialContext';
export default function ProjectCommercialDetails(props: { pending?: boolean; data: ProjectCommandCentreCurrentDesign | null; children: ReactNode }) { const {closed}=useProjectCommercialContext();return <ProjectCommercialDetailsSurface {...props} closed={closed}/>; }
