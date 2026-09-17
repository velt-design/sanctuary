"use client";

import { useState, type ReactNode } from "react";
import { Card, TabNavigation } from "@/components/ui/foundation";
import type { ProjectEnquiryAttachment } from "@/lib/projects/enquiryAttachments/types";
import ProjectEnquiryFilesPanel from "./ProjectEnquiryFilesPanel";
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
  return (
    <Card
      className={[styles.card, className].filter(Boolean).join(" ")}
      aria-label="Project Work"
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
          onSelect={setSelectedPanel}
        />
      }
      padding="compact"
    >
      {selectedPanel === "files" ? (
        <div id="project-files-panel" role="tabpanel" aria-label="Files">
          <ProjectEnquiryFilesPanel
            projectId={projectId}
            host={host}
            initialAttachments={initialAttachments}
            disableActions={disableFileActions}
          />
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
