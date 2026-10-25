import { describe, expect, it } from "vitest";
import {
  evidenceAge,
  escapeEvidenceHtml,
  observedTimestamp,
  safeSourceUrl,
  sourceKindLabel,
} from "./intelligence";

describe("evidence metadata", () => {
  it("supports serialized dates and never shows negative freshness ages", () => {
    const now = Date.parse("2026-10-24T12:00:00Z");
    expect(evidenceAge(new Date(now - 120000), now)).toBe("2m ago");
    expect(evidenceAge(new Date(now + 60000), now)).toBe("just now");
    expect(evidenceAge("invalid", now)).toBe("unknown");
  });
  it("escapes external text before it is placed in a map's HTML popup", () => {
    expect(escapeEvidenceHtml(`<img src=x onerror='alert(1)'> & "news"`)).toBe(
      "&lt;img src=x onerror=&#39;alert(1)&#39;&gt; &amp; &quot;news&quot;"
    );
  });
  it.each([
    undefined,
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "/relative",
    "https://user:password@example.com",
  ])("rejects unsafe evidence links: %s", value => {
    expect(safeSourceUrl(value)).toBeNull();
  });
  it("retains ordinary web evidence links", () => {
    expect(safeSourceUrl(" https://example.com/article ")).toBe(
      "https://example.com/article"
    );
  });
  it("does not convert missing observation timestamps to the current time", () => {
    for (const value of [null, undefined, "", "invalid"])
      expect(observedTimestamp(value)).toBeNull();
    expect(observedTimestamp(0)).toBe("1970-01-01T00:00:00.000Z");
  });
  it("distinguishes live, baseline and unverified historic records", () => {
    expect(sourceKindLabel("live")).toBe("Live observation");
    expect(sourceKindLabel("baseline")).toBe("Static baseline");
    expect(sourceKindLabel(undefined)).toBe("Unverified record");
  });
});
