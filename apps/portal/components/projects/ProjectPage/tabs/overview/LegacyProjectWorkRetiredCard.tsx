import {
  AlertBanner,
  Badge,
  ButtonLink,
  Card,
} from "@/components/ui/foundation";
import styles from "./ProjectWorkSection.module.css";

export default function LegacyProjectWorkRetiredCard({
  reviewHref,
}: {
  reviewHref: string | null;
}) {
  return (
    <Card
      className={styles.card}
      data-project-work-section="true"
      data-project-work-model="legacy"
      data-legacy-project-work-retired="true"
      aria-label="Project Work"
      title="Project Work"
      eyebrow="Legacy tracking retired"
      padding="compact"
      action={<Badge tone="neutral">Read-only</Badge>}
    >
      <AlertBanner tone="info" title="Legacy project tasks have been retired">
        <p>
          This older project has no task or next-action controls. Its project
          details, notes, design and commercial records remain available while
          its outcome is reviewed manually.
        </p>
        {reviewHref ? (
          <div className={styles.inlineActions}>
            <ButtonLink href={reviewHref} variant="secondary">
              Review legacy projects
            </ButtonLink>
          </div>
        ) : null}
      </AlertBanner>
    </Card>
  );
}
