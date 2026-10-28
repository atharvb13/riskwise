import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: ReactNode;
  icon: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-border px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Icon
            className="mt-1 h-5 w-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          </div>
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </header>
  );
}
