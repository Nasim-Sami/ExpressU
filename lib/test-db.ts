import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

/**
 * An isolated database for a test file to scribble on.
 *
 * These tests used to point DATABASE_URL at a throwaway SQLite file, which was the right
 * answer while the app ran on SQLite. On Postgres there is no per-file equivalent — but
 * there is a better one: a **schema**. Each test file gets its own namespace inside the
 * same server, `prisma db push` builds the tables in it, and dropping it afterwards
 * removes every trace.
 *
 * Isolation matters here specifically because these suites create users with fixed
 * handles and count rows globally, so sharing the development database would make them
 * fail depending on what happened to be in it.
 *
 * NOTE the filename: `test-db.ts`, not `test-db.test.ts`. Vitest collects `*.test.ts`,
 * and a helper collected as a suite fails with "no test found".
 */

/** Strips any existing ?schema= so a caller's URL doesn't fight the one we add. */
function baseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — tests need a Postgres server to talk to");

  const url = new URL(raw);
  url.searchParams.delete("schema");
  return url.toString();
}

export interface IsolatedDb {
  /** The schema name, so a test can drop it or inspect it. */
  schema: string;
  /** Tears the schema down. Safe to call twice. */
  drop: () => void;
}

/**
 * Points `process.env.DATABASE_URL` at a fresh schema and creates the tables in it.
 *
 * Must be called BEFORE importing `@/lib/db`, because the Prisma client reads the URL
 * when the module is first evaluated — which is why every caller imports the client
 * dynamically, after this returns.
 */
export function useIsolatedSchema(prefix: string): IsolatedDb {
  const schema = `test_${prefix}_${randomBytes(4).toString("hex")}`;

  const base = new URL(baseUrl());
  base.searchParams.set("schema", schema);
  const url = base.toString();

  process.env.DATABASE_URL = url;

  // `db push` creates the schema if it doesn't exist, so there is no separate CREATE.
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  return {
    schema,
    drop() {
      try {
        execFileSync(
          "npx",
          [
            "prisma",
            "db",
            "execute",
            "--url",
            url,
            "--stdin",
          ],
          { input: `DROP SCHEMA IF EXISTS "${schema}" CASCADE;`, stdio: "pipe" },
        );
      } catch {
        // A leftover test schema is untidy, not harmful, and failing the teardown would
        // mask whatever the test was actually reporting.
      }
    },
  };
}
