import type { ReactNode } from "react";
import { Inbox, Loader2 } from "lucide-react";

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="cyber-card p-6 sm:p-8">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2
          className="h-5 w-5 shrink-0 animate-spin text-primary"
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
      <div aria-hidden="true" className="mt-5 space-y-3 animate-pulse">
        <div className="h-3 w-2/3 rounded bg-secondary" />
        <div className="h-3 w-full rounded bg-secondary" />
        <div className="h-3 w-4/5 rounded bg-secondary" />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="cyber-card flex flex-col items-center gap-3 px-5 py-10 text-center sm:py-14">
      <Inbox className="h-8 w-8 text-primary" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-2">{children}</div>}
    </section>
  );
}
