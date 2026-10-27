import { describe, expect, it } from "vitest";
import {
  approximateConnection,
  approximatePortConnection,
  isCoordinate,
  routeGeometry,
} from "./geography";
import { PORTS, type Coordinate } from "./ports";

describe("approximate geographic connections", () => {
  it("takes the Pacific arc from Shanghai to Los Angeles in both directions", () => {
    for (const [origin, destination] of [
      ["Shanghai", "Los Angeles"],
      ["Los Angeles", "Shanghai"],
    ]) {
      const points = approximatePortConnection(origin, destination);
      expect(points.every(point => Math.abs(point[0]) > 110)).toBe(true);
      const geometry = routeGeometry(points)!;
      expect(geometry.type).toBe("MultiLineString");
    }
  });

  it.each([
    [
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [180, 0],
    ],
    [
      [0, 90],
      [0, -90],
    ],
    [
      [0, 0],
      [179.999999, 0.000001],
    ],
  ] as [Coordinate, Coordinate][])(
    "handles coincident, polar and antipodal endpoints: %j to %j",
    (start, end) => {
      const points = approximateConnection(start, end);
      expect(points[0]).toEqual(start);
      expect(points.at(-1)).toEqual(end);
      expect(points.every(isCoordinate)).toBe(true);
      expect(points.length).toBeLessThanOrEqual(61);
    }
  );

  it("produces bounded geometry without jumps over 180 degrees for every catalog pair", () => {
    for (const start of PORTS)
      for (const end of PORTS) {
        const points = approximatePortConnection(start.name, end.name);
        expect(points[0]).toEqual(start.coordinates);
        expect(points.at(-1)).toEqual(end.coordinates);
        expect(points.every(isCoordinate)).toBe(true);
        const geometry = routeGeometry(points);
        if (start.id === end.id) {
          expect(geometry).toBeNull();
          continue;
        }
        expect(geometry).not.toBeNull();
        const segments =
          geometry!.type === "LineString"
            ? [geometry!.coordinates]
            : geometry!.coordinates;
        for (const segment of segments) {
          expect(segment.length).toBeGreaterThanOrEqual(2);
          expect(segment.every(isCoordinate)).toBe(true);
          for (let i = 1; i < segment.length; i++)
            expect(
              Math.abs(segment[i][0] - segment[i - 1][0])
            ).toBeLessThanOrEqual(180);
        }
      }
  });

  it("omits an unknown port instead of connecting to a fabricated point", () => {
    expect(approximatePortConnection("Unknown Harbor", "Shanghai")).toEqual([]);
  });
});

describe("stored map geometry", () => {
  it("splits eastbound and westbound paths with matching boundary latitude", () => {
    expect(
      routeGeometry([
        [170, 10],
        [-170, 30],
      ])
    ).toEqual({
      type: "MultiLineString",
      coordinates: [
        [
          [170, 10],
          [180, 20],
        ],
        [
          [-180, 20],
          [-170, 30],
        ],
      ],
    });
    expect(
      routeGeometry([
        [-170, 30],
        [170, 10],
      ])
    ).toEqual({
      type: "MultiLineString",
      coordinates: [
        [
          [-170, 30],
          [-180, 20],
        ],
        [
          [180, 20],
          [170, 10],
        ],
      ],
    });
  });

  it("handles exact boundary points and repeated crossings without zero-length segments", () => {
    expect(
      routeGeometry([
        [170, 0],
        [180, 10],
        [-180, 10],
        [-170, 20],
      ])
    ).toEqual({
      type: "MultiLineString",
      coordinates: [
        [
          [170, 0],
          [180, 10],
        ],
        [
          [-180, 10],
          [-170, 20],
        ],
      ],
    });
    expect(
      routeGeometry([
        [180, 0],
        [-170, 1],
      ])
    ).toEqual({
      type: "LineString",
      coordinates: [
        [-180, 0],
        [-170, 1],
      ],
    });
    const geometry = routeGeometry([
      [170, 0],
      [-170, 10],
      [170, 20],
    ])!;
    expect(
      geometry.type === "MultiLineString" && geometry.coordinates.length
    ).toBe(3);
  });

  it("keeps valid non-crossing waypoints, including real coordinates at zero", () => {
    expect(
      routeGeometry([
        [0, 0],
        [4, 5],
      ])
    ).toEqual({
      type: "LineString",
      coordinates: [
        [0, 0],
        [4, 5],
      ],
    });
  });

  it.each([
    null,
    {},
    "bad",
    [],
    [[1, 2]],
    [
      [0, 0],
      [0, 0],
    ],
    [
      [1, 2],
      [NaN, 2],
    ],
    [
      [1, 2],
      [181, 3],
    ],
    [
      [1, 2],
      [3, 91],
    ],
    [
      [1, 2],
      [3, 4, 5],
    ],
    [
      [1, 2],
      ["3", 4],
    ],
    [[1, 2], null],
    Array.from({ length: 513 }, () => [1, 2]),
  ])("rejects an invalid or degenerate stored path (%#)", value => {
    expect(routeGeometry(value)).toBeNull();
  });

  it("does not mutate stored data while splitting it", () => {
    const points = [
      [170, 10],
      [-170, 30],
    ];
    const before = structuredClone(points);
    routeGeometry(points);
    expect(points).toEqual(before);
  });
});
