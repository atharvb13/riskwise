import { useState, useCallback, useRef, useEffect } from "react";
import type { Feature, FeatureCollection, Point, LineString } from "geojson";
import maplibregl from "maplibre-gl";
import { MapView as LibreMap } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { getRiskColor, getSeverityColor, getCategoryIcon } from "@/lib/riskUtils";
import { AlertTriangle, Layers, Eye, EyeOff, RefreshCw, Loader2 } from "lucide-react";
import { getPortCoordinates } from "@shared/ports";
import { escapeEvidenceHtml } from "@shared/intelligence";
import { cn } from "@/lib/utils";

// ── Coordinate lookups ───────────────────────────────────────────────────────

const DISRUPTION_COORDS: Record<string, [number, number]> = {
  "Suez Canal": [32.3, 30.5],
  "Red Sea": [38.0, 20.0],
  "South China Sea": [115.0, 15.0],
  "Panama Canal": [-79.5, 9.0],
  "Taiwan Strait": [119.5, 24.0],
  "Singapore Strait": [104.0, 1.2],
  "Strait of Hormuz": [56.5, 26.5],
  "North Atlantic Ocean": [-35.0, 45.0],
  "Malacca Strait": [101.0, 3.0],
  "Persian Gulf": [52.0, 26.0],
  "Bab-el-Mandeb Strait": [43.5, 12.5],
  "East China Sea": [125.0, 28.0],
  "Gulf of Panama": [-79.0, 8.5],
  "Caribbean Sea": [-75.0, 15.0],
  "North Sea": [3.0, 56.0],
  "Korea Strait": [129.0, 34.5],
  "Yellow Sea": [123.0, 35.0],
};

// ── Source/layer IDs ─────────────────────────────────────────────────────────

const SRC = {
  baseRoutes: "base-routes",
  evalRoutes: "eval-routes",
  disruptions: "disruptions",
} as const;

const LAYER = {
  baseLines: "base-routes-line",
  evalLines: "eval-routes-line",
  disruptionZones: "disruption-zones",
  disruptionPoints: "disruption-points",
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

type RiskEvent = {
  id: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  affectedLocations: unknown;
};

type RouteRecord = {
  id: number;
  waypoints: unknown;
};

type EvalRecord = {
  originPort: string;
  destinationPort: string;
  overallRiskScore: number;
};

function buildBaseRouteGeoJSON(routes: RouteRecord[]): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: routes.flatMap((route) => {
      const wp = route.waypoints as [number, number][];
      if (!wp || wp.length < 2) return [];
      const f: Feature<LineString> = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: wp },
        properties: {},
      };
      return [f];
    }),
  };
}

function buildEvalRouteGeoJSON(history: EvalRecord[]): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: history.flatMap((ev) => {
      const origin = getPortCoordinates(ev.originPort);
      const dest = getPortCoordinates(ev.destinationPort);
      if (!origin || !dest) return [];
      const f: Feature<LineString> = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [origin, dest] },
        properties: { color: getRiskColor(ev.overallRiskScore) },
      };
      return [f];
    }),
  };
}

function buildDisruptionGeoJSON(events: RiskEvent[]): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  events.forEach((ev) => {
    const locations = ev.affectedLocations as string[];
    locations.forEach((loc) => {
      const coord = getPortCoordinates(loc) ?? DISRUPTION_COORDS[loc];
      if (!coord) return;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coord },
        properties: {
          id: ev.id,
          title: ev.title,
          description: ev.description,
          category: ev.category,
          severity: ev.severity,
          color: getSeverityColor(ev.severity),
          radius: ev.severity === "Critical" ? 14 : ev.severity === "High" ? 10 : 7,
        },
      });
    });
  });
  return { type: "FeatureCollection", features };
}

