import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@shared": path.resolve(import.meta.dirname, "shared") },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
    env: { NODE_ENV: "test", LOG_LEVEL: "error" },
  },
});
