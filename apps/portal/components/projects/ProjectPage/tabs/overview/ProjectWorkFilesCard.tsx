"use client";

import { useContext, useEffect, useState, type ReactNode } from "react";
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import { selectProjectView } from '../../projectViewNavigation';
import ProjectEnquiryReceiptPanel from "./ProjectEnquiryReceiptPanel";
import { ProjectWorkFilesSurface, type OverviewControls } from "../ProjectOverviewSurface";

export function useProjectWorkPanel(projectId: string, host: string, controls?: OverviewControls) {
  const [localPanel, setLocalPanel] = useState<"work" | "enquiry">("work");
  const selectedPanel = controls?.panel ?? localPanel;
  const setSelectedPanel = controls?.setPanel ?? setLocalPanel;
  const auth = useContext(PortalAuthContext);
  const panelKey = auth?.user?.id ? `sanctuary:project-work-panel:v1:${host}:${auth.user.id}:${projectId}` : null;
  useEffect(() => {
    let saved: string | null = null;
    try { saved = panelKey ? sessionStorage.getItem(panelKey) : null; } catch { /* Optional return state. */ }
    if (controls?.edited) return;
    (controls?.adoptPanel ?? setSelectedPanel)(saved === 'enquiry' ? saved : 'work');
  }, [panelKey, controls?.edited, controls?.setPanel]);
  useEffect(()=>{if(!controls?.edited)return;try{if(panelKey)sessionStorage.setItem(panelKey,controls.panel);}catch{/* Optional return state. */}},[panelKey,controls?.edited,controls?.panel]);
  const selectPanel = (panel: "work" | "enquiry") => {
    setSelectedPanel(panel);
    try { if (panelKey) sessionStorage.setItem(panelKey, panel); } catch { /* Optional return state. */ }
  };
  return { selectedPanel, selectPanel };
}
export default function ProjectWorkFilesCard({projectId, host, children, className, positionLabel}: {
projectId:string;host:string;children:ReactNode;className?:string;positionLabel?:string;
}) { const {selectedPanel,selectPanel}=useProjectWorkPanel(projectId,host);
return <ProjectWorkFilesSurface selectedPanel={selectedPanel} selectPanel={selectPanel} onFiles={()=>selectProjectView('files')} className={className} positionLabel={positionLabel}
 enquiry={<ProjectEnquiryReceiptPanel projectId={projectId} host={host}/>}>{children}</ProjectWorkFilesSurface>; }