function popupHTML(props: Record<string, string>) {
  const color = getSeverityColor(props.severity);
  return `
    <div style="
      background: #0d1a2a;
      border: 1px solid ${color}55;
      border-radius: 6px;
      padding: 14px 16px;
      max-width: 280px;
      min-width: 220px;
      font-family: 'Share Tech Mono', monospace;
      color: #c8dce8;
    ">
      <div style="color:${color};font-size:10px;letter-spacing:2px;margin-bottom:6px;text-transform:uppercase;">
        ${getCategoryIcon(props.category)} ${escapeEvidenceHtml(props.category)}
      </div>
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:#e8f4f8;line-height:1.3;">
        ${escapeEvidenceHtml(props.title)}
      </div>
      <div style="font-size:11px;color:#7a9ab0;line-height:1.6;margin-bottom:10px;">
        ${escapeEvidenceHtml((props.description ?? "").slice(0, 130))}${(props.description ?? "").length > 130 ? "…" : ""}
      </div>
      <span style="
        display:inline-block;
        background:${color}22;
        border:1px solid ${color}55;
        border-radius:3px;
        padding:2px 8px;
        font-size:10px;
        color:${color};
        letter-spacing:1.5px;
        text-transform:uppercase;
      ">● SEVERITY: ${escapeEvidenceHtml(props.severity)}</span>
    </div>`;
}

// ── Source/layer setup on first map load ─────────────────────────────────────

function initLayers(map: maplibregl.Map) {
  const emptyFC = { type: "FeatureCollection" as const, features: [] };

  map.addSource(SRC.baseRoutes, { type: "geojson", data: emptyFC });
  map.addSource(SRC.evalRoutes, { type: "geojson", data: emptyFC });
  map.addSource(SRC.disruptions, { type: "geojson", data: emptyFC });

  map.addLayer({
    id: LAYER.baseLines,
    type: "line",
    source: SRC.baseRoutes,
    paint: { "line-color": "#1e4a7a", "line-opacity": 0.4, "line-width": 1.5 },
  });

  map.addLayer({
    id: LAYER.evalLines,
    type: "line",
    source: SRC.evalRoutes,
    paint: {
      "line-color": ["get", "color"],
      "line-opacity": 0.85,
      "line-width": 3,
    },
  });

  map.addLayer({
    id: LAYER.disruptionZones,
    type: "circle",
    source: SRC.disruptions,
    paint: {
      "circle-color": ["get", "color"],
      "circle-opacity": 0.08,
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-opacity": 0.5,
      "circle-stroke-width": 1.5,
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        2, ["*", ["get", "radius"], 3],
        6, ["*", ["get", "radius"], 8],
      ],
    },
  });

  map.addLayer({
    id: LAYER.disruptionPoints,
    type: "circle",
    source: SRC.disruptions,
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["get", "radius"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.95,
    },
  });
}

