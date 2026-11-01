import { describe, expect, it } from "vitest";
import { makeRouteSelection, routeBounds } from "./routeSelection";
import { buildSelectedRouteGeoJSON } from "./mapData";

const evaluation = {
  id: 12,
  originPort: "Shanghai",
  destinationPort: "Los Angeles",
  overallRiskScore: 65,
  baseTransitDays: 18,
};

describe("map route selection", () => {
  it("keeps the selected alternative's identity and Pacific geometry separate from the evaluated connection", () => {
    const selection = makeRouteSelection({
      ...evaluation,
      alternativeRoutes: [
        {
          name: "Pacific alternative",
          riskScore: 30,
          transitDays: 20,
          waypoints: [
            [170, 10],
            [-170, 20],
          ],
        },
      ],
    });
    expect(selection.options.map(option => option.id)).toEqual([
      "base",
      "alternative-0",
    ]);
    const features = buildSelectedRouteGeoJSON(
      selection,
      "alternative-0"
    ).features;
    expect(features.map(feature => feature.properties?.selected)).toEqual([
      false,
      true,
    ]);
    expect(features[1].geometry.type).toBe("MultiLineString");
    expect(features[1].properties?.color).not.toBe(
      features[0].properties?.color
    );
  });

  it("keeps unsupported endpoints unavailable without discarding a valid alternative", () => {
    const selection = makeRouteSelection({
      ...evaluation,
      originPort: "Unknown Harbor",
      alternativeRoutes: [
        {
          waypoints: [
            [4, 5],
            [6, 7],
          ],
        },
      ],
    });
    expect(selection.options[0].geometry).toBeNull();
    expect(selection.options[1].riskScore).toBeNull();
    expect(
      buildSelectedRouteGeoJSON(selection, "alternative-0").features
    ).toHaveLength(1);
  });

  it("rejects malformed stored waypoints and scores, while retaining unavailable option labels", () => {
    const selection = makeRouteSelection({
      ...evaluation,
      alternativeRoutes: [
        null,
        {
          name: "Bad route",
          riskScore: -1,
          transitDays: "20",
          waypoints: [
            [999, 0],
            [1, 2],
          ],
        },
      ],
    });
    expect(selection.options[2]).toMatchObject({
      name: "Bad route",
      riskScore: null,
      transitDays: null,
      geometry: null,
      waypoints: [],
    });
    expect(buildSelectedRouteGeoJSON(selection, "base").features).toHaveLength(
      1
    );
  });

  it("bounds stored alternatives and copies coordinates", () => {
    const points = [
      [1, 2],
      [3, 4],
    ];
    const selection = makeRouteSelection({
      ...evaluation,
      alternativeRoutes: Array.from({ length: 50 }, () => ({
        waypoints: points,
      })),
    });
    expect(selection.options).toHaveLength(6);
    selection.options[1].waypoints[0][0] = 99;
    expect(points[0][0]).toBe(1);
  });
});

describe("route camera bounds", () => {
  it("frames the short Pacific interval in either direction", () => {
    for (const points of [
      [
        [170, 10],
        [-170, 20],
      ],
      [
        [-170, 20],
        [170, 10],
      ],
    ] as [number, number][][]) {
      expect(routeBounds(points)).toEqual([
        [170, 10],
        [190, 20],
      ]);
    }
  });
  it("frames Greenwich crossings, clamps polar camera limits, and rejects invalid points", () => {
    expect(
      routeBounds([
        [-10, -90],
        [10, 90],
      ])
    ).toEqual([
      [-10, -85],
      [10, 85],
    ]);
    expect(
      routeBounds([
        [1, 2],
        [1, 2],
      ])
    ).toEqual([
      [1, 2],
      [1, 2],
    ]);
    expect(routeBounds([])).toBeNull();
    expect(
      routeBounds([
        [1, 2],
        [Infinity, 0],
      ])
    ).toBeNull();
  });
});
