import { logger } from "./_core/logger";
import { runAthenaScan } from "./agents";
import { insertRiskEvent } from "./db";

export async function athenaHourlyScan(): Promise<void> {
  logger.info("[Athena Scan] Starting hourly disruption scan");
  try {
    const intelligence = await runAthenaScan();
    for (const newEvent of intelligence.events) {
      await insertRiskEvent({
        title: newEvent.title,
        description: `[${newEvent.sourceKind === "baseline" ? "Static baseline" : "Live source"} — ${newEvent.sourceProvider}] ${newEvent.description}`,
        category: newEvent.category,
        severity: newEvent.severity,
        affectedLocations: newEvent.affectedLocations,
        sourceUrl: newEvent.sourceUrl ?? null,
        isActive: true,
      });
    }
    logger.info(
      { count: intelligence.events.length },
      "[Athena Scan] Sourced events stored"
    );
  } catch (err) {
    logger.error({ err }, "[Athena Scan] Scan failed");
    throw err;
  }
}
