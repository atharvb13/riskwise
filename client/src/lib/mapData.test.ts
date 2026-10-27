import { describe, expect, it } from "vitest";
import {
  buildBaseRouteGeoJSON,
  buildEvalRouteGeoJSON,
  buildDisruptionGeoJSON,
} from "./mapData";

describe("map data", () => {
  it("validates stored paths and splits them at the date line", () => {
    const data = buildBaseRouteGeoJSON([
      {
        id: 1,
        waypoints: [
          [170, 10],
          [-170, 30],
        ],
      },
      {
        id: 2,
        waypoints: [
          [1, 2],
          [999, 999],
        ],
      },
      { id: 3, waypoints: "bad" },
    ]);
    expect(data.features).toHaveLength(1);
    expect(data.features[0].geometry.type).toBe("MultiLineString");
  });

  it("maps historical aliases across the Pacific and omits unknown endpoints", () => {
    const data = buildEvalRouteGeoJSON([
      {
        originPort: "CNSHA",
        destinationPort: "Los Angeles",
        overallRiskScore: 85,
      },
      {
        originPort: "Unknown Harbor",
        destinationPort: "Rotterdam",
        overallRiskScore: 10,
      },
    ]);
    expect(data.features).toHaveLength(1);
    expect(data.features[0].geometry.type).toBe("MultiLineString");
    expect(data.features[0].properties?.color).toMatch(/^#[a-f0-9]{6}$/);
  });

  it("maps exact port/region names, coalesces aliases, and ignores malformed locations", () => {
    const base = {
      id: 1,
      title: "Test",
      description: "Test",
      category: "Weather",
      severity: "High",
    };
    const data = buildDisruptionGeoJSON([
      {
        ...base,
        affectedLocations: [
          "Pusan",
          "KRPUS",
          " red sea ",
          null,
          1,
          "constructor",
          "Unknown Harbor",
        ],
      },
      { ...base, id: 2, affectedLocations: null },
      { ...base, id: 3, affectedLocations: "Shanghai" },
    ]);
    expect(data.features.map(feature => feature.geometry.coordinates)).toEqual([
      [129, 35.1],
      [38, 20],
    ]);
    expect(
      data.features.every(feature =>
        /^#[a-f0-9]{6}$/.test(feature.properties!.color)
      )
    ).toBe(true);
  });
});
