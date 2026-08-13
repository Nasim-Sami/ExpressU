import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Where uploaded media lives.
 *
 * IMPORTANT: this directory is NOT under `public/`, and that is deliberate. Media is
 * served only through `/api/media/[...key]`, which runs the same `canView` check as the
 * page that embeds it. If uploads were static assets, anyone who guessed or leaked a URL
 * could fetch a private video straight off the filesystem, and a young person's "just me"
 * idea would be one shared link away from being public.
 *
 * The interface below is the shape an S3 adapter would implement, so moving to object
 * storage later means writing one new module and changing nothing else.
 *
 * `next build` prints warnings here about dynamic `fs` paths that Turbopack can't trace.
 * They are expected and harmless: this module reads files uploaded at runtime, not assets
 * that should be bundled. The build exits 0.
 */

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");

/** Keys look like `2026/08/ab/cdef…-name.mp4` — sharded so no directory grows unbounded. */
export function buildKey(originalName: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = randomUUID();
  const shard = id.slice(0, 2);
  const safeName = path
    .basename(originalName)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  return `${year}/${month}/${shard}/${id}-${safeName}`;
}

/**
 * Resolve a storage key to an absolute path, refusing anything that escapes ROOT.
 * Keys reaching this function may come from a URL, so they are untrusted input.
 */
export function resolveKey(key: string): string {
  const full = path.resolve(ROOT, key);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (full !== ROOT && !full.startsWith(rootWithSep)) {
    throw new Error("Refusing to resolve a storage key outside the storage root");
  }
  return full;
}

export async function put(key: string, data: Buffer | Uint8Array): Promise<void> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function putStream(key: string, stream: ReadableStream<Uint8Array>): Promise<number> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of streamToAsyncIterable(stream)) {
    chunks.push(chunk);
    size += chunk.byteLength;
  }
  await fs.writeFile(full, Buffer.concat(chunks));
  return size;
}

async function* streamToAsyncIterable(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function read(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

export function readStream(key: string, opts?: { start?: number; end?: number }) {
  return createReadStream(resolveKey(key), opts);
}

export async function stat(key: string): Promise<{ size: number } | null> {
  try {
    const s = await fs.stat(resolveKey(key));
    return { size: s.size };
  } catch {
    return null;
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await fs.unlink(resolveKey(key));
  } catch {
    // Already gone is a fine outcome for a delete.
  }
}

export function sha256(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}


export async function ensureStorageRoot(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}
