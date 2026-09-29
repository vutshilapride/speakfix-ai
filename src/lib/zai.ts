import ZAI from "z-ai-web-dev-sdk";
import { promises as fs } from "fs";

/**
 * ZAI client factory that works in BOTH environments:
 *
 * 1. Local / this workspace — a .z-ai-config file already exists (project
 *    root, home dir, or /etc) and ZAI.create() finds it on its own.
 * 2. Serverless (Vercel etc.) — no config file exists and the filesystem is
 *    read-only except /tmp. We materialize the config into /tmp from env
 *    vars and point $HOME there so the SDK can resolve it.
 *
 * Required env vars on serverless:
 *   ZAI_API_KEY   — your Z.ai API key (https://z.ai / GLM API platform)
 *   ZAI_BASE_URL  — optional; defaults to the public Z.ai endpoint
 */
const DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";
const TMP_CONFIG = "/tmp/.z-ai-config";

let bootstrapped = false;

async function ensureServerlessConfig(): Promise<void> {
  if (bootstrapped) return;
  if (!process.env.ZAI_API_KEY) return; // local: rely on existing config file

  try {
    await fs.writeFile(
      TMP_CONFIG,
      JSON.stringify({
        baseUrl: process.env.ZAI_BASE_URL || DEFAULT_BASE_URL,
        apiKey: process.env.ZAI_API_KEY,
      }),
      "utf-8"
    );
    // os.homedir() resolves through $HOME on Linux — point it at /tmp so the
    // SDK's config search finds the file we just wrote.
    process.env.HOME = "/tmp";
    bootstrapped = true;
  } catch (err) {
    console.error("[zai] failed to write serverless config:", err);
  }
}

/** Get a configured ZAI client (GLM chat / ASR / image APIs). */
export async function getZAI(): Promise<ZAI> {
  await ensureServerlessConfig();
  return ZAI.create();
}

export default ZAI;
