import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../test/reactHarness";
import QuoteEmailPreviewPanel from "./QuoteEmailPreviewPanel";

describe("QuoteEmailPreviewPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
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
});
