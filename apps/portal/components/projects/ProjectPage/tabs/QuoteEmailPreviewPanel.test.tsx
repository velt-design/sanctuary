import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../test/reactHarness";
import QuoteEmailPreviewPanel from "./QuoteEmailPreviewPanel";

describe("QuoteEmailPreviewPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        Response.json({
          subject: "Quote ready - Q-1001 v1",
          html: "<!doctype html><html><body>Rendered email</body></html>",
          text: "Rendered plain text",
        }),
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("loads the delivery renderer and exposes desktop, narrow, and text previews", async () => {
    const rendered = renderIntoDocument(
      <QuoteEmailPreviewPanel
        active
        quoteVersionId="qv_1"
        mode="send"
        to="taylor@example.com"
        subject="Quote ready - Q-1001"
        personalNote="Thanks Taylor"
        attachmentNames={["Planning set.pdf"]}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/quotes/qv_1/preview",
      expect.objectContaining({ method: "POST" }),
    );
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({
        mode: "send",
        to: ["taylor@example.com"],
        personalNote: "Thanks Taylor",
        attachmentNames: ["Planning set.pdf"],
      }),
    );

    const frame = rendered.container.querySelector("iframe");
    expect(frame?.getAttribute("srcdoc")).toContain("Rendered email");

    const textTab = Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((button) => button.textContent === "Plain text");
    act(() => {
      textTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(rendered.container.querySelector("pre")?.textContent).toBe(
      "Rendered plain text",
    );

    rendered.unmount();
  });
  it("keeps the actual viewport while draft identity changes, ignores old reads and recovers", async () => {
    const props = { active: true, quoteVersionId: "qv_1", mode: "send" as const, to: "staff@example.invalid", subject: "First", personalNote: "", attachmentNames: [] };
    const view = renderIntoDocument(<QuoteEmailPreviewPanel {...props} />);
    const frame = view.container.querySelector("iframe")!;
    const tabs = view.container.querySelector('[role="tablist"]');
    expect(frame.getAttribute("srcdoc")).toBeNull();
    expect(view.container.textContent).toContain("Reading…");
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(frame.srcdoc).toContain("Rendered email");
    let resolveOld!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    view.rerender(<QuoteEmailPreviewPanel {...props} subject="Second" />);
    expect(view.container.querySelector("iframe")).toBe(frame);
    expect(frame.getAttribute("srcdoc")).toBeNull();
    expect(view.container.textContent).not.toContain("Quote ready - Q-1001 v1");
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "Read failed" }, { status: 503 }));
    view.rerender(<QuoteEmailPreviewPanel {...props} subject="Third" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); resolveOld(Response.json({ subject: "Stale", html: "STALE", text: "stale" })); });
    expect(frame.getAttribute("srcdoc")).toBeNull();
    expect(view.container.textContent).toContain("Read failed");
    expect(view.container.textContent).not.toContain("Stale");
    const retry = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent === "Retry preview")!;
    act(() => retry.click());
    expect(view.container.textContent).toContain("Reading…");
    expect(view.container.textContent).not.toContain("Read failed");
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(view.container.querySelector("iframe")).toBe(frame);
    expect(view.container.querySelector('[role="tablist"]')).toBe(tabs);
    expect(frame.srcdoc).toContain("Rendered email");
    view.unmount();
  });

});
