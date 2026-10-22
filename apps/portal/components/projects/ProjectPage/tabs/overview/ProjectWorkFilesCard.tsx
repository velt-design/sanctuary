"use client";

import { useContext, useEffect, useState, type ReactNode } from "react";
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import { ButtonLink, Card, TabNavigation } from "@/components/ui/foundation";
import { selectProjectView } from '../../projectViewNavigation';
import ProjectEnquiryReceiptPanel from "./ProjectEnquiryReceiptPanel";
import styles from "./ProjectWorkFilesCard.module.css";

export default function ProjectWorkFilesCard({
  projectId,
  host,
  children,
  className,
  positionLabel,
}: {
  projectId: string;
  host: string;
  children: ReactNode;
  className?: string;
  positionLabel?: string;
}) {
  const [selectedPanel, setSelectedPanel] = useState<"work" | "enquiry">("work");
  const auth = useContext(PortalAuthContext);
  const panelKey = auth?.user?.id ? `sanctuary:project-work-panel:v1:${host}:${auth.user.id}:${projectId}` : null;
  useEffect(() => {
    let saved: string | null = null;
    try { saved = panelKey ? sessionStorage.getItem(panelKey) : null; } catch { /* Optional return state. */ }
    setSelectedPanel(saved === 'enquiry' ? saved : 'work');
  }, [panelKey]);
  const selectPanel = (panel: "work" | "enquiry") => {
    setSelectedPanel(panel);
    try { if (panelKey) sessionStorage.setItem(panelKey, panel); } catch { /* Optional return state. */ }
  };
  return (
    <Card
      className={[styles.card, className].filter(Boolean).join(" ")}
      aria-label="Project Work"
      data-project-work-panel={selectedPanel}
      title={positionLabel ?? "Project Work"}
      eyebrow="Project position"
      action={
        <div className={styles.actions}>
        <ButtonLink href={`?tab=files`} prefetch={false} variant="quiet" size="small" onClick={(event) => { event.preventDefault(); selectProjectView('files'); }}>Open project files</ButtonLink>
        <TabNavigation
          className={styles.tabs}
          ariaLabel="Project Work sections"
          items={[
            { key: "work", label: "Work", controls: "project-work-panel" },
            { key: "enquiry", label: "Original enquiry", controls: "project-enquiry-panel" },
          ]}
          selectedKey={selectedPanel}
          onSelect={selectPanel}
        />
        </div>
      }
      padding="compact"
    >
      {selectedPanel === "enquiry" ? (
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
