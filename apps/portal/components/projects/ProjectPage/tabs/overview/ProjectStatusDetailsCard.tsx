"use client";

import type { ProjectPageSnapshot } from "@/lib/projects/types";
import ProjectOrientationBand from "./ProjectOrientationBand";

/**
 * Compatibility owner for the existing details mutation fixture and focused
 * local-first tests. The Overview V2 composition mounts ProjectOrientationBand
 * directly so it can omit identity already owned by the project header.
 */
export default function ProjectStatusDetailsCard({
  project,
  host,
}: {
  project: ProjectPageSnapshot["project"];
  host: string;
}) {
  return (
    <ProjectOrientationBand
      project={project}
      host={host}
      mode="compatibility"
    />
  );
}
