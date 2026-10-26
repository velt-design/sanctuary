"use client";

import type { ReactNode } from "react";
import styles from "./ProjectOverviewLayout.module.css";

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
      data-has-exception={
        exception !== null && exception !== undefined ? "true" : undefined
      }
      data-has-admin={
        admin !== null && admin !== undefined ? "true" : undefined
      }
      data-has-recent={
        recent !== null && recent !== undefined ? "true" : undefined
      }
    >
      <div className={styles.grid}>
        {exceptionRegion}
        <div className={styles.primary}>
          {projectWorkRegion}
          {commercialRegion}
        </div>
        <div className={styles.context}>
          {orientationRegion}
          {recentRegion}
        </div>
        {adminRegion}
      </div>
    </div>
  );
}
