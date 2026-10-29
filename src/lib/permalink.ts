import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { Brief } from "./types";

/**
 * Vercel functions do not share a filesystem, so a brief written to /tmp by
 * one invocation may be missing when the permalink is opened by another. The
 * permalink therefore carries a compressed copy of the brief in its query
 * string; the server copy is still preferred when it exists. The trace is
 * dropped because the printed brief never renders it.
 */
function payloadBrief(brief: Brief): Brief {
  return { ...brief, trace: [] };
}

export function encodeBrief(brief: Brief): string {
  return deflateRawSync(Buffer.from(JSON.stringify(payloadBrief(brief)), "utf8"))
    .toString("base64url");
}

export function decodeBrief(payload: string): Brief | null {
  if (!payload || payload.length > 20_000) return null;
  try {
    const json = inflateRawSync(Buffer.from(payload, "base64url"), {
      maxOutputLength: 1_000_000,
    }).toString("utf8");
    const parsed = JSON.parse(json) as Brief;
    if (
      typeof parsed?.id !== "string" ||
      typeof parsed?.question !== "string" ||
      !Array.isArray(parsed.claims) ||
      !Array.isArray(parsed.sources) ||
      !parsed.meta
    ) {
      return null;
    }
    return { ...parsed, trace: Array.isArray(parsed.trace) ? parsed.trace : [] };
  } catch {
    return null;
  }
}
