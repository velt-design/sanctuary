"use client";

import { lazy, Suspense, useEffect, useRef } from "react";
import type { ProjectPageSnapshot } from "@/lib/projects/types";
import type { ProjectWorkProjection } from "@/lib/projects/workItems/types";
import ProjectJourneyStatus from "@/components/projects/ProjectJourneyStatus";
import { useProjectDetailsDraft } from "../../useProjectDetailsDraft";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Input,
  KeyValueGrid,
  useUnsavedChangesGuard,
  type BadgeTone,
} from "@/components/ui/foundation";
import styles from "./ProjectOrientationBand.module.css";
import ProjectContactValue from "./ProjectContactValue";

const ProjectStageControl = lazy(() => import("./ProjectStageControl"));

export type ProjectOrientationFreshness = {
  label: string;
  detail?: string | null;
  tone?: BadgeTone;
};

export type ProjectOrientationBandProps = {
  project: ProjectPageSnapshot["project"];
  host: string;
  mode?: "overview" | "compatibility";
  operationalState?: ProjectWorkProjection["effectiveState"] | null;
  freshness?: ProjectOrientationFreshness | null;
};

export default function ProjectOrientationBand({
  project,
  host,
  mode = "overview",
  operationalState,
  freshness,
}: ProjectOrientationBandProps) {
  const {
    canRetry,
    canSave,
    displayed,
    draft,
    error,
    finishEditing,
    isEditing,
    isSaving,
    resetEditing,
    retry,
    reviewLocalDraft,
    saveCurrentDraft,
    setIsEditing,
    statusText,
    updateDraftField,
  } = useProjectDetailsDraft(project);
  useUnsavedChangesGuard(isEditing && canSave);
  const formRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (isEditing) formRef.current?.querySelector('input')?.focus({ preventScroll: true });
    else if (wasEditing.current) actionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
    wasEditing.current = isEditing;
  }, [isEditing]);

  const detailsActions = (
    <div ref={actionsRef} className={styles.detailsActions}>
      {statusText ? (
        <Badge tone={isSaving ? "info" : "neutral"}>{statusText}</Badge>
      ) : null}
      {isEditing ? (
        <>
          <Button size="small" disabled={!canSave} onClick={finishEditing}>
            Done
          </Button>
          <Button
            size="small"
            variant="tertiary"
            disabled={isSaving}
            onClick={resetEditing}
          >
            Reset
          </Button>
        </>
      ) : (
        <Button
          size="small"
          variant="tertiary"
          onClick={() => setIsEditing(true)}
        >
          Edit details
        </Button>
      )}
    </div>
  );

  const editState = (
    <>
      {error ? (
        <div className={styles.detailsNotice}>
          <AlertBanner tone="error" title="Project details could not be saved">
            {error}
            {canRetry ? (
              <div className={styles.detailsActions}>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => void retry()}
                >
                  Retry now
                </Button>
                <Button
                  size="small"
                  variant="tertiary"
                  onClick={reviewLocalDraft}
                >
                  Review changes
                </Button>
              </div>
            ) : null}
          </AlertBanner>
        </div>
      ) : null}

      {isEditing ? (
        <div ref={formRef} className={styles.detailsForm} aria-label="Edit project details">
          <Input
            id="contactName"
            label="Contact"
            value={draft.contactName}
            onChange={(event) =>
              updateDraftField("contactName", event.target.value)
            }
            onBlur={saveCurrentDraft}
          />
          <Input
            id="contactEmail"
            label="Email"
            type="email"
            value={draft.contactEmail}
            onChange={(event) =>
              updateDraftField("contactEmail", event.target.value)
            }
            onBlur={saveCurrentDraft}
          />
          <Input
            id="contactPhone"
            label="Phone"
            type="tel"
            value={draft.contactPhone}
            onChange={(event) =>
              updateDraftField("contactPhone", event.target.value)
            }
            onBlur={saveCurrentDraft}
          />
          <Input
            id="projectName"
            label="Project name"
            value={draft.projectName}
            onChange={(event) =>
              updateDraftField("projectName", event.target.value)
            }
            onBlur={saveCurrentDraft}
          />
          <Input
            id="siteAddress"
            label="Site address"
            value={draft.siteAddress}
            onChange={(event) =>
              updateDraftField("siteAddress", event.target.value)
            }
            onBlur={saveCurrentDraft}
          />
          <Input
            id="region"
            label="Region"
            value={draft.region}
            onChange={(event) => updateDraftField("region", event.target.value)}
            onBlur={saveCurrentDraft}
          />
          <Input
            id="quoteRef"
            label="Project / quote reference"
            value={draft.quoteRef}
            onChange={(event) =>
              updateDraftField("quoteRef", event.target.value)
            }
            onBlur={saveCurrentDraft}
          />
        </div>
      ) : null}
    </>
  );

  if (mode === "compatibility") {
    return (
      <Card
        title="Status & details"
        eyebrow="Project overview"
        padding="none"
        className={styles.detailsCard}
        aria-label="Project status and details"
        data-project-orientation="true"
        data-orientation-mode="compatibility"
        data-project-status-details="true"
        action={detailsActions}
      >
        <Suspense
          fallback={
            <KeyValueGrid
              items={[
                {
                  label: "Pipeline stage",
                  value: project.stage.replaceAll("_", " "),
                },
              ]}
              ariaLabel="Pipeline stage"
            />
          }
        >
          <ProjectStageControl
            projectId={project.id}
            host={host}
            stage={project.stage}
          />
        </Suspense>

        {editState}

        {!isEditing ? (
          <KeyValueGrid
            ariaLabel="Project details"
            items={[
              { label: "Contact", value: displayed.contactName || "—" },
              { label: "Email", value: displayed.contactEmail || "—" },
              { label: "Phone", value: displayed.contactPhone || "—" },
              { label: "Project name", value: displayed.projectName || "—" },
              {
                label: "Site address",
                value: displayed.siteAddress || "—",
                wide: true,
              },
              { label: "Region", value: displayed.region || "—" },
              {
                label: "Project / quote reference",
                value: displayed.quoteRef || "Not allocated",
              },
            ]}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <section
      className={styles.orientation}
      aria-label="Project orientation"
      data-project-orientation="true"
      data-orientation-mode="overview"
      data-operational-state={operationalState ?? undefined}
    >
      <header className={styles.orientationHeader}>
        <h2>Project details</h2>
        <div className={styles.overviewActions}>
          {detailsActions}
          <Suspense
            fallback={
              <Button size="small" variant="secondary" disabled>
                Change stage
              </Button>
            }
          >
            <ProjectStageControl
              projectId={project.id}
              host={host}
              stage={project.stage}
              presentation="action-only"
            />
          </Suspense>
        </div>
      </header>

      {editState}

      {!isEditing ? (
        <div className={styles.orientationSummary}>
          <ProjectJourneyStatus
            stage={project.stage}
            operationalState={operationalState}
            presentation="embedded"
            className={styles.journey}
            ariaLabel="Project journey and operational state"
            showStage={false}
          />
          <dl
            className={styles.orientationFacts}
            aria-label="Project orientation details"
          >
            <div data-context-priority="primary">
              <dt>Customer</dt>
              <dd>
                <strong>{displayed.contactName || "Not provided"}</strong>
                <ProjectContactValue label="Phone" value={displayed.contactPhone} href={displayed.contactPhone ? `tel:${displayed.contactPhone.replace(/[^\d+]/g, "")}` : undefined} />
                <ProjectContactValue label="Email" value={displayed.contactEmail} href={displayed.contactEmail ? `mailto:${displayed.contactEmail}` : undefined} />
              </dd>
            </div>
            <div data-context-priority="primary">
              <dt>Site</dt>
              <dd>
                <ProjectContactValue label="Address" value={displayed.siteAddress} href={displayed.siteAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayed.siteAddress)}` : undefined} external />
                <span>
                  {displayed.region
                    ? `Region: ${displayed.region}`
                    : "Region not provided"}
                </span>
              </dd>
            </div>
            <div data-context-priority="secondary">
              <dt>Reference</dt>
              <dd>
                <strong>{displayed.quoteRef || "Not allocated"}</strong>
              </dd>
            </div>
            <div data-context-priority="secondary">
              <dt>Freshness</dt>
              <dd>
                <span className={styles.statusRow}>
                  {freshness ? (
                    <Badge tone={freshness.tone ?? "neutral"}>
                      {freshness.label}
                    </Badge>
                  ) : (
                    <span>Freshness unavailable</span>
                  )}
                </span>
                {freshness?.detail ? <span>{freshness.detail}</span> : null}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
