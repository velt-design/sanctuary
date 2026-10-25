"use client";
import { useLayoutEffect, type ReactNode } from "react";
import { createProjectDesignBookletDraft } from "@/lib/designBooklets/defaults";

/** Existing gated QA route only. No draft, upload, PDF or provider command is served. */
export default function ProjectReads({ projectId, children }: { projectId: string; children: ReactNode }) {
  useLayoutEffect(() => {
    const original = window.fetch;
    const fail = new URL(window.location.href).searchParams.get("readFailure") === "1";
    let failed = false;
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (!url.pathname.startsWith("/api/")) return original(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET" || url.pathname !== `/api/staff/v1/projects/${projectId}/design-booklet`) return Response.json({ error: "Read-only fictional booklet. Commands and other sources are unavailable." }, { status: 403 });
      await new Promise((resolve) => setTimeout(resolve, 1400));
      if (fail && !failed) { failed = true; return Response.json({ error: "Synthetic booklet read failed. Retry the same source." }, { status: 503 }); }
      const name = projectId.endsWith("_b") ? "Courtyard B" : "Courtyard A";
      return Response.json({ snapshot: { project: { id: projectId, name, customerName: name, returnHref: "/qa/design-booklet-workbench-fixture" }, draft: { ...createProjectDesignBookletDraft(name), projectTitle: `${name} concept` }, revision: 1, saved: true, assets: [], updatedAt: "2026-10-22T00:00:00Z" } });
    };
    return () => { window.fetch = original; };
  }, [projectId]);
  return <>{children}</>;
}
