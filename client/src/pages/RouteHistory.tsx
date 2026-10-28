import { useRef, useState } from "react";
import { SourceSummary, type EvidenceSource } from "@/components/Evidence";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/PageState";
import { QueryError } from "@/components/QueryError";
import {
  getRiskTextClass,
  getRiskBorderClass,
  getRiskBgClass,
  getRiskLabel,
  getRiskColor,
} from "@/lib/riskUtils";
import { cn } from "@/lib/utils";
import { History, RefreshCw, ChevronDown, ChevronUp, Route, Clock, AlertTriangle, BarChart3, TrendingUp, TrendingDown, Minus, Cpu, Database, Globe, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

// ── Sparkline component ────────────────────────────────────────────────────────
function RouteTrendSparkline({ originPort, destinationPort }: { originPort: string; destinationPort: string }) {
  const reducedMotion = useReducedMotion();
  const { data: trend, isLoading, isError, isFetching, refetch } = trpc.routes.trend.useQuery(
    { originPort, destinationPort },
    { staleTime: 30000 }
  );

  if (isLoading) {
    return (
      <div className="h-16 flex items-center justify-center">
        <div className="text-[10px] font-mono text-muted-foreground">Loading trend...</div>
      </div>
    );
  }

  if (isError) return <QueryError title="Could not load risk trend" onRetry={() => { void refetch(); }} isRetrying={isFetching} />;

  if (!trend || trend.length < 2) {
    return (
      <div className="h-16 flex items-center justify-center">
        <div className="text-[10px] font-mono text-muted-foreground">Not enough data for trend (need 2+ evaluations)</div>
      </div>
    );
  }

  // Determine trend direction
  const first = trend[0]?.overallRiskScore ?? 0;
  const last = trend[trend.length - 1]?.overallRiskScore ?? 0;
  const delta = last - first;
  const TrendIcon = delta > 5 ? TrendingUp : delta < -5 ? TrendingDown : Minus;
  const trendColor = delta > 5 ? "oklch(0.65 0.25 25)" : delta < -5 ? "oklch(0.75 0.20 145)" : "oklch(0.72 0.22 195)";
  const trendLabel = delta > 5 ? `+${delta} WORSENING` : delta < -5 ? `${delta} IMPROVING` : "STABLE";

  const chartData = trend.map((t, i) => ({
    index: i + 1,
    score: t.overallRiskScore,
    date: new Date(t.evaluatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  // Pick line color based on latest score
  const lineColor = getRiskColor(last);

  return (
    <div className="border border-border/60 rounded-sm p-3 bg-secondary/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Risk Trend</span>
          <span className="text-[9px] font-mono text-muted-foreground">{trend.length} evaluations</span>
        </div>
        <div className="flex items-center gap-1" style={{ color: trendColor }}>
          <TrendIcon className="w-3 h-3" />
          <span className="text-[10px] font-mono font-bold">{trendLabel}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={64}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`sparkGrad-${originPort}-${destinationPort}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 8, fill: "oklch(0.55 0.04 220)", fontFamily: "monospace" }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "oklch(0.55 0.04 220)", fontFamily: "monospace" }} tickLine={false} axisLine={false} ticks={[0, 30, 60, 100]} />
          <ReferenceLine y={30} stroke="oklch(0.75 0.20 145)" strokeDasharray="2 2" strokeOpacity={0.3} />
          <ReferenceLine y={60} stroke="oklch(0.60 0.28 15)" strokeDasharray="2 2" strokeOpacity={0.3} />
          <Tooltip
            contentStyle={{
              background: "oklch(0.12 0.02 220)",
              border: "1px solid oklch(0.25 0.04 220)",
              borderRadius: "2px",
              fontSize: "10px",
              fontFamily: "monospace",
              color: "oklch(0.85 0.04 220)",
              padding: "4px 8px",
            }}
            formatter={(value: number) => [value, "Risk Score"]}
            labelStyle={{ color: "oklch(0.55 0.04 220)" }}
          />
          <Area
            isAnimationActive={!reducedMotion}
            type="monotone"
            dataKey="score"
            stroke={lineColor}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${originPort}-${destinationPort})`}
            dot={{ fill: lineColor, r: 2, strokeWidth: 0 }}
            activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            style={{ filter: `drop-shadow(0 0 3px ${lineColor})` }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RouteHistory() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: history, isLoading, isError, isFetching, refetch } = trpc.routes.history.useQuery({ limit: 20 });
  const utils = trpc.useUtils();
  const rerunMutation = trpc.routes.rerun.useMutation();
  const rerunningRef = useRef(false);
  const [rerunFeedback, setRerunFeedback] = useState<{
    evaluationId: number;
    status: "pending" | "success" | "error";
    message: string;
  } | null>(null);

  const handleRerun = async (evaluationId: number) => {
    if (rerunningRef.current) return;
    rerunningRef.current = true;
    setRerunFeedback({ evaluationId, status: "pending", message: `Re-running evaluation #${evaluationId}…` });
    try {
      const result = await rerunMutation.mutateAsync({ evaluationId });
      const message = `Evaluation #${evaluationId} re-run complete — risk score ${result.overallRiskScore}/100. A new assessment was saved.`;
      setRerunFeedback({ evaluationId, status: "success", message });
      toast.success(message);
      void Promise.allSettled([utils.routes.history.invalidate(), utils.routes.trend.invalidate()]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Please try again.";
      setRerunFeedback({ evaluationId, status: "error", message: `Re-run failed: ${detail}` });
    } finally {
      rerunningRef.current = false;
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader title="Route history" icon={History} description={<>
        <p>Review saved assessments and rerun a route with current inputs.</p>
        <p className="mt-1 text-xs">{history ? `${history.length} recent evaluations shown` : isError ? "History unavailable" : "Loading history…"}</p>
      </>}>
        <button type="button" onClick={() => { void refetch(); }} aria-label="Refresh route history" disabled={isFetching} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-foreground disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
        </button>
      </PageHeader>

      {/* Summary stats */}
      {history && history.length > 0 && (
        <div className="px-6 py-4 border-b border-border shrink-0 grid grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Evaluations shown</div>
            <div className="text-xl font-display font-bold text-primary">{history.length}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Avg Risk Score</div>
            <div className="text-xl font-display font-bold" style={{ color: getRiskColor(Math.round(history.reduce((a, b) => a + b.overallRiskScore, 0) / history.length)) }}>
              {Math.round(history.reduce((a, b) => a + b.overallRiskScore, 0) / history.length)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Critical assessments</div>
            <div className="text-xl font-display font-bold text-[oklch(0.60_0.28_15)]">
              {history.filter((h) => h.overallRiskScore > 75).length}
            </div>
          </div>
        </div>
      )}

      {/* History list */}
      <div className="space-y-3 p-4 sm:p-6">
        {isError && <QueryError title="Could not load route history" onRetry={() => { void refetch(); }} isRetrying={isFetching} hasCachedData={Boolean(history)} />}
        {isLoading && <LoadingState label="Loading saved evaluations…" />}
        {!isLoading && !isError && (!history || history.length === 0) && (
          <EmptyState title="No evaluations yet" description="Analyze your first route to build a history of risk scores, supporting evidence, and alternatives.">
            <Link href="/analyze" className="inline-flex min-h-11 items-center rounded-sm border border-primary/40 px-4 text-sm text-primary hover:bg-primary/10">Analyze a route</Link>
          </EmptyState>
        )}

        {history?.map((evaluation) => {
          const isExpanded = expandedId === evaluation.id;
          const breakdown = evaluation.breakdown as { weather: number; labor: number; geopolitical: number; congestion: number };
          const altRoutes = evaluation.alternativeRoutes as { name: string; transitDays: number; riskScore: number; costImpact: string; description?: string }[] | null;
          const dataSources = evaluation.dataSources as EvidenceSource[] | null;
          const riskNarrative = evaluation.riskNarrative as string | null;
          const intelligenceSummary = evaluation.intelligenceSummary as string | null;

          return (
            <div
              key={evaluation.id}
              className={cn(
                "cyber-card border transition-colors",
                getRiskBorderClass(evaluation.overallRiskScore),
                isExpanded && getRiskBgClass(evaluation.overallRiskScore)
              )}
            >
              <div className="flex flex-wrap items-start gap-2 p-4 sm:p-5">
                <button
                  type="button"
                  id={`evaluation-toggle-${evaluation.id}`}
                  aria-label={`Details for evaluation #${evaluation.id}: ${evaluation.originPort} to ${evaluation.destinationPort}. Risk score ${evaluation.overallRiskScore} out of 100`}
                  aria-expanded={isExpanded}
                  aria-controls={`evaluation-details-${evaluation.id}`}
                  className="flex min-h-11 min-w-0 basis-full flex-1 items-start gap-3 rounded-sm text-left sm:basis-0"
                  onClick={() => setExpandedId(isExpanded ? null : evaluation.id)}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-current bg-secondary" aria-label={`Risk score ${evaluation.overallRiskScore} out of 100`} style={{color: getRiskColor(evaluation.overallRiskScore)}}>
                    <span className="text-lg font-semibold">{evaluation.overallRiskScore}</span>
                  </span>
                  <span className="min-w-0 flex-1 space-y-2">
                    <span className="block text-sm font-semibold leading-relaxed text-foreground break-words">{evaluation.originPort} → {evaluation.destinationPort}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{evaluation.baseTransitDays}d estimated transit</span>
                      <span className={cn("font-semibold", getRiskTextClass(evaluation.overallRiskScore))}>{getRiskLabel(evaluation.overallRiskScore)}</span>
                      {altRoutes && altRoutes.length > 0 && <span>{altRoutes.length} alternative{altRoutes.length === 1 ? "" : "s"}</span>}
                    </span>
                    <time className="block text-xs text-muted-foreground" dateTime={new Date(evaluation.evaluatedAt).toISOString()}>{new Date(evaluation.evaluatedAt).toLocaleString()}</time>
                  </span>
                  {isExpanded ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleRerun(evaluation.id); }}
                  aria-label={`Re-run evaluation #${evaluation.id}: ${evaluation.originPort} to ${evaluation.destinationPort}`}
                  disabled={rerunMutation.isPending}
                  className="ml-auto inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-sm border border-border px-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
                  title="Re-run with current inputs"
                ><RefreshCw className={cn("h-4 w-4", rerunFeedback?.evaluationId === evaluation.id && rerunMutation.isPending && "animate-spin")} aria-hidden="true" /><span>Re-run</span></button>
              </div>
              {rerunFeedback?.evaluationId === evaluation.id && (
                <div className="space-y-2 border-t border-border px-4 py-3 sm:px-5" role={rerunFeedback.status === "error" ? "alert" : "status"}>
                  <p className={cn("text-sm leading-relaxed", rerunFeedback.status === "error" ? "text-destructive" : "text-muted-foreground")}>{rerunFeedback.message}</p>
                  {rerunFeedback.status === "error" && <button type="button" className="min-h-11 rounded-sm border border-primary/40 px-3 text-sm text-primary hover:bg-primary/10" onClick={() => { void handleRerun(evaluation.id); }}>Retry re-run</button>}
                </div>
              )}
              <section id={`evaluation-details-${evaluation.id}`} aria-label={`Evaluation #${evaluation.id} details`} hidden={!isExpanded}>
                {isExpanded && <div className="px-4 pb-5 space-y-4 border-t border-border/50 pt-4 sm:px-5">
                  {/* Primary risk factor */}
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", getRiskTextClass(evaluation.overallRiskScore))} />
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Primary Risk Factor</div>
                      <p className="text-sm text-foreground/90">{evaluation.primaryRiskFactor}</p>
                    </div>
                  </div>

                  {/* Risk breakdown */}
                  {breakdown && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Risk Breakdown</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {Object.entries(breakdown).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <div className="text-[10px] font-mono text-muted-foreground capitalize w-20 shrink-0">{key}</div>
                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${value}%`,
                                  background: getRiskColor(value),
                                  boxShadow: `0 0 4px ${getRiskColor(value)}`,
                                }}
                              />
                            </div>
                            <span className={cn("text-[10px] font-mono font-bold w-6 text-right", getRiskTextClass(value))}>
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risk Trend Sparkline */}
                  <RouteTrendSparkline
                    originPort={evaluation.originPort}
                    destinationPort={evaluation.destinationPort}
                  />

                  {/* Alternative routes */}
                  {altRoutes && altRoutes.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Alternative Routes</div>
                      <div className="space-y-1.5">
                        {altRoutes.map((alt, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-3 text-sm p-3 bg-secondary/30 rounded-sm">
                            <span className="text-foreground/80 flex-1">{alt.name}</span>
                            <span className={cn("font-bold", getRiskTextClass(alt.riskScore))}>{alt.riskScore}/100</span>
                            <span className="text-muted-foreground">{alt.transitDays}d</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risk Narrative — full Hermes analysis */}
                  {riskNarrative && (
                    <div className="border border-border/60 rounded-sm p-3 bg-secondary/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Cpu className="w-3.5 h-3.5 text-[oklch(0.72_0.22_195)]" />
                        <span className="text-[10px] font-mono text-[oklch(0.72_0.22_195)] uppercase tracking-wider">Hermes Risk Analysis</span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{riskNarrative}</p>
                    </div>
                  )}

                  {/* Intelligence Summary — Athena's research */}
                  {intelligenceSummary && (
                    <div className="border border-border/60 rounded-sm p-3 bg-secondary/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Globe className="w-3.5 h-3.5 text-[oklch(0.80_0.20_75)]" />
                        <span className="text-[10px] font-mono text-[oklch(0.80_0.20_75)] uppercase tracking-wider">Athena Intelligence Summary</span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{intelligenceSummary}</p>
                    </div>
                  )}

                  {dataSources && dataSources.length > 0 && (
                    <div className="border border-border/60 rounded-sm p-3 bg-secondary/20">
                      <SourceSummary sources={dataSources} snapshotAt={evaluation.evaluatedAt} />
                    </div>
                  )}

                  {/* Query text */}
                  {evaluation.queryText && (
                    <div className="text-[10px] font-mono text-muted-foreground italic">
                      Query: "{evaluation.queryText}"
                    </div>
                  )}
                </div>}
              </section>
            </div>
          );
        })}
      </div>
    </div>
  );
}
