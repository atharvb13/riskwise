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
  if (value instanceof Date) value = value.getTime();
  if ((typeof value !== "string" && typeof value !== "number") || value === "")
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function evidenceAge(value: unknown, now = Date.now()): string {
  const timestamp = observedTimestamp(value);
  if (!timestamp) return "unknown";
  const minutes = Math.floor(Math.max(0, now - Date.parse(timestamp)) / 60000);
  if (minutes === 0) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
/** MapLibre HTML popups do not receive React's automatic text escaping. */
export function escapeEvidenceHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => HTML_ENTITIES[character]
  );
}
