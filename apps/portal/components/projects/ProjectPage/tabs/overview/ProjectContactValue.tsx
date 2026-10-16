"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import styles from "./ProjectOrientationBand.module.css";

/** Contact actions read the displayed value; they never enter the edit/save path. */
export default function ProjectContactValue({ label, value, href, external = false }: {
  label: string;
  value?: string | null;
  href?: string;
  external?: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  if (!value?.trim()) return <span>{label} not provided</span>;
  return (
    <span className={styles.contactValue}>
      {href ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{value}</a> : <span>{value}</span>}
      <button type="button" className={styles.copyButton} aria-label={`Copy ${label.toLowerCase()}`} title={`Copy ${label.toLowerCase()}`} onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopyState("copied"); }
        catch { setCopyState("failed"); }
      }}>{copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</button>
      <span role="status" className={styles.copyStatus}>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Could not copy. Select the text to copy it." : ""}</span>
    </span>
  );
}
