/**
 * Loads .env from the project root and OVERRIDES any stale values already
 * in the environment (e.g. an old DATABASE_URL pointing at SQLite).
 * Prisma reads env vars at client construction, so call this before
 * `new PrismaClient()`.
 */
import { readFileSync } from "fs";
import { join } from "path";

export function loadEnvOverride(): void {
  const envPath = join(process.cwd(), ".env");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf-8");
  } catch {
    return; // no .env — rely on real environment (e.g. Vercel)
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let value = m[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[m[1]!] = value;
  }
}
