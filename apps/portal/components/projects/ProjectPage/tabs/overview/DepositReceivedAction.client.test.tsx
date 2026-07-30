import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import DepositReceivedAction from "./DepositReceivedAction.client";

describe("DepositReceivedAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T14:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("records the deposit through the authoritative staff action", async () => {
    const onRecorded = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const rendered = renderIntoDocument(
      <DepositReceivedAction projectId="proj_123" onRecorded={onRecorded} />,
    );
    let button = rendered.container.querySelector("button") as HTMLButtonElement;

    act(() => button.click());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rendered.container.textContent).toContain("Record deposit received?");

    button = Array.from(rendered.container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === "Confirm deposit received",
    ) as HTMLButtonElement;
    await act(async () => button.click());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff/v1/projects/proj_123/action/mark_deposit_received",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ paidDate: "2026-07-30" }),
      }),
    );
    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(rendered.container.textContent).toContain("Deposit recorded");
    rendered.unmount();
  });

  it("keeps the action available and shows the server error when recording fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Invalid stage transition" }), {
          status: 409,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const rendered = renderIntoDocument(
      <DepositReceivedAction projectId="proj_123" onRecorded={vi.fn()} />,
    );
    let button = rendered.container.querySelector("button") as HTMLButtonElement;

    act(() => button.click());
    button = Array.from(rendered.container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === "Confirm deposit received",
    ) as HTMLButtonElement;
    await act(async () => button.click());

    expect(rendered.container.textContent).toContain("Deposit not recorded");
    expect(rendered.container.textContent).toContain("Invalid stage transition");
    expect(button.disabled).toBe(false);
    rendered.unmount();
  });
});
