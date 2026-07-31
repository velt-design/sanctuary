"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./ProjectOverviewLayout.module.css";

const MOBILE_OVERVIEW_QUERY = "(max-width: 768px)";

function subscribeToMobileOverview(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia)
    return () => undefined;
  const media = window.matchMedia(MOBILE_OVERVIEW_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function mobileOverviewSnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.(MOBILE_OVERVIEW_QUERY).matches)
  );
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
  const mobile = useSyncExternalStore(
    subscribeToMobileOverview,
    mobileOverviewSnapshot,
    () => false,
  );
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
      className={styles.layout}
      data-project-overview-layout="true"
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
