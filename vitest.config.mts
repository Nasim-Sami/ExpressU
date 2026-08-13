import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // sharp + ffmpeg work is slower than pure logic.
    testTimeout: 30_000,
    /*
     * One test file at a time.
     *
     * Two of these suites write to the real SQLite database, and SQLite takes one writer
     * at a time — run in parallel they intermittently collide on a lock, which shows up as
     * a test that fails once and then passes on every re-run. A suite you can't trust the
     * first result of is worse than a slow one, and the whole run is a couple of seconds
     * either way.
     */
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
      // `server-only` throws by design outside a React Server Component graph. Tests run
      // the same server modules directly, so point it at the package's own no-op build —
      // the same file Next.js uses under the react-server condition.
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
