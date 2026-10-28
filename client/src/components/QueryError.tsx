import { AlertTriangle, RefreshCw } from "lucide-react";

export function QueryError({
  title,
  onRetry,
  isRetrying,
  hasCachedData = false,
}: {
  title: string;
  onRetry: () => void;
  isRetrying: boolean;
  hasCachedData?: boolean;
}) {
  return (
    <div
      role="alert"
      className="cyber-card border border-destructive/40 p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-foreground">
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <p className="font-mono text-sm font-semibold">{title}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {hasCachedData ? "Showing the last loaded data. " : ""}
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-primary/40 px-3 py-2 text-xs font-mono text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
      >
        <RefreshCw
          className={`h-3.5 w-3.5${isRetrying ? " animate-spin" : ""}`}
          aria-hidden="true"
        />
        {isRetrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}
