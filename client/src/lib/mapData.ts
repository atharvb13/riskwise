import type {
  Feature,
  FeatureCollection,
  Point,
  LineString,
  MultiLineString,
} from "geojson";
import { getPortCoordinates, type Coordinate } from "@shared/ports";
import { getRiskLevel } from "./riskUtils";
import { approximatePortConnection, routeGeometry } from "@shared/geography";

const REGION_COORDS = new Map<string, Coordinate>(
  Object.entries({
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
  }).map(([name, coordinates]) => [
    name.toLowerCase(),
    coordinates as Coordinate,
  ])
);

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

export function getMapSeverityColor(severity: string): string {
  switch (severity) {
    case "Low":
      return "#32d46a";
    case "Medium":
      return "#efba3f";
    case "High":
      return "#ef5552";
    case "Critical":
      return "#eb3b45";
    default:
      return "#78909c";
  }
}

export function buildBaseRouteGeoJSON(
  routes: RouteRecord[]
): FeatureCollection<LineString | MultiLineString> {
  return {
    type: "FeatureCollection",
    features: routes.flatMap(route => {
      const geometry = routeGeometry(route.waypoints);
      return geometry
        ? [{ type: "Feature" as const, geometry, properties: {} }]
        : [];
    }),
  };
}

export function buildEvalRouteGeoJSON(
  history: EvalRecord[]
): FeatureCollection<LineString | MultiLineString> {
  return {
    type: "FeatureCollection",
    features: history.flatMap(ev => {
      const geometry = routeGeometry(
        approximatePortConnection(ev.originPort, ev.destinationPort)
      );
      // MapLibre's style color parser uses these RGB values; UI CSS can use OKLCH.
      const color = {
        low: "#32d46a",
        medium: "#efba3f",
        high: "#ef5552",
        critical: "#ef5552",
      }[getRiskLevel(ev.overallRiskScore)];
      return geometry
        ? [{ type: "Feature" as const, geometry, properties: { color } }]
        : [];
    }),
  };
}

export function buildDisruptionGeoJSON(
  events: RiskEvent[]
): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  events.forEach(ev => {
    const locations = Array.isArray(ev.affectedLocations)
      ? ev.affectedLocations
      : [];
    const seen = new Set<string>();
    locations.forEach((loc: unknown) => {
      if (typeof loc !== "string") return;
      const coord =
        getPortCoordinates(loc) ?? REGION_COORDS.get(loc.trim().toLowerCase());
      if (!coord || seen.has(coord.join(","))) return;
      seen.add(coord.join(","));
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coord },
        properties: {
          id: ev.id,
          title: ev.title,
          description: ev.description,
          category: ev.category,
          severity: ev.severity,
          color: getMapSeverityColor(ev.severity),
          radius:
            ev.severity === "Critical" ? 14 : ev.severity === "High" ? 10 : 7,
        },
      });
    });
  });
  return { type: "FeatureCollection", features };
}
