import { createHash } from "node:crypto";

/** SHA-256 hex of a value, for privacy-preserving analytics (PRD privacy). */
export function sha256(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}
