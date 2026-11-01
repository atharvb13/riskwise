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
  it("keeps source metadata and observation/check times separate, with neutral static markers", () => {
    const base = {
      id: 1,
      title: "Test",
      description: "Test",
      category: "Weather",
      severity: "Critical",
      affectedLocations: ["Shanghai"],
      sourceProvider: "Test feed",
      observedAt: "2026-10-30T05:00:00Z",
      lastSeenAt: new Date("2026-10-31T06:00:00Z"),
    };
    const data = buildDisruptionGeoJSON([
      {
        ...base,
        sourceKind: "live",
        sourceUrl: "https://example.com/evidence",
      },
      {
        ...base,
        id: 2,
        sourceKind: "baseline",
        observedAt: null,
        sourceUrl: "javascript:alert(1)",
      },
      { ...base, id: 3, sourceKind: "legacy" },
    ]);
    expect(data.features[0].properties).toMatchObject({
      sourceKind: "live",
      sourceProvider: "Test feed",
      sourceUrl: "https://example.com/evidence",
      observedAt: "2026-10-30T05:00:00.000Z",
      lastSeenAt: "2026-10-31T06:00:00.000Z",
    });
    expect(data.features[1].properties).toMatchObject({
      color: "#78909c",
      observedAt: null,
      sourceUrl: null,
    });
    expect(data.features[2].properties?.color).toBe(
      data.features[1].properties?.color
    );
    expect(data.features[0].properties?.color).not.toBe(
      data.features[1].properties?.color
    );
  });
});
