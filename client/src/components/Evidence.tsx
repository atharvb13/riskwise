import {
  evidenceAge,
  observedTimestamp,
  safeSourceUrl,
  sourceKindLabel,
} from "@shared/intelligence";

export interface EvidenceSource {
  name: string;
  count: number;
  ok: boolean;
  sourceKind?: string | null;
}

function EvidenceTime({
  value,
  relative = false,
}: {
  value: unknown;
  relative?: boolean;
}) {
  const timestamp = observedTimestamp(value);
  if (!timestamp) return <span>unavailable</span>;
  const label = new Date(timestamp).toLocaleString(undefined, {
    timeZoneName: "short",
  });
  return (
    <time dateTime={timestamp} title={label}>
      {relative ? evidenceAge(timestamp) : label}
    </time>
  );
}

export function EventEvidence({
  event,
}: {
  event: {
    sourceKind?: string | null;
    sourceProvider?: string | null;
    sourceUrl?: string | null;
    observedAt?: Date | string | null;
    lastSeenAt?: Date | string | null;
  };
}) {
  const url = safeSourceUrl(event.sourceUrl);
  return (
    <div className="mt-3 border-t border-border/60 pt-3 space-y-1.5 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm border border-border px-2 py-0.5 font-mono text-foreground">
          {sourceKindLabel(event.sourceKind)}
        </span>
        <span>{event.sourceProvider || "Source metadata unavailable"}</span>
      </div>
      {event.sourceKind === "baseline" ? (
        <p>Illustrative static context; not a current disruption report.</p>
      ) : (
        <p>
          Observed: <EvidenceTime value={event.observedAt} />
        </p>
      )}
      <p>
        {event.sourceKind === "baseline"
          ? "Context loaded"
          : "Last source check"}
        : <EvidenceTime value={event.lastSeenAt} relative />
      </p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {event.sourceKind === "baseline"
            ? "Baseline definition"
            : "Source evidence"}
        </a>
      )}
    </div>
  );
}

export function SourceSummary({
  sources,
  snapshotAt,
}: {
  sources: EvidenceSource[];
  snapshotAt?: Date | string;
}) {
  return (
    <section aria-label="Intelligence sources" className="space-y-3">
      <h3 className="font-mono text-xs uppercase tracking-wider text-foreground">
        Intelligence sources
      </h3>
      {snapshotAt && (
        <p className="text-xs text-muted-foreground">
          Availability at evaluation time: <EvidenceTime value={snapshotAt} />
        </p>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sources.map((source, index) => (
          <li
            key={`${source.name}-${index}`}
            className="min-w-0 space-y-1 text-xs"
          >
            <p className="font-medium text-foreground break-words">
              {source.name}
            </p>
            <p className="text-muted-foreground">
              {sourceKindLabel(source.sourceKind)}
            </p>
            <p
              className={
                source.sourceKind === "live" && !source.ok
                  ? "text-destructive"
                  : "text-muted-foreground"
              }
            >
              {source.sourceKind === "baseline"
                ? `${source.count} baseline ${source.count === 1 ? "entry" : "entries"}`
                : source.sourceKind !== "live"
                  ? "Provenance unavailable"
                  : source.ok
                    ? `${source.count} ${source.count === 1 ? "observation" : "observations"} retrieved`
                    : "Unavailable for this evaluation"}
            </p>
          </li>
        ))}
      </ul>
      <p className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
        Static baselines are background context, not current observations.
        Source availability describes this evaluation's inputs; risk scores are
        estimates.
      </p>
    </section>
  );
}
