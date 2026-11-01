import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";

const STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const LOAD_TIMEOUT_MS = 20000;

export interface MapViewProps {
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  onMapReady?: (map: maplibregl.Map) => void;
  onMapUnavailable?: () => void;
}

export function MapView({
  className,
  initialCenter = [20, 20],
  initialZoom = 2,
  onMapReady,
  onMapUnavailable,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onMapReady, onMapUnavailable });
  callbacksRef.current = { onMapReady, onMapUnavailable };
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    message?: string;
  }>({ status: "loading" });
  const [warning, setWarning] = useState(false);
  const [longitude, latitude] = initialCenter;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: maplibregl.Map | null = null;
    let disposed = false;
    let loaded = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setState({ status: "loading" });
    setWarning(false);
    callbacksRef.current.onMapUnavailable?.();

    const fail = (message: string) => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeout);
      callbacksRef.current.onMapUnavailable?.();
      map?.remove();
      container.replaceChildren();
      setState({ status: "error", message });
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      fail("The map display was interrupted. Retry to restore it.");
    };

    try {
      map = new maplibregl.Map({
        container,
        style: STYLE_URL,
        center: [longitude, latitude],
        zoom: initialZoom,
        attributionControl: false,
      });
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-left"
      );
      map.getCanvas().addEventListener("webglcontextlost", contextLost);
      map.on("load", () => {
        if (disposed || !map) return;
        loaded = true;
        clearTimeout(timeout);
        try {
          callbacksRef.current.onMapReady?.(map);
          setState({ status: "ready" });
        } catch {
          fail("The map could not display its route layers. Please retry.");
        }
      });
      map.on("error", event => {
        if (disposed) return;
        const hasSource = "sourceId" in event && Boolean(event.sourceId);
        const hasTile = "tile" in event && Boolean(event.tile);
        if (!loaded && !hasSource && !hasTile) {
          fail(
            "The basemap could not be loaded. Check your connection and retry."
          );
        } else setWarning(true);
      });
      timeout = setTimeout(
        () =>
          fail(
            "The map took too long to load. Check your connection and retry."
          ),
        LOAD_TIMEOUT_MS
      );
    } catch {
      fail(
        "This browser could not start the interactive map. Retry or try another browser."
      );
    }

    return () => {
      clearTimeout(timeout);
      if (map && !disposed) {
        disposed = true;
        map.getCanvas().removeEventListener("webglcontextlost", contextLost);
        map.remove();
      }
    };
  }, [attempt, longitude, latitude, initialZoom]);

  return (
    <div className={cn("relative h-[500px] w-full", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {state.status === "loading" && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-background p-6 text-sm text-muted-foreground"
        >
          Loading map…
        </div>
      )}
      {state.status === "error" && (
        <div
          role="alert"
          className="absolute inset-0 overflow-y-auto bg-background p-6 text-center"
        >
          <div className="flex min-h-full flex-col items-center justify-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Interactive map unavailable
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {state.message}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Your route and evidence details remain available in the controls
              panel.
            </p>
            <button
              type="button"
              onClick={() => setAttempt(value => value + 1)}
              className="min-h-11 rounded-sm border border-primary/40 px-4 text-sm text-primary hover:bg-primary/10"
            >
              Retry map
            </button>
          </div>
        </div>
      )}
      {state.status === "ready" && warning && (
        <div
          role="status"
          className="cyber-card absolute left-16 right-3 top-3 space-y-2 p-3 text-xs text-muted-foreground"
        >
          <p>
            Parts of the basemap could not load. Route and evidence details
            remain available.
          </p>
          <button
            type="button"
            onClick={() => setAttempt(value => value + 1)}
            className="min-h-11 rounded-sm border border-primary/40 px-3 text-sm text-primary"
          >
            Reload map
          </button>
        </div>
      )}
    </div>
  );
}
