import { describe, expect, it } from "vitest";
import { parseFrozenInvoiceEmail, redactInvoiceToken } from "./deliveryIntent";

describe("invoice delivery intent presentation boundary", () => {
  it("parses the frozen request without changing recipients or attachments", () => {
    const intent = {
      protectedPayload: {
        sentAt: "2026-07-29T02:00:00.000Z",
        tokenHash: "hash",
        tokenExpiresAt: "2026-09-04T23:59:59.999Z",
        to: ["customer@example.invalid"],
        cc: [],
        bcc: ["audit@example.invalid"],
        subject: "Deposit invoice - INV-2026-0147",
        html: '<a href="https://example.invalid/invoice/1?token=secret">View</a>',
        text: "https://example.invalid/invoice/1?token=secret",
        attachmentFileIds: ["file-1"],
        actor: "staff@example.invalid",
      },
    } as unknown as Parameters<typeof parseFrozenInvoiceEmail>[0];

    expect(parseFrozenInvoiceEmail(intent)).toEqual({
      sentAt: "2026-07-29T02:00:00.000Z",
      tokenHash: "hash",
      tokenExpiresAt: "2026-09-04T23:59:59.999Z",
      recipients: {
        to: ["customer@example.invalid"],
        cc: [],
        bcc: ["audit@example.invalid"],
      },
      subject: "Deposit invoice - INV-2026-0147",
      html: '<a href="https://example.invalid/invoice/1?token=secret">View</a>',
      text: "https://example.invalid/invoice/1?token=secret",
      attachmentFileIds: ["file-1"],
      actor: "staff@example.invalid",
    });
  });

  it("redacts only the token value from HTML and plain text previews", () => {
    expect(
      redactInvoiceToken(
        "https://example.invalid/invoice/1?token=secret&source=email",
      ),
    ).toBe("https://example.invalid/invoice/1?token=[redacted]&source=email");
    expect(
      redactInvoiceToken(
        '<a href="https://example.invalid/invoice/1?token&#x3D;secret&amp;source&#x3D;email">View</a>',
      ),
    ).toBe(
      '<a href="https://example.invalid/invoice/1?token&#x3D;[redacted]&amp;source&#x3D;email">View</a>',
    );
    expect(redactInvoiceToken(null)).toBeNull();
  });
});
