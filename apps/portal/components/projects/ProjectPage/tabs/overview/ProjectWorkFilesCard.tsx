"use client";

import { useContext, useEffect, useState, type ReactNode } from "react";
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import { Card, TabNavigation } from "@/components/ui/foundation";
import type { ProjectEnquiryAttachment } from "@/lib/projects/enquiryAttachments/types";
import ProjectEnquiryFilesPanel from "./ProjectEnquiryFilesPanel";
import ProjectSharePointFilesPanel from "./ProjectSharePointFilesPanel";
import ProjectEnquiryReceiptPanel from "./ProjectEnquiryReceiptPanel";
import styles from "./ProjectWorkFilesCard.module.css";

export default function ProjectWorkFilesCard({
  projectId,
  host,
  children,
  className,
  initialAttachments,
  disableFileActions = false,
  positionLabel,
}: {
  projectId: string;
  host: string;
  children: ReactNode;
  className?: string;
  initialAttachments?: ProjectEnquiryAttachment[];
  disableFileActions?: boolean;
  positionLabel?: string;
}) {
  const [selectedPanel, setSelectedPanel] = useState<"work" | "files" | "enquiry">("work");
  const auth = useContext(PortalAuthContext);
  const panelKey = auth?.user?.id ? `sanctuary:project-work-panel:v1:${host}:${auth.user.id}:${projectId}` : null;
  useEffect(() => {
    let saved: string | null = null;
    try { saved = panelKey ? sessionStorage.getItem(panelKey) : null; } catch { /* Optional return state. */ }
    setSelectedPanel(saved === 'files' || saved === 'enquiry' ? saved : 'work');
  }, [panelKey]);
  const selectPanel = (panel: "work" | "files" | "enquiry") => {
    setSelectedPanel(panel);
    try { if (panelKey) sessionStorage.setItem(panelKey, panel); } catch { /* Optional return state. */ }
  };
  const enquiryFiles = <ProjectEnquiryFilesPanel projectId={projectId} host={host} initialAttachments={initialAttachments} disableActions={disableFileActions} />;
  return (
    <Card
      className={[styles.card, className].filter(Boolean).join(" ")}
      aria-label="Project Work"
      data-project-work-panel={selectedPanel}
      title={positionLabel ?? "Project Work"}
      eyebrow="Project position"
      action={
        <TabNavigation
          className={styles.tabs}
          ariaLabel="Project Work sections"
          items={[
            { key: "work", label: "Work", controls: "project-work-panel" },
            { key: "files", label: "Files", controls: "project-files-panel" },
            { key: "enquiry", label: "Original enquiry", controls: "project-enquiry-panel" },
          ]}
          selectedKey={selectedPanel}
          onSelect={selectPanel}
        />
      }
      padding="compact"
    >
      {selectedPanel === "files" ? (
        <div id="project-files-panel" role="tabpanel" aria-label="Files">
          {disableFileActions || initialAttachments !== undefined ? enquiryFiles : <ProjectSharePointFilesPanel key={projectId} projectId={projectId} host={host} websiteFiles={enquiryFiles} />}
        </div>
      ) : selectedPanel === "enquiry" ? (
        <div id="project-enquiry-panel" role="tabpanel" aria-label="Original enquiry">
          <ProjectEnquiryReceiptPanel projectId={projectId} host={host} />
        </div>
      ) : (
        <div id="project-work-panel" role="tabpanel" aria-label="Work">
          {children}
        </div>
      )}
    </Card>
  );
}
