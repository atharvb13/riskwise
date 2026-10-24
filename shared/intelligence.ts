export const SOURCE_KINDS = ["live", "baseline", "legacy"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const EVENT_FRESHNESS_MS = 24 * 60 * 60 * 1000;

export function sourceKindLabel(kind?: string | null): string {
  return kind === "live"
    ? "Live observation"
    : kind === "baseline"
      ? "Static baseline"
      : "Unverified record";
}

/** External evidence links must be ordinary web URLs without credentials. */
export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function observedTimestamp(value: unknown): string | null {
  if ((typeof value !== "string" && typeof value !== "number") || value === "")
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
