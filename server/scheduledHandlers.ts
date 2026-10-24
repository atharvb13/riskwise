import { logger } from "./_core/logger";
import { runAthenaScan } from "./agents";
import { refreshRiskEvents } from "./db";

let currentScan: Promise<void> | null = null;

/** Startup, cron, and manual triggers share one in-flight scan per process. */
export function athenaHourlyScan(): Promise<void> {
  if (currentScan) return currentScan;
  currentScan = performScan().finally(() => {
    currentScan = null;
  });
  return currentScan;
}

async function performScan(): Promise<void> {
  logger.info("[Athena Scan] Starting sourced disruption scan");
  try {
    const intelligence = await runAthenaScan();
    const result = await refreshRiskEvents(intelligence.events);
    logger.info(result, "[Athena Scan] Observation refresh complete");
  } catch (error) {
    logger.error({ err: error }, "[Athena Scan] Scan failed");
    throw error;
  }
}
