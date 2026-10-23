"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./ProjectPage.module.css";
export default function ProjectPageFrameSurface({ calculatorWorkspace = false, header, children }: { calculatorWorkspace?: boolean; header: ReactNode; children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const mastheadRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const frame = frameRef.current;
    const masthead = mastheadRef.current;
    if (!frame || !masthead || typeof ResizeObserver === "undefined") return;
    const update = () =>
      frame.style.setProperty(
        "--project-page-masthead-height",
        `${Math.ceil(masthead.getBoundingClientRect().height)}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(masthead);
    return () => observer.disconnect();
  }, [calculatorWorkspace]);

  return (
    <div
      ref={frameRef}
      className={`${styles.pageFrame} ${calculatorWorkspace ? styles.pageFrameCalculatorWorkspace : ""}`}
      data-project-page-frame="true"
      data-project-masthead-sticky={calculatorWorkspace ? undefined : "true"}
      data-project-calculator-workspace={calculatorWorkspace ? "true" : undefined}
    >
      {!calculatorWorkspace ? (
        <div
          ref={mastheadRef}
          className={`${styles.pageFrameMastheadSlot} ${styles.pageFrameMastheadSlotSticky}`}
          data-project-masthead-slot="fixed"
          data-project-masthead-slot-sticky="true"
        >
          {header}
        </div>
      ) : null}

      <div className={styles.pageFrameBody}>
        {children}
      </div>
    </div>
  );
}
