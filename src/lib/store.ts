import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Brief } from "./types";

/**
 * Run history is a real file on disk. On Vercel the only writable path is
 * /tmp, which is ephemeral: the UI labels that honestly instead of pretending
 * history is durable. Point PAPERTRAIL_DATA_DIR at a volume to persist it.
 */
function dataDir() {
  if (process.env.PAPERTRAIL_DATA_DIR) return process.env.PAPERTRAIL_DATA_DIR;
  if (process.env.VERCEL) return "/tmp/papertrail";
  return path.join(process.cwd(), ".data");
}

function safeId(id: string) {
  if (!/^[a-z0-9]{8,32}$/i.test(id)) return null;
  return id;
}

export function newRunId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function saveBrief(brief: Brief) {
  const dir = path.join(dataDir(), "briefs");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${brief.id}.json`), JSON.stringify(brief, null, 2), "utf8");
}

export async function getBrief(id: string): Promise<Brief | null> {
  const clean = safeId(id);
  if (!clean) return null;
  try {
    const raw = await readFile(path.join(dataDir(), "briefs", `${clean}.json`), "utf8");
    return JSON.parse(raw) as Brief;
  } catch {
    return null;
  }
}

export function isEphemeralStore() {
  return Boolean(process.env.VERCEL) && !process.env.PAPERTRAIL_DATA_DIR;
}
