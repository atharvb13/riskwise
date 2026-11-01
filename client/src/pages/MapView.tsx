import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { FeatureCollection, Point } from "geojson";
import maplibregl from "maplibre-gl";
import { Link } from "wouter";
import { MapView as LibreMap } from "@/components/Map";
import { useRouteMap } from "@/contexts/RouteMapContext";
import { makeRouteSelection, routeBounds } from "@/lib/routeSelection";
import { trpc } from "@/lib/trpc";
import { getCategoryIcon } from "@/lib/riskUtils";
import {
  buildBaseRouteGeoJSON,
  buildEvalRouteGeoJSON,
  buildSelectedRouteGeoJSON,
  buildDisruptionGeoJSON,
  getMapSeverityColor,
} from "@/lib/mapData";
import { escapeEvidenceHtml } from "@shared/intelligence";

const SRC = {
  baseRoutes: "base-routes",
  evalRoutes: "eval-routes",
  selectedRoutes: "selected-routes",
  disruptions: "disruptions",
} as const;
const LAYER = {
  baseLines: "base-routes-line",
  evalLines: "eval-routes-line",
  selectedLines: "selected-routes-line",
  disruptionZones: "disruption-zones",
  disruptionPoints: "disruption-points",
} as const;

function popupHTML(props: Record<string, string>) {
  const color = getMapSeverityColor(props.severity);
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
  map.addSource(SRC.selectedRoutes, { type: "geojson", data: emptyFC });
  map.addSource(SRC.disruptions, { type: "geojson", data: emptyFC });

  map.addLayer({
    id: LAYER.baseLines,
    type: "line",
    source: SRC.baseRoutes,
    paint: {
      "line-color": "#426d96",
      "line-opacity": 0.7,
      "line-width": 1.5,
      "line-dasharray": [3, 2],
    },
  });

  map.addLayer({
    id: LAYER.evalLines,
    type: "line",
    source: SRC.evalRoutes,
    paint: {
      "line-color": ["get", "color"],
      "line-opacity": 0.85,
      "line-width": 3,
      "line-dasharray": [3, 2],
    },
  });

  map.addLayer({
    id: LAYER.selectedLines,
    type: "line",
    source: SRC.selectedRoutes,
    paint: {
      "line-color": ["get", "color"],
      "line-opacity": ["case", ["get", "selected"], 1, 0.3],
      "line-width": ["case", ["get", "selected"], 5, 2],
      "line-dasharray": [3, 2],
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
        "interpolate",
        ["linear"],
        ["zoom"],
        2,
        ["*", ["get", "radius"], 3],
        6,
        ["*", ["get", "radius"], 8],
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

export default function MapView() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showDisruptions, setShowDisruptions] = useState(true);
  const {
    selection,
    selectedOptionId,
    showRoute,
    selectOption,
    clearSelection,
  } = useRouteMap();
  const eventsQuery = trpc.events.active.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const routesQuery = trpc.routes.allRoutes.useQuery();
  const historyQuery = trpc.routes.history.useQuery({ limit: 5 });
  const { data: disruptions } = eventsQuery;
  const { data: routes } = routesQuery;
  const { data: history } = historyQuery;
  const baseData = useMemo(() => buildBaseRouteGeoJSON(routes ?? []), [routes]);
  const historyData = useMemo(
    () => buildEvalRouteGeoJSON(history ?? []),
    [history]
  );
  const selectedData = useMemo(
    () => buildSelectedRouteGeoJSON(selection, selectedOptionId),
    [selection, selectedOptionId]
  );
  const disruptionData = useMemo(
    () => buildDisruptionGeoJSON(disruptions ?? []),
    [disruptions]
  );
  const selectedOption = selection?.options.find(
    option => option.id === selectedOptionId
  );
  const omittedConnections =
    (routes?.length ?? 0) -
    baseData.features.length +
    (history?.length ?? 0) -
    historyData.features.length;
  const isLoading =
    eventsQuery.isLoading || routesQuery.isLoading || historyQuery.isLoading;
  const isRefreshing =
    eventsQuery.isFetching || routesQuery.isFetching || historyQuery.isFetching;

  const handleMapReady = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    initLayers(map);
    setMapInstance(map);
    map.on("click", LAYER.disruptionPoints, event => {
      const feature = event.features?.[0];
      if (!feature) return;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        className: "riskwise-popup",
        maxWidth: "300px",
      })
        .setLngLat((feature.geometry as Point).coordinates as [number, number])
        .setHTML(popupHTML(feature.properties as Record<string, string>))
        .addTo(map);
    });
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    const empty: FeatureCollection = {
      type: "FeatureCollection",
      features: [],
    };
    setSourceData(mapInstance, SRC.baseRoutes, showRoutes ? baseData : empty);
    setSourceData(
      mapInstance,
      SRC.evalRoutes,
      showRoutes ? historyData : empty
    );
    setSourceData(
      mapInstance,
      SRC.selectedRoutes,
      showRoutes ? selectedData : empty
    );
    setSourceData(
      mapInstance,
      SRC.disruptions,
      showDisruptions ? disruptionData : empty
    );
  }, [
    mapInstance,
    baseData,
    historyData,
    selectedData,
    disruptionData,
    showRoutes,
    showDisruptions,
  ]);

  useEffect(() => {
    if (!mapInstance) return;
    const chooseHistory = (event: maplibregl.MapLayerMouseEvent) => {
      if (
        mapInstance.queryRenderedFeatures(event.point, {
          layers: [LAYER.selectedLines],
        }).length
      )
        return;
      const record = history?.find(
        row => row.id === Number(event.features?.[0]?.properties?.evaluationId)
      );
      if (record) showRoute(makeRouteSelection(record));
    };
    const chooseOption = (event: maplibregl.MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.optionId;
      if (typeof id === "string") selectOption(id);
    };
    mapInstance.on("click", LAYER.evalLines, chooseHistory);
    mapInstance.on("click", LAYER.selectedLines, chooseOption);
    return () => {
      mapInstance.off("click", LAYER.evalLines, chooseHistory);
      mapInstance.off("click", LAYER.selectedLines, chooseOption);
    };
  }, [mapInstance, history, showRoute, selectOption]);

  const fitSelected = useCallback(() => {
    const bounds = selectedOption && routeBounds(selectedOption.waypoints);
    if (mapInstance && bounds)
      mapInstance.fitBounds(bounds, {
        padding: 40,
        maxZoom: 6,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 700,
      });
  }, [mapInstance, selectedOption]);
  useEffect(() => {
    fitSelected();
  }, [fitSelected]);

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row lg:overflow-hidden">
      <h1 className="sr-only">Maritime risk map</h1>
      <section
        aria-label="Route map"
        className="relative h-[55dvh] min-h-[320px] shrink-0 lg:h-full lg:min-h-0 lg:flex-1"
      >
        <LibreMap
          onMapReady={handleMapReady}
          initialCenter={[20, 20]}
          initialZoom={2.5}
          className="h-full w-full"
        />
        {!mapInstance && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center bg-background text-sm text-muted-foreground"
          >
            Loading map…
          </div>
        )}
      </section>
      <aside
        aria-label="Map controls and details"
        className="space-y-5 border-t border-border p-4 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
      >
        <section aria-label="Map layers" className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            Map layers
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={showRoutes}
              onClick={() => setShowRoutes(value => !value)}
              className="min-h-11 rounded-sm border border-border px-3 text-sm text-primary"
            >
              Route connections
            </button>
            <button
              type="button"
              aria-pressed={showDisruptions}
              onClick={() => setShowDisruptions(value => !value)}
              className="min-h-11 rounded-sm border border-border px-3 text-sm text-primary"
            >
              Disruptions
            </button>
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => {
                void Promise.allSettled([
                  eventsQuery.refetch(),
                  routesQuery.refetch(),
                  historyQuery.refetch(),
                ]);
              }}
              className="min-h-11 rounded-sm border border-border px-3 text-sm text-primary disabled:opacity-50"
            >
              {isRefreshing ? "Refreshing…" : "Refresh map data"}
            </button>
          </div>
          {isLoading && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading map data…
            </p>
          )}
        </section>
        <section aria-label="Selected assessment" className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Selected assessment
          </h2>
          {selection ? (
            <>
              <p className="break-words text-sm text-foreground">
                {selection.originPort} → {selection.destinationPort}
              </p>
              {selection.evaluationId && (
                <p className="text-xs text-muted-foreground">
                  Evaluation #{selection.evaluationId}
                </p>
              )}
              <div
                className="space-y-2"
                role="group"
                aria-label="Route options"
              >
                {selection.options.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selectedOptionId === option.id}
                    disabled={!option.geometry}
                    onClick={() => {
                      selectOption(option.id);
                      setShowRoutes(true);
                    }}
                    className={`w-full rounded-sm border p-3 text-left text-sm disabled:opacity-60 ${selectedOptionId === option.id ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <span className="block font-semibold text-foreground">
                      {option.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {option.riskScore === null
                        ? "Risk unavailable"
                        : `Risk estimate ${option.riskScore}/100`}{" "}
                      ·{" "}
                      {option.transitDays === null
                        ? "Transit unavailable"
                        : `${option.transitDays} days estimated`}
                    </span>
                    {!option.geometry && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Coordinates unavailable or invalid
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {!selectedOption?.geometry && (
                <p role="status" className="text-sm text-muted-foreground">
                  Coordinates unavailable for the selected connection. Choose an
                  available alternative.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!mapInstance || !selectedOption?.geometry}
                  onClick={fitSelected}
                  className="min-h-11 rounded-sm border border-border px-3 text-sm text-primary disabled:opacity-50"
                >
                  Fit selected route
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="min-h-11 rounded-sm border border-border px-3 text-sm text-muted-foreground"
                >
                  Clear selection
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose a recent evaluation below, or open a route from analysis or
              history.
            </p>
          )}
        </section>
        <section aria-label="Recent evaluations" className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            Recent evaluations
          </h2>
          {history?.map(record => (
            <button
              key={record.id}
              type="button"
              aria-label={`View evaluation #${record.id}: ${record.originPort} to ${record.destinationPort}`}
              aria-pressed={selection?.evaluationId === record.id}
              onClick={() => {
                showRoute(makeRouteSelection(record));
                setShowRoutes(true);
              }}
              className="min-h-11 w-full rounded-sm border border-border p-3 text-left text-sm text-foreground"
            >
              {record.originPort} → {record.destinationPort}
              <span className="mt-1 block text-xs text-muted-foreground">
                Risk estimate {record.overallRiskScore}/100
              </span>
            </button>
          ))}
          {history?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No saved evaluations yet.
            </p>
          )}
          <Link
            href="/history"
            className="inline-flex min-h-11 items-center text-sm text-primary underline"
          >
            Open full history
          </Link>
        </section>
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold text-foreground">
            Risk legend
          </summary>
          <ul className="space-y-2 text-muted-foreground">
            <li>Green: low (0–30)</li>
            <li>Amber: moderate (31–60)</li>
            <li>Red: high (61–75) / critical (76–100)</li>
            <li>Thicker line: selected connection</li>
            <li>Blue lines: stored paths</li>
          </ul>
        </details>
        <div
          role="note"
          aria-label="Map connection accuracy"
          className="cyber-card space-y-2 p-3 text-xs leading-relaxed text-muted-foreground"
        >
          <p className="font-semibold text-foreground">
            Approximate connections
          </p>
          <p>
            Dashed lines may cross land. Use maritime routing data to plan
            shipping lanes, canals, and safe passage. Alternative waypoints are
            model suggestions.
          </p>
          <p>Disruption markers show approximate matched areas.</p>
          {omittedConnections > 0 && (
            <p role="status">
              {omittedConnections} connections omitted: coordinates unavailable
              or invalid.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
