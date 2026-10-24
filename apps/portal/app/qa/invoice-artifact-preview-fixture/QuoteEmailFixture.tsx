"use client";
import { useLayoutEffect, useState } from "react";
import QuoteEmailPreviewPanel from "@/components/projects/ProjectPage/tabs/QuoteEmailPreviewPanel";
type Preview = { subject: string; html: string; text: string | null };
export default function QuoteEmailFixture({ previews }: { previews: Preview[] }) {
  const [selection, setSelection] = useState(0);
  useLayoutEffect(() => {
    const original = window.fetch, failed = new Set<string>();
    const failure = new URL(window.location.href).searchParams.get("readFailure") === "1";
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (!url.pathname.startsWith("/api/")) return original(input, init);
      if (url.pathname !== "/api/quotes/qv_progressive_fixture/preview" || init?.method !== "POST") return Response.json({ error: "Read-only fictional renderer. Commands unavailable." }, { status: 403 });
      const body = JSON.parse(String(init.body)) as { subject?: string };
      await new Promise((resolve) => setTimeout(resolve, 1400));
      if (failure && !failed.has(body.subject ?? "")) { failed.add(body.subject ?? ""); return Response.json({ error: "Synthetic preview read failed. Retry preview." }, { status: 503 }); }
      const preview = previews.find((candidate) => candidate.subject === body.subject);
      return preview ? Response.json(preview) : Response.json({ error: "Unknown fictional selection" }, { status: 400 });
    };
    return () => { window.fetch = original; };
  }, [previews]);
  return <main style={{ padding: 24 }}><h1>Quote email preview fixture</h1><p>Controlled local read1400 ms plus existing draft debounce. Exact HTML uses the delivery renderer with fictional data. All other commands are rejected. Not production timing.</p><div role="group" aria-label="Fictional quote draft">{previews.map((preview, index) => <button key={preview.subject} type="button" aria-pressed={selection === index} onClick={() => setSelection(index)}>Draft {index === 0 ? "A" : "B"}</button>)}</div><QuoteEmailPreviewPanel active quoteVersionId="qv_progressive_fixture" mode="send" to="customer@example.invalid" subject={previews[selection].subject} personalNote="" attachmentNames={[]} /></main>;
}
