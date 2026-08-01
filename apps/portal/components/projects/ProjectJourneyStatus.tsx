import { Badge, type BadgeTone } from "@/components/ui/foundation";
import { resolveProjectJourney } from "@/lib/projects/projectJourney";
import type { ProjectEffectiveState } from "@/lib/types/project";
import styles from "./ProjectJourneyStatus.module.css";

const OPERATIONAL_STATE_PRESENTATION = {
  ACTIVE: { label: "Active", tone: "neutral" },
  WAITING: { label: "Waiting", tone: "warning" },
  CLOSED: { label: "Closed", tone: "neutral" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
} as const satisfies Record<
  ProjectEffectiveState,
  { label: string; tone: BadgeTone }
>;

function classes(...values: Array<string | null | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export default function ProjectJourneyStatus({
  stage,
  operationalState,
  presentation = "panel",
  className,
  ariaLabel = "Project journey and status",
  showStage = true,
}: {
  stage: unknown;
  operationalState?: ProjectEffectiveState | null;
  presentation?: "panel" | "embedded";
  className?: string;
  ariaLabel?: string;
  showStage?: boolean;
}) {
  const journey = resolveProjectJourney(stage);
  const state = operationalState
    ? OPERATIONAL_STATE_PRESENTATION[operationalState]
    : null;

  return (
    <section
      className={classes(styles.summary, className)}
      aria-label={ariaLabel}
      data-project-journey-status="true"
      data-project-journey-known={String(journey.knownStage)}
      data-project-journey-phase={journey.phase ?? undefined}
      data-project-stage={journey.stage ?? undefined}
      data-project-operational-state={operationalState ?? undefined}
      data-has-operational-state={state ? "true" : "false"}
      data-has-stage={showStage ? "true" : "false"}
      data-presentation={presentation}
    >
      <dl className={styles.facts}>
        <div>
          <dt>Journey</dt>
          <dd>{journey.phaseLabel}</dd>
        </div>
        {showStage ? (
          <div>
            <dt>Stage</dt>
            <dd>{journey.stageLabel}</dd>
          </div>
        ) : null}
        {state ? (
          <div>
            <dt>Operational state</dt>
            <dd>
              <Badge tone={state.tone}>{state.label}</Badge>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
