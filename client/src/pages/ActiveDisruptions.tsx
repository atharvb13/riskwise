import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { EventEvidence } from "@/components/Evidence";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/PageState";
import { QueryError } from "@/components/QueryError";
import { getSeverityTextClass, getSeverityColor, getCategoryIcon, getCategoryColor } from "@/lib/riskUtils";
import { cn } from "@/lib/utils";
import { AlertTriangle, Filter, RefreshCw, MapPin } from "lucide-react";

type Category = "Weather" | "Strike" | "Geopolitical" | "Port Congestion";
type Severity = "Low" | "Medium" | "High" | "Critical";

const CATEGORIES: Category[] = ["Weather", "Strike", "Geopolitical", "Port Congestion"];
const SEVERITIES: Severity[] = ["Low", "Medium", "High", "Critical"];

export default function ActiveDisruptions() {
  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<Severity | null>(null);

  const { data: disruptions, isLoading, isError, isFetching, refetch, dataUpdatedAt } = trpc.events.active.useQuery(
    {
      category: filterCategory ?? undefined,
      severity: filterSeverity ?? undefined,
    },
    { refetchInterval: 60000 }
  );

  const liveCount = disruptions?.filter(event => event.sourceKind === "live").length ?? 0;
  const baselineCount = disruptions?.filter(event => event.sourceKind === "baseline").length ?? 0;
  const criticalCount = disruptions?.filter((d) => d.sourceKind === "live" && d.severity === "Critical").length ?? 0;
  const highCount = disruptions?.filter((d) => d.sourceKind === "live" && d.severity === "High").length ?? 0;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Active disruptions"
        icon={AlertTriangle}
        description={<>
          <p>Review source observations and static context before making route decisions.</p>
          <p className="mt-1 text-xs">{disruptions ? `Live observations: ${liveCount} · Static baselines: ${baselineCount}` : isError ? "Feed unavailable" : "Loading disruptions…"}
          {dataUpdatedAt ? ` · View refreshed ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}</p>
        </>}
      >
        {criticalCount > 0 && <span className="rounded-sm border border-destructive/50 px-3 py-2 text-xs font-semibold text-destructive">{criticalCount} CRITICAL</span>}
        {highCount > 0 && <span className="rounded-sm border border-destructive/50 px-3 py-2 text-xs font-semibold text-destructive">{highCount} HIGH</span>}
        <button type="button" onClick={() => { void refetch(); }} aria-label="Refresh disruptions" disabled={isFetching} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-foreground disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
        </button>
      </PageHeader>
      <div className="border-b border-border px-4 py-4 sm:px-6">
        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Category:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCategory(null)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-mono rounded-sm border transition-all",
                filterCategory === null
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-border/80"
              )}
            >
              ALL
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-mono rounded-sm border transition-all flex items-center gap-1",
                  filterCategory === cat
                    ? "border-opacity-60 text-foreground"
                    : "border-border text-muted-foreground hover:border-border/80"
                )}
                style={
                  filterCategory === cat
                    ? {
                        borderColor: getCategoryColor(cat),
                        background: `color-mix(in oklch, ${getCategoryColor(cat)} 12%, transparent)`,
                        color: getCategoryColor(cat),
                      }
                    : {}
                }
              >
                {getCategoryIcon(cat)} {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Severity:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterSeverity(null)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-mono rounded-sm border transition-all",
                filterSeverity === null
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-border/80"
              )}
            >
              ALL
            </button>
            {SEVERITIES.map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-mono rounded-sm border transition-all",
                  filterSeverity === sev
                    ? "text-foreground"
                    : "border-border text-muted-foreground hover:border-border/80"
                )}
                style={
                  filterSeverity === sev
                    ? {
                        borderColor: getSeverityColor(sev),
                        background: `color-mix(in oklch, ${getSeverityColor(sev)} 12%, transparent)`,
                        color: getSeverityColor(sev),
                      }
                    : {}
                }
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events list */}
      <div className="space-y-4 p-4 sm:p-6">
        {isError && <QueryError title="Could not load disruptions" onRetry={() => { void refetch(); }} isRetrying={isFetching} hasCachedData={Boolean(disruptions)} />}
        {isLoading && <LoadingState label="Loading disruption intelligence…" />}
        {!isLoading && !isError && (!disruptions || disruptions.length === 0) && (
          <EmptyState title="No matching intelligence" description={filterCategory || filterSeverity ? "Try a different category or severity, or clear your filters to see all available records." : "No records are currently available. Missing reports do not establish that a route is safe."}>
            {(filterCategory || filterSeverity) && <button type="button" className="min-h-11 rounded-sm border border-primary/40 px-4 text-sm text-primary hover:bg-primary/10" onClick={() => { setFilterCategory(null); setFilterSeverity(null); }}>Clear filters</button>}
          </EmptyState>
        )}

        {!isLoading && baselineCount > 0 && liveCount === 0 && <p role="status" className="cyber-card p-4 text-sm text-muted-foreground">No live observations are available in this view. Static baselines do not confirm current disruptions.</p>}
        {disruptions?.map((event) => {
          const locations = Array.isArray(event.affectedLocations) ? event.affectedLocations.filter((location): location is string => typeof location === "string") : [];
          const severityColor = event.sourceKind === "baseline" ? "var(--color-muted-foreground)" : getSeverityColor(event.severity);
          const categoryColor = getCategoryColor(event.category);

          return (
            <div
              key={event.id}
              className="cyber-card p-5 transition-all hover:border-border/80"
              style={{
                borderLeftWidth: "3px",
                borderLeftColor: severityColor,
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-base shrink-0 mt-0.5">{getCategoryIcon(event.category)}</span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground leading-snug break-words">{event.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm"
                        style={{ color: categoryColor, background: `color-mix(in oklch, ${categoryColor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${categoryColor} 40%, transparent)` }}
                      >
                        {event.category.toUpperCase()}
                      </span>
                      <span
                        className={cn("text-[10px] font-mono font-bold", event.sourceKind === "baseline" ? "text-muted-foreground" : getSeverityTextClass(event.severity))}
                      >
                        {event.sourceKind === "baseline" ? "BASELINE RISK: " : "● "}{event.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{event.description}</p>

              <div className="flex items-start gap-1.5">
                <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {locations.map((loc) => (
                    <span
                      key={loc}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-secondary text-muted-foreground"
                    >
                      {loc}
                    </span>
                  ))}
                </div>
              </div>

              <EventEvidence event={event} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
