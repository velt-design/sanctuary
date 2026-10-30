"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import type { StudioDesignIdentity } from "@/lib/designStudio/studioDesignIdentity";
import StudioDesignHeading from "./StudioDesignHeading";
import StudioNativeLink from "./StudioNativeLink";
import css from "./StudioReview.module.css";

/** Authenticated Studio presentation only. Data and command owners stay in each stage. */
export default function StudioFlowShell({
  projectId,
  estimateId,
  identity,
  versionLabel,
  stage,
  readOnly = false,
  quoteId,
  total,
  actions,
  children,
}: {
  projectId: string;
  estimateId: string;
  identity?: StudioDesignIdentity;
  versionLabel: string;
  stage: "review" | "quote";
  readOnly?: boolean;
  quoteId?: string;
  total?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const base = `/staff/design-studio/${projectId}/${estimateId}`;
  return (
    <main className={css.flow}>
      <header className={css.flowHeader}>
        <Link
          prefetch={false}
          href={`/staff/projects/${projectId}?tab=estimates`}
          className={css.brand}
          aria-label="Sanctuary · back to project"
        >
          Sanctuary
        </Link>
        <div className={css.flowTitle}>
          <StudioDesignHeading
            identity={identity}
            versionLabel={versionLabel}
          />
        </div>
        {total && <div className={css.price}>{total}</div>}
        <div className={css.actions}>{actions}</div>
      </header>
      <nav className={css.flowNav} aria-label="Studio stages">
        {readOnly || stage === "quote" ? (
          <span title="Quoted design. Use Edit a new revision to make changes.">
            Design
          </span>
        ) : (
          <StudioNativeLink href={`${base}/edit`}>Design</StudioNativeLink>
        )}
        {stage === "quote" ? (
          <StudioNativeLink href={base}>Review &amp; quote</StudioNativeLink>
        ) : (
          <Link
            prefetch={false}
            href={base}
            aria-current={stage === "review" ? "page" : undefined}
          >
            Review &amp; quote
          </Link>
        )}
        {quoteId ? (
          <Link
            prefetch={false}
            href={`${base}?quoteVersionId=${encodeURIComponent(quoteId)}`}
            aria-current={stage === "quote" ? "page" : undefined}
          >
            Quote
          </Link>
        ) : (
          <span>Quote</span>
        )}
      </nav>
      {children}
    </main>
  );
}
