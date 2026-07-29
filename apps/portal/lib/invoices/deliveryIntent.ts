import type { CommercialEmailIntent } from "../commercial/emailIntent";

export type InvoiceRecipientLists = {
  to: string[];
  cc: string[];
  bcc: string[];
};

export type FrozenInvoiceEmail = {
  sentAt: string;
  tokenHash: string;
  tokenExpiresAt: string;
  recipients: InvoiceRecipientLists;
  subject: string;
  html: string;
  text: string | null;
  attachmentFileIds: string[];
  actor: string | null;
};

function requiredIntentString(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = payload[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Prepared invoice delivery is missing ${key}`);
  }
  return value;
}

function intentStringArray(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string[] {
  const value = payload[key];
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`Prepared invoice delivery is missing ${key}`);
  }
  return value as string[];
}

export function parseFrozenInvoiceEmail(
  intent: CommercialEmailIntent,
): FrozenInvoiceEmail {
  const payload = intent.protectedPayload;
  return {
    sentAt: requiredIntentString(payload, "sentAt"),
    tokenHash: requiredIntentString(payload, "tokenHash"),
    tokenExpiresAt: requiredIntentString(payload, "tokenExpiresAt"),
    recipients: {
      to: intentStringArray(payload, "to"),
      cc: intentStringArray(payload, "cc"),
      bcc: intentStringArray(payload, "bcc"),
    },
    subject: requiredIntentString(payload, "subject"),
    html: requiredIntentString(payload, "html"),
    text: typeof payload.text === "string" ? payload.text : null,
    attachmentFileIds: intentStringArray(payload, "attachmentFileIds"),
    actor: typeof payload.actor === "string" ? payload.actor : null,
  };
}

export function redactInvoiceToken(value: string | null): string | null {
  if (typeof value !== "string") return value;
  return value.replace(
    /((?:[?&]|&amp;)token(?:=|&#x3d;|&#61;|%3d))[^&\s"'<>]+/gi,
    "$1[redacted]",
  );
}
