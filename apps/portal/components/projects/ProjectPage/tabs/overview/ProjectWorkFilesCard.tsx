"use client";

import { useState, type ReactNode } from "react";
import { Card, TabNavigation } from "@/components/ui/foundation";
import ProjectEnquiryFilesPanel from "./ProjectEnquiryFilesPanel";

export default function ProjectWorkFilesCard({
  projectId,
  host,
  children,
  className,
}: {
  projectId: string;
  host: string;
  children: ReactNode;
  className?: string;
}) {
  const [selectedPanel, setSelectedPanel] = useState<"work" | "files">("work");
  return (
    <Card
      className={className}
      aria-label="Project Work"
      title="Project Work"
      eyebrow="Next project action"
      action={
        <TabNavigation
          ariaLabel="Project Work sections"
          items={[
            { key: "work", label: "Work", controls: "project-work-panel" },
            { key: "files", label: "Files", controls: "project-files-panel" },
          ]}
          selectedKey={selectedPanel}
          onSelect={setSelectedPanel}
        />
      }
      padding="compact"
    >
      {selectedPanel === "files" ? (
        <div id="project-files-panel" role="tabpanel" aria-label="Files">
          <ProjectEnquiryFilesPanel projectId={projectId} host={host} />
        </div>
      ) : (
        <div id="project-work-panel" role="tabpanel" aria-label="Work">
          {children}
        </div>
      )}
    </Card>
  );
}
