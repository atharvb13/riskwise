import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Map,
  Route,
  AlertTriangle,
  History,
  Shield,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  {
    path: "/map",
    label: "Map View",
    icon: Map,
    description: "Approximate routes and evidence",
  },
  {
    path: "/analyze",
    label: "Route Analyzer",
    icon: Route,
    description: "Assess a shipping route",
  },
  {
    path: "/disruptions",
    label: "Active Disruptions",
    icon: AlertTriangle,
    description: "Observations and static context",
  },
  {
    path: "/history",
    label: "Route History",
    icon: History,
    description: "Review saved assessments",
  },
];

function Sidebar({
  activePath,
  onNavigate,
  onClose,
}: {
  activePath: string;
  onNavigate: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <Shield className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-display text-lg font-bold tracking-wider text-primary">
            RISKWISE
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Maritime risk intelligence
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <nav
        aria-label="Primary"
        className="flex-1 space-y-2 overflow-y-auto px-3 py-5"
      >
        {NAV_ITEMS.map(item => (
          <Link
            key={item.path}
            href={item.path}
            onClick={onNavigate}
            aria-current={activePath === item.path ? "page" : undefined}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-sm border px-3 py-3 transition-colors",
              activePath === item.path
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.description}
              </div>
            </div>
          </Link>
        ))}
      </nav>
      <p className="border-t border-sidebar-border px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        Risk estimates support your judgment. Review the available evidence
        before acting.
      </p>
    </>
  );
}

export default function RiskWiseLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const desktopNavigationRef = useRef<HTMLElement>(null);
  const previousLocation = useRef(location);
  const activePath = location === "/" ? "/map" : location;
  const currentPage =
    NAV_ITEMS.find(item => item.path === activePath)?.label ?? "RiskWise";

  const closeNavigation = () => {
    dialogRef.current?.close();
    setSidebarOpen(false);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (sidebarOpen && window.matchMedia("(max-width: 1023px)").matches) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  }, [sidebarOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (desktop.matches && dialogRef.current?.open) {
        dialogRef.current.close();
        setSidebarOpen(false);
        desktopNavigationRef.current
          ?.querySelector<HTMLElement>('a[aria-current="page"]')
          ?.focus();
      }
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.title = `${currentPage} | RiskWise`;
    if (previousLocation.current !== location) {
      dialogRef.current?.close();
      setSidebarOpen(false);
      mainRef.current?.focus();
      if (mainRef.current) mainRef.current.scrollTop = 0;
      previousLocation.current = location;
    }
  }, [location, currentPage]);

  const navigate = () => {
    closeNavigation();
    requestAnimationFrame(() => mainRef.current?.focus());
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main-content"
        onClick={event => {
          event.preventDefault();
          mainRef.current?.focus();
          if (mainRef.current) mainRef.current.scrollTop = 0;
        }}
        className="fixed left-4 top-4 z-[100] -translate-y-[200%] rounded-sm border border-primary bg-background px-4 py-3 text-sm font-semibold text-primary focus:translate-y-0"
      >
        Skip to content
      </a>
      <aside
        ref={desktopNavigationRef}
        className="hidden h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
      >
        <Sidebar activePath={activePath} onNavigate={navigate} />
      </aside>
      <dialog
        ref={dialogRef}
        id="mobile-navigation"
        aria-labelledby="mobile-navigation-title"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-80 max-w-[90vw] border-0 border-r border-sidebar-border bg-sidebar p-0 text-foreground backdrop:bg-black/70 lg:hidden"
        onClose={() => setSidebarOpen(false)}
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          const stops = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex="0"]'
            )
          ).filter(
            element =>
              element.tabIndex >= 0 && element.getClientRects().length > 0
          );
          const first = stops[0];
          const last = stops.at(-1);
          if (event.shiftKey && document.activeElement === first && last) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === last &&
            first
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            closeNavigation();
        }}
      >
        <h2 id="mobile-navigation-title" className="sr-only">
          Navigation
        </h2>
        <div className="flex h-full flex-col">
          <Sidebar
            activePath={activePath}
            onNavigate={navigate}
            onClose={closeNavigation}
          />
        </div>
      </dialog>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/50 px-4 py-2">
          <button
            type="button"
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-controls="mobile-navigation"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="py-2 text-sm font-medium text-foreground">
            {currentPage}
          </p>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
            Maritime decision support
          </span>
        </header>
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-auto focus-visible:outline-offset-[-3px]"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
