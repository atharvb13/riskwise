import type { LineString, MultiLineString } from "geojson";
import { getPortCoordinates, type Coordinate } from "./ports";

export function isCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(part => typeof part === "number" && Number.isFinite(part)) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

const radians = Math.PI / 180;
type Vector = [number, number, number];
const vector = ([lng, lat]: Coordinate): Vector => [
  Math.cos(lat * radians) * Math.cos(lng * radians),
  Math.cos(lat * radians) * Math.sin(lng * radians),
  Math.sin(lat * radians),
];

/** Spherical connection for visualization only; does not route around land. */
export function approximateConnection(
  start: Coordinate,
  end: Coordinate
): Coordinate[] {
  if (!isCoordinate(start) || !isCoordinate(end)) return [];
  const a = vector(start);
  const b = vector(end);
  const dot = Math.max(
    -1,
    Math.min(
      1,
      a.reduce((sum, part, i) => sum + part * b[i], 0)
    )
  );
  const angle = Math.acos(dot);
  if (angle < 1e-8) return [[...start], [...end]];
  let tangent = b.map((part, i) => part - dot * a[i]) as Vector;
  let length = Math.hypot(...tangent);
  if (length < 1e-8) {
    // Antipodal endpoints have no unique shortest arc. Choose a stable perpendicular.
    const axis = a.reduce(
      (best, part, i) => (Math.abs(part) < Math.abs(a[best]) ? i : best),
      0
    );
    tangent = a.map(
      (part, i) => (i === axis ? 1 : 0) - a[axis] * part
    ) as Vector;
    length = Math.hypot(...tangent);
  }
  tangent = tangent.map(part => part / length) as Vector;
  const steps = Math.max(1, Math.ceil(angle / radians / 3));
  const points: Coordinate[] = [[...start]];
  for (let i = 1; i < steps; i++) {
    const t = (angle * i) / steps;
    const p = a.map((part, j) => part * Math.cos(t) + tangent[j] * Math.sin(t));
    points.push([
      Math.atan2(p[1], p[0]) / radians,
      Math.atan2(p[2], Math.hypot(p[0], p[1])) / radians,
    ]);
  }
  points.push([...end]);
  return points;
}

export function approximatePortConnection(
  origin: string,
  destination: string
): Coordinate[] {
  const start = getPortCoordinates(origin);
  const end = getPortCoordinates(destination);
  return start && end ? approximateConnection(start, end) : [];
}

/** Validate the whole stored path and cut at ±180° so no line spans the map. */
export function routeGeometry(
  waypoints: unknown
): LineString | MultiLineString | null {
  if (
    !Array.isArray(waypoints) ||
    waypoints.length < 2 ||
    waypoints.length > 512 ||
    !waypoints.every(isCoordinate)
  )
    return null;
  const segments: Coordinate[][] = [];
  let current: Coordinate[] = [[...waypoints[0]]];
  const append = (point: Coordinate) => {
    const last = current.at(-1)!;
    if (point[0] !== last[0] || point[1] !== last[1]) current.push(point);
  };
  for (const next of waypoints.slice(1)) {
    const previous = current.at(-1)!;
    let delta = next[0] - previous[0];
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const unwrapped = previous[0] + delta;
    if (unwrapped > 180 || unwrapped < -180) {
      const edge = unwrapped > 180 ? 180 : -180;
      const fraction = (edge - previous[0]) / delta;
      const latitude = previous[1] + (next[1] - previous[1]) * fraction;
      append([edge, latitude]);
      if (current.length >= 2) segments.push(current);
      current = [[-edge, latitude]];
      append([...next]);
    } else {
      append([unwrapped, next[1]]);
    }
  }
  if (current.length >= 2) segments.push(current);
  if (!segments.length) return null;
  return segments.length === 1
    ? { type: "LineString", coordinates: segments[0] }
    : { type: "MultiLineString", coordinates: segments };
}
