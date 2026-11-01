import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { FeatureCollection, Point } from "geojson";
import maplibregl from "maplibre-gl";
import { createPortal } from "react-dom";
import { EventEvidence } from "@/components/Evidence";
import { QueryError } from "@/components/QueryError";
import { sourceKindLabel } from "@shared/intelligence";
import { Link } from "wouter";
import { MapView as LibreMap } from "@/components/Map";
import { useRouteMap } from "@/contexts/RouteMapContext";
import { makeRouteSelection, routeBounds } from "@/lib/routeSelection";
import { trpc } from "@/lib/trpc";
import {
  buildBaseRouteGeoJSON,
  buildEvalRouteGeoJSON,
  buildSelectedRouteGeoJSON,
  buildDisruptionGeoJSON,
  type MapRiskEvent,
} from "@/lib/mapData";

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
  if (!map.getStyle()) return;
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
  const [popup, setPopup] = useState<{
    element: HTMLDivElement;
    event: MapRiskEvent;
  } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const evidenceDetailsRef = useRef<HTMLDetailsElement>(null);
  const disruptionsRef = useRef<MapRiskEvent[] | undefined>(undefined);
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
  disruptionsRef.current = disruptions;
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

  const showEvidencePopup = useCallback(
    (
      map: maplibregl.Map,
      event: MapRiskEvent,
      coordinates: [number, number]
    ) => {
      popupRef.current?.remove();
      const returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      map.getContainer().scrollIntoView({ block: "nearest" });
      map.easeTo({
        center: coordinates,
        zoom: Math.max(map.getZoom(), 3),
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 300,
      });
      const element = document.createElement("div");
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        anchor: "center",
        className: "riskwise-popup",
        maxWidth: "320px",
      })
        .setLngLat(coordinates)
        .setDOMContent(element)
        .addTo(map);
      const popupRoot = popupRef.current.getElement();
      popupRef.current.on("close", () => {
        setPopup(current => (current?.element === element ? null : current));
        if (
          returnFocus?.isConnected &&
          (document.activeElement === document.body ||
            popupRoot.contains(document.activeElement))
        )
          returnFocus.focus();
      });
      setPopup({ element, event });
    },
    []
  );

  const handleMapUnavailable = useCallback(() => {
    popupRef.current?.remove();
    popupRef.current = null;
    mapRef.current = null;
    setPopup(null);
    setMapInstance(null);
  }, []);

  const handleMapReady = useCallback(
    (map: maplibregl.Map) => {
      mapRef.current = map;
      initLayers(map);
      setMapInstance(map);
      map.on("click", LAYER.disruptionPoints, event => {
        const feature = event.features?.[0];
        const record = disruptionsRef.current?.find(
          row => row.id === Number(feature?.properties?.id)
        );
        if (!feature || !record) return;
        setSelectedEventId(record.id);
        if (evidenceDetailsRef.current) evidenceDetailsRef.current.open = true;
        showEvidencePopup(
          map,
          record,
          (feature.geometry as Point).coordinates as [number, number]
        );
      });
    },
    [showEvidencePopup]
  );

  const inspectEvidence = (event: MapRiskEvent) => {
    if (selectedEventId === event.id) {
      setSelectedEventId(null);
      popupRef.current?.remove();
      return;
    }
    setSelectedEventId(event.id);
    const point = buildDisruptionGeoJSON([event]).features[0]?.geometry
      .coordinates as [number, number] | undefined;
    popupRef.current?.remove();
    if (mapInstance && point && showDisruptions) {
      showEvidencePopup(mapInstance, event, point);
    }
  };

  useEffect(() => {
    if (!showDisruptions) popupRef.current?.remove();
  }, [showDisruptions]);
  useEffect(() => {
    setPopup(current => {
      if (!current || !disruptions) return current;
      const updated = disruptions.find(event => event.id === current.event.id);
      return updated && updated !== current.event
        ? { ...current, event: updated }
        : current;
    });
  }, [disruptions]);
  useEffect(() => {
    if (
      selectedEventId !== null &&
      disruptions &&
      !disruptions.some(event => event.id === selectedEventId)
    ) {
      setSelectedEventId(null);
      popupRef.current?.remove();
    }
  }, [disruptions, selectedEventId]);

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
          onMapUnavailable={handleMapUnavailable}
          initialCenter={[20, 20]}
          initialZoom={2.5}
          className="h-full w-full"
        />
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
        {eventsQuery.isError && (
          <QueryError
            title="Could not load disruption evidence"
            onRetry={() => {
              void eventsQuery.refetch();
            }}
            isRetrying={eventsQuery.isFetching}
            hasCachedData={Boolean(disruptions)}
          />
        )}
        {routesQuery.isError && (
          <QueryError
            title="Could not load stored map paths"
            onRetry={() => {
              void routesQuery.refetch();
            }}
            isRetrying={routesQuery.isFetching}
            hasCachedData={Boolean(routes)}
          />
        )}
        {historyQuery.isError && (
          <QueryError
            title="Could not load recent evaluations"
            onRetry={() => {
              void historyQuery.refetch();
            }}
            isRetrying={historyQuery.isFetching}
            hasCachedData={Boolean(history)}
          />
        )}
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
              <p className="text-xs text-muted-foreground">
                {selection.evaluatedAt ? (
                  <>
                    Assessment snapshot:{" "}
                    <time dateTime={selection.evaluatedAt}>
                      {new Date(selection.evaluatedAt).toLocaleString()}
                    </time>
                  </>
                ) : (
                  "Analysis result from this session"
                )}
                . Refreshing map data does not rerun this risk assessment.
              </p>
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
          {!historyQuery.isError && history?.length === 0 && (
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
        <details ref={evidenceDetailsRef} className="space-y-3">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold text-foreground">
            Disruption evidence ({disruptions?.length ?? 0})
          </summary>
          <p className="text-xs text-muted-foreground">
            {disruptions?.filter(
              event =>
                event.sourceKind === "live" &&
                (event.severity === "High" || event.severity === "Critical")
            ).length ?? 0}{" "}
            live critical/high observations. Gray markers represent static or
            unverified context.
          </p>
          {!eventsQuery.isError && disruptions?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No disruption evidence is available. Missing reports do not
              establish route safety.
            </p>
          )}
          <ul className="space-y-3">
            {disruptions?.map(event => (
              <li key={event.id} className="cyber-card p-3">
                <button
                  type="button"
                  aria-label={`Inspect evidence: ${event.title}`}
                  aria-expanded={selectedEventId === event.id}
                  aria-controls={`map-evidence-${event.id}`}
                  onClick={() => inspectEvidence(event)}
                  className="min-h-11 w-full text-left text-sm font-semibold text-foreground break-words"
                >
                  {event.title}
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {sourceKindLabel(event.sourceKind)} ·{" "}
                    {event.sourceKind === "baseline" ? "Baseline risk: " : ""}
                    {event.severity}
                  </span>
                </button>
                <div
                  id={`map-evidence-${event.id}`}
                  hidden={selectedEventId !== event.id}
                >
                  {selectedEventId === event.id && (
                    <>
                      <p className="mt-2 text-sm text-muted-foreground break-words">
                        {event.description}
                      </p>
                      {!disruptionData.features.some(
                        feature => feature.properties?.id === event.id
                      ) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No matching map location is available for this record.
                        </p>
                      )}
                      <EventEvidence event={event} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
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
            <li>Colored markers: live observation severity</li>
            <li>Gray markers: static or unverified context</li>
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
      {popup &&
        createPortal(
          <article className="cyber-card max-h-[50dvh] overflow-y-auto p-4 pr-11">
            <h2 className="text-sm font-semibold text-foreground break-words">
              {popup.event.title}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground break-words">
              {popup.event.description}
            </p>
            <EventEvidence event={popup.event} />
          </article>,
          popup.element
        )}
    </div>
  );
}
