import type {
  CommandCentreCostingState,
  CommandCentreDeliveryState,
  ProjectCommandCentreCurrentDesign,
} from "@/lib/projects/commandCentre/types";
import {
  AlertBanner,
  Badge,
  ButtonLink,
  Card,
  type BadgeTone,
} from "@/components/ui/foundation";
import styles from "./ProjectCurrentDesignCommercialCard.module.css";

const MONEY = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Pacific/Auckland",
});

const COSTING_LABEL: Record<CommandCentreCostingState, string> = {
  current: "Current costing",
  stored: "Stored costing",
  may_be_stale: "Stored costing may be stale",
  unavailable: "Costing unavailable",
};

const DELIVERY_LABEL: Record<CommandCentreDeliveryState, string> = {
  accepted: "Accepted",
  sent: "Sent to customer",
  failed: "Latest send failed",
  draft: "Not sent",
  not_applicable: "Not applicable",
};

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? DATE.format(date) : "Unknown";
}

function formatPrice(totalIncGstCents: number | null): string {
  return totalIncGstCents === null
    ? "Price unavailable"
    : `${MONEY.format(totalIncGstCents / 100)} inc GST`;
}

function quoteVersionLabel(data: ProjectCommandCentreCurrentDesign): string {
  if (!data.quote) return "No current quote";
  const ref = data.quote.quoteRef ?? "Quote";
  const version = data.quote.versionNumber
    ? ` v${data.quote.versionNumber}`
    : "";
  return `${ref}${version}`;
}

function badgeTone(
  tone: ProjectCommandCentreCurrentDesign["statusTone"],
): BadgeTone {
  if (tone === "accepted") return "success";
  if (tone === "declined") return "error";
  if (tone === "sent") return "warning";
  return "neutral";
}

export default function ProjectCurrentDesignCommercialCard({
  data,
  projectId,
}: {
  data: ProjectCommandCentreCurrentDesign;
  projectId?: string;
}) {
  return (
    <Card
      className={styles.card}
      aria-label="Current design and commercial summary"
      title="Current design & commercial"
      eyebrow="Commercial position"
      padding="compact"
      action={
        <Badge tone={badgeTone(data.statusTone)}>{data.statusLabel}</Badge>
      }
      data-command-centre-source={data.source}
      data-current-design-state={data.designState}
    >
      <div className={styles.stack}>
        <div className={styles.notices}>
          {data.latestDeclinedQuote ? (
            <div data-command-centre-notice="declined">
              <AlertBanner tone="info" title="Latest quote declined">
                {data.source === "estimate"
                  ? "The current design falls back to the eligible estimate."
                  : "No eligible estimate is current."}
              </AlertBanner>
            </div>
          ) : null}
          {data.newerEstimate ? (
            <div data-command-centre-notice="newer-estimate">
              <AlertBanner tone="info" title="Newer unrelated estimate">
                {data.newerEstimate.versionLabel}, saved{" "}
                {formatDate(data.newerEstimate.savedAt)}, does not replace the
                quote-controlled current design.
              </AlertBanner>
            </div>
          ) : null}
          {data.warnings.includes("source_design_unavailable") ? (
            <div data-command-centre-warning="source-design-unavailable">
              <AlertBanner tone="warning" title="Source design unavailable">
                Review the quote source before relying on design details.
              </AlertBanner>
            </div>
          ) : null}
          {data.warnings.includes("quote_price_unavailable") ? (
            <div data-command-centre-warning="quote-price-unavailable">
              <AlertBanner
                tone="warning"
                title="Stored quote price unavailable"
              >
                No estimate price has been substituted.
              </AlertBanner>
            </div>
          ) : null}
          {data.warnings.includes("estimate_price_unavailable") ? (
            <div data-command-centre-warning="estimate-price-unavailable">
              <AlertBanner tone="warning" title="Estimate price unavailable">
                Open the source design and resolve pricing issues before relying
                on a customer total.
              </AlertBanner>
            </div>
          ) : null}
          {data.warnings.includes("multiple_accepted_quotes") ? (
            <div data-command-centre-warning="multiple-accepted-quotes">
              <AlertBanner tone="warning" title="Multiple accepted versions in one quote family">
                The newest accepted version is shown; review that quote&apos;s history.
              </AlertBanner>
            </div>
          ) : null}
        </div>

        {data.source === "none" ? (
          <div className={styles.emptySummary} role="status">
            <strong>No current design</strong>
            <p>No estimate or active quote has been saved for this project.</p>
          </div>
        ) : (
          <div
            className={styles.commercialSummary}
            aria-label="Current design and commercial metrics"
          >
            <dl className={styles.decisionFacts}>
              <div data-emphasis="true">
                <dt>Customer price</dt>
                <dd>{formatPrice(data.price.totalIncGstCents)}</dd>
                <span>
                  {data.price.source === "quote"
                    ? "Stored quote total"
                    : data.price.source === "estimate"
                      ? "Quote-ready estimate total"
                      : "No price source"}
                </span>
              </div>
              <div>
                <dt>Quote</dt>
                <dd>{quoteVersionLabel(data)}</dd>
                <span>
                  {data.quote
                    ? DELIVERY_LABEL[data.quote.deliveryState]
                    : "Estimate-led project"}
                </span>
              </div>
            </dl>
            <dl className={styles.sourceFacts}>
              <div>
                <dt>Design</dt>
                <dd>
                  {data.designState === "source_unavailable"
                    ? "Source unavailable"
                    : `${data.design?.size ?? "Size not recorded"}${
                        data.design && data.design.additionalModuleCount > 0
                          ? ` + ${data.design.additionalModuleCount} more`
                          : ""
                      }`}
                </dd>
                <span>
                  {data.designState === "source_unavailable"
                    ? "The current quote source is unavailable; no other estimate has been substituted."
                    : `${data.design?.shape ?? "Shape not recorded"} · ${
                        data.design?.roofing ?? "Roofing not recorded"
                      }`}
                </span>
              </div>
              <div>
                <dt>Source estimate</dt>
                <dd>{data.estimate?.versionLabel ?? "No source estimate"}</dd>
                <span>
                  {data.estimate
                    ? `${formatDate(data.estimate.savedAt)} · ${
                        COSTING_LABEL[data.estimate.costingState]
                      }`
                    : "Source record not available"}
                </span>
              </div>
            </dl>
          </div>
        )}

        <div className={styles.links}>
          {data.links.quote ? (
            <ButtonLink variant="tertiary" size="small" href={data.links.quote}>
              View current quote
            </ButtonLink>
          ) : null}
          {data.links.estimate ? (
            <ButtonLink
              variant="tertiary"
              size="small"
              href={data.links.estimate}
            >
              View source design
            </ButtonLink>
          ) : null}
          <ButtonLink
            variant="tertiary"
            size="small"
            href={
              projectId
                ? `/staff/design-booklets?projectId=${encodeURIComponent(projectId)}`
                : "/staff/design-booklets"
            }
          >
            Open booklet workbench
          </ButtonLink>
          {!data.links.quote ? (
            <ButtonLink
              variant="tertiary"
              size="small"
              href={data.links.quotes}
            >
              View quotes
            </ButtonLink>
          ) : null}
          {!data.links.estimate ? (
            <ButtonLink
              variant="tertiary"
              size="small"
              href={data.links.designs}
            >
              View designs
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