function setSourceData(
  map: maplibregl.Map,
  id: string,
  data: FeatureCollection
) {
  const src = map.getSource(id);
  if (src && src.type === "geojson") {
    (src as maplibregl.GeoJSONSource).setData(data);
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MapView() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const layersInitRef = useRef(false);

  const [showRoutes, setShowRoutes] = useState(true);
  const [showDisruptions, setShowDisruptions] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const { data: disruptions, isLoading: disruptionsLoading, refetch } =
    trpc.events.active.useQuery(undefined, { refetchInterval: 60000 });
  const { data: routes, isLoading: routesLoading } =
    trpc.routes.allRoutes.useQuery();
  const { data: history } = trpc.routes.history.useQuery({ limit: 5 });

  const isLoading = disruptionsLoading || routesLoading;

  // Push updated GeoJSON into sources whenever data or visibility changes
  const syncLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !layersInitRef.current) return;

    const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
    setSourceData(map, SRC.baseRoutes, showRoutes && routes ? buildBaseRouteGeoJSON(routes) : empty);
    setSourceData(map, SRC.evalRoutes, showRoutes && history ? buildEvalRouteGeoJSON(history) : empty);
    setSourceData(map, SRC.disruptions, showDisruptions && disruptions ? buildDisruptionGeoJSON(disruptions) : empty);
  }, [routes, history, disruptions, showRoutes, showDisruptions]);

  useEffect(() => { syncLayers(); }, [syncLayers]);

  const handleMapReady = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    initLayers(map);
    layersInitRef.current = true;
    setMapReady(true);

    // Popup on disruption point click
    map.on("click", LAYER.disruptionPoints, (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = feature.properties as Record<string, string>;
      const coords = (feature.geometry as Point).coordinates as [number, number];

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        className: "riskwise-popup",
        maxWidth: "300px",
      })
        .setLngLat(coords)
        .setHTML(popupHTML(props))
        .addTo(map);
    });

    map.on("mouseenter", LAYER.disruptionPoints, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER.disruptionPoints, () => {
      map.getCanvas().style.cursor = "";
    });
  }, []);

  // Sync after map ready (data may arrive before or after)
  useEffect(() => {
    if (mapReady) syncLayers();
  }, [mapReady, syncLayers]);

  const handleToggleRoutes = () => setShowRoutes((v) => !v);
  const handleToggleDisruptions = () => setShowDisruptions((v) => !v);
  const handleRefresh = () => refetch();

  return (
    <div className="relative h-full w-full">
      <LibreMap
        onMapReady={handleMapReady}
        initialCenter={[20, 20]}
        initialZoom={2.5}
        className="w-full h-full"
      />

      {/* Loading overlay */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.08_0.02_240)] z-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-xs font-mono text-primary/70 tracking-widest">
              LOADING MAP...
            </span>
          </div>
        </div>
      )}

      {/* Data loading indicator */}
      {isLoading && mapReady && (
        <div className="absolute top-4 left-16 cyber-card px-3 py-2 z-10 flex items-center gap-2">
          <Loader2 className="w-3 h-3 text-primary animate-spin" />
          <span className="text-xs font-mono text-primary">ATHENA SCANNING...</span>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <div className="cyber-card p-3 space-y-2 min-w-[180px]">
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            Map Layers
          </div>
          <button
            onClick={handleToggleRoutes}
            className={cn(
              "flex items-center gap-2 text-xs font-mono w-full px-2 py-1.5 rounded-sm transition-all",
              showRoutes
                ? "text-[oklch(0.72_0.22_195)] bg-[oklch(0.72_0.22_195/0.1)] border border-[oklch(0.72_0.22_195/0.3)]"
                : "text-muted-foreground border border-border"
            )}
          >
            {showRoutes ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Shipping Routes
          </button>
          <button
            onClick={handleToggleDisruptions}
            className={cn(
              "flex items-center gap-2 text-xs font-mono w-full px-2 py-1.5 rounded-sm transition-all",
              showDisruptions
                ? "text-[oklch(0.65_0.25_25)] bg-[oklch(0.65_0.25_25/0.1)] border border-[oklch(0.65_0.25_25/0.3)]"
                : "text-muted-foreground border border-border"
            )}
          >
            {showDisruptions ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Disruptions
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 text-xs font-mono w-full px-2 py-1.5 rounded-sm text-muted-foreground border border-border hover:text-foreground transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        <div className="cyber-card p-3 min-w-[180px]">
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-3">
            Risk Legend
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Low (0–30)", color: "oklch(0.75 0.20 145)" },
              { label: "Moderate (31–60)", color: "oklch(0.80 0.20 75)" },
              { label: "High / Critical (61+)", color: "oklch(0.65 0.25 25)" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                />
                <span className="text-[11px] font-mono text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alert count */}
      {disruptions && disruptions.length > 0 && (
        <div className="absolute bottom-4 left-4 cyber-card px-4 py-2 flex items-center gap-2 z-10">
          <AlertTriangle className="w-4 h-4 text-[oklch(0.65_0.25_25)] neon-pulse" />
          <span className="text-sm font-mono">
            <span className="text-[oklch(0.65_0.25_25)] font-bold">
              {disruptions.filter(
                (d) => d.severity === "Critical" || d.severity === "High"
              ).length}
            </span>
            <span className="text-muted-foreground"> critical/high alerts active</span>
          </span>
        </div>
      )}
    </div>
  );
}
