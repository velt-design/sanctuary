import { parseWebsiteSubmittedDesign } from "./parser";

/** Exact v3 website wire format. No geometry normalization or caller metadata. */
export function serializeWebsiteSubmittedDesign(value: unknown): string {
  const parsed = parseWebsiteSubmittedDesign(value);
  if (!parsed.ok) throw new Error(parsed.message);
  const encoded = `3~${encodeURIComponent(JSON.stringify(parsed.value))}`;
  if (encoded.length > 12000)
    throw new Error("Submitted website design cannot be shared.");
  return encoded;
}
