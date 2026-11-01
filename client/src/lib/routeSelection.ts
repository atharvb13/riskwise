import {
  approximatePortConnection,
  isCoordinate,
  routeGeometry,
} from "@shared/geography";
import { observedTimestamp } from "@shared/intelligence";
import type { Coordinate } from "@shared/ports";

export interface EvaluationMapInput {
  id?: number;
  originPort: string;
  destinationPort: string;
  overallRiskScore: number;
  baseTransitDays: number;
  alternativeRoutes?: unknown;
  evaluatedAt?: Date | string | null;
}

export interface MapRouteOption {
  id: string;
  name: string;
  kind: "base" | "alternative";
  riskScore: number | null;
  transitDays: number | null;
  waypoints: Coordinate[];
  geometry: ReturnType<typeof routeGeometry>;
}

export interface RouteSelection {
  evaluationId?: number;
  evaluatedAt: string | null;
  originPort: string;
  destinationPort: string;
  options: MapRouteOption[];
}

const score = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100
    ? value
    : null;
const transit = (value: unknown) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= 365
    ? value
    : null;

/** Treat stored JSON as untrusted, including results created before validation existed. */
export function makeRouteSelection(input: EvaluationMapInput): RouteSelection {
  const base = approximatePortConnection(
    input.originPort,
    input.destinationPort
  );
  const options: MapRouteOption[] = [
    {
      id: "base",
      name: "Evaluated connection",
      kind: "base",
      riskScore: score(input.overallRiskScore),
      transitDays: transit(input.baseTransitDays),
      waypoints: base,
      geometry: routeGeometry(base),
    },
  ];
  if (Array.isArray(input.alternativeRoutes)) {
    input.alternativeRoutes.slice(0, 5).forEach((value: unknown, index) => {
      const alt =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : {};
      const geometry = routeGeometry(alt.waypoints);
      const points = geometry
        ? (alt.waypoints as Coordinate[]).map(point => [...point] as Coordinate)
        : [];
      options.push({
        id: `alternative-${index}`,
        name:
          typeof alt.name === "string" && alt.name.trim()
            ? alt.name.trim().slice(0, 120)
            : `Alternative ${index + 1}`,
        kind: "alternative",
        riskScore: score(alt.riskScore),
        transitDays: transit(alt.transitDays),
        waypoints: points,
        geometry,
      });
    });
  }
  return {
    evaluationId: input.id,
    evaluatedAt: observedTimestamp(input.evaluatedAt),
    originPort: input.originPort,
    destinationPort: input.destinationPort,
    options,
  };
}

/** Smallest longitude interval covering the path, including Pacific crossings. */
export function routeBounds(
  points: Coordinate[]
): [[number, number], [number, number]] | null {
  if (points.length < 2 || !points.every(isCoordinate)) return null;
  const longitudes = points
    .map(point => (point[0] + 360) % 360)
    .sort((a, b) => a - b);
  let gap = -1;
  let start = 0;
  for (let i = 0; i < longitudes.length; i++) {
    const next =
      i === longitudes.length - 1 ? longitudes[0] + 360 : longitudes[i + 1];
    if (next - longitudes[i] > gap) {
      gap = next - longitudes[i];
      start = longitudes[(i + 1) % longitudes.length];
    }
  }
  if (start > 180) start -= 360;
  const latitudes = points.map(point => Math.max(-85, Math.min(85, point[1])));
  return [
    [start, Math.min(...latitudes)],
    [start + 360 - gap, Math.max(...latitudes)],
  ];
}
