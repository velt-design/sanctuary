import "server-only";
import { z } from "zod";
import { providerJson } from "./boundedJson";

// One fixed GET per existing audit boundary. Graph batch carries the nested
// query in a POST body, keeping tokens and proofs out of the outgoing URL.
// Callers are concrete server adapters, never browser/model-supplied requests.
export async function metaRead(fetcher: typeof fetch, path: "debug_token" | `act_${string}`, parameters: URLSearchParams, credential: string) {
  if (path !== "debug_token" && !/^act_[1-9]\d{0,19}(\/insights)?$/.test(path)) throw new Error("Invalid Meta read target.");
  const body = new URLSearchParams({ access_token: credential, batch: JSON.stringify([
    { method: "GET", relative_url: `${path}?${parameters.toString()}` },
  ]) });
  const response = await providerJson(fetcher, "https://graph.facebook.com/v26.0/", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  // An HTTP 200 outer response can contain a failed/null inner response.
  // Do not retry, follow inner redirects, or expose provider error contents.
  try {
    const [entry] = z.array(z.object({ code: z.literal(200), body: z.string().min(1).max(65536) })).length(1).parse(response.body);
    const result: unknown = JSON.parse(entry!.body);
    if (!result || typeof result !== "object" || Array.isArray(result) || "error" in result) throw new Error();
    return { body: result, requestId: response.requestId };
  } catch {
    throw new Error("Meta read could not be confirmed.");
  }
}
