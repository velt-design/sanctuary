"use client";

import {
  useCallback,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import styles from "./ProjectOverviewLayout.module.css";

const MOBILE_OVERVIEW_QUERY = "(max-width: 768px)";
const COMPACT_OVERVIEW_MAX_WIDTH = 800;

function subscribeToCompactOverview(
  node: HTMLDivElement | null,
  callback: () => void,
) {
  if (typeof window === "undefined" || !window.matchMedia)
    return () => undefined;
  const media = window.matchMedia(MOBILE_OVERVIEW_QUERY);
  media.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  const observer =
    node && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(callback)
      : null;
  if (node) observer?.observe(node);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
    observer?.disconnect();
  };
}

type OverviewComposition = "wide" | "stacked" | "mobile";

function overviewCompositionSnapshot(
  node: HTMLDivElement | null,
): OverviewComposition {
  if (typeof window === "undefined") return "wide";
  if (window.matchMedia?.(MOBILE_OVERVIEW_QUERY).matches) return "mobile";
  const width = node?.getBoundingClientRect().width ?? 0;
  return width > 0 && width <= COMPACT_OVERVIEW_MAX_WIDTH
    ? "stacked"
    : "wide";
}

type ProjectOverviewLayoutProps = {
  orientation: ReactNode;
  exception?: ReactNode;
  projectWork: ReactNode;
  commercial: ReactNode;
  recent?: ReactNode;
  admin?: ReactNode;
  state?: string;
};

function Region({
  name,
  className,
  children,
}: {
  name:
    | "orientation"
    | "exception"
    | "project-work"
    | "commercial"
    | "recent"
    | "admin";
  className: string;
  children?: ReactNode;
}) {
  if (children === null || children === undefined || children === false)
    return null;

  return (
    <div className={className} data-project-overview-region={name}>
      {children}
    </div>
  );
}

export default function ProjectOverviewLayout({
  orientation,
  exception,
  projectWork,
  commercial,
  recent,
  admin,
  state,
}: ProjectOverviewLayoutProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const subscribe = useCallback(
    (callback: () => void) =>
      subscribeToCompactOverview(layoutRef.current, callback),
    [],
  );
  const composition = useSyncExternalStore(
    subscribe,
    () => overviewCompositionSnapshot(layoutRef.current),
    () => "wide" as const,
  );
  const mobile = composition === "mobile";
  const orientationRegion = (
    <Region key="orientation" name="orientation" className={styles.orientation}>
      {orientation}
    </Region>
  );
  const exceptionRegion = (
    <Region key="exception" name="exception" className={styles.exception}>
      {exception}
    </Region>
  );
  const projectWorkRegion = (
    <Region
      key="project-work"
      name="project-work"
      className={styles.projectWork}
    >
      {projectWork}
    </Region>
  );
  const commercialRegion = (
    <Region key="commercial" name="commercial" className={styles.commercial}>
      {commercial}
    </Region>
  );
  const recentRegion = (
    <Region key="recent" name="recent" className={styles.recent}>
      {recent}
    </Region>
  );
  const adminRegion = (
    <Region key="admin" name="admin" className={styles.admin}>
      {admin}
    </Region>
  );

  return (
    <div
      ref={layoutRef}
      className={styles.layout}
      data-project-overview-layout="true"
      data-overview-composition={composition}
      data-command-centre-state={state}
      data-has-admin={
        admin !== null && admin !== undefined ? "true" : undefined
      }
      data-has-recent={
        recent !== null && recent !== undefined ? "true" : undefined
      }
    >
      {mobile ? (
        <>
          {exceptionRegion}
          {projectWorkRegion}
          {commercialRegion}
          {orientationRegion}
          {recentRegion}
          {adminRegion}
        </>
      ) : (
        <>
          {orientationRegion}
          {exceptionRegion}
          {projectWorkRegion}
          {commercialRegion}
          {recentRegion}
          {adminRegion}
        </>
      )}
    </div>
  );
}
