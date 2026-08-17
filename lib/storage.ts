import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Where uploaded media lives.
 *
 * IMPORTANT: this directory is NOT under `public/`, and that is deliberate. Media is
 * served only through `/api/media/[...key]`, which runs the same `canView` check as the
 * page that embeds it. If uploads were static assets, anyone who guessed or leaked a URL
 * could fetch a private video straight off the filesystem, and a young person's "just me"
 * idea would be one shared link away from being public.
 *
 * Two drivers live behind the same interface, picked by `STORAGE_DRIVER`:
 *
 *   "fs" (default) — local disk at STORAGE_DIR. Simple, but the directory does not
 *       survive a deploy on a stateless host (Vercel, Render without a disk, etc.), so
 *       it's dev-only.
 *   "s3" — any S3-compatible bucket: Supabase Storage, Cloudflare R2, real AWS S3. This
 *       is what makes the app deployable to a stateless host — nothing written here is
 *       assumed to still be on the machine that wrote it.
 *
 * Every caller goes through the functions below and never touches a driver directly, so
 * switching STORAGE_DRIVER is the only thing a deploy needs to change.
 *
 * `next build` prints warnings here about dynamic `fs` paths that Turbopack can't trace.
 * They are expected and harmless: this module reads files uploaded at runtime, not assets
 * that should be bundled. The build exits 0.
 */

const DRIVER = process.env.STORAGE_DRIVER === "s3" ? "s3" : "fs";

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

export async function put(key: string, data: Buffer | Uint8Array): Promise<void> {
  if (DRIVER === "s3") return s3Put(key, data);
  return fsPut(key, data);
}

export async function putStream(key: string, stream: ReadableStream<Uint8Array>): Promise<number> {
  if (DRIVER === "s3") {
    const { data, size } = await bufferStream(stream);
    await s3Put(key, data);
    return size;
  }
  return fsPutStream(key, stream);
}

export async function read(key: string): Promise<Buffer> {
  if (DRIVER === "s3") return s3Read(key);
  return fs.readFile(resolveKey(key));
}

/**
 * Streams the object, honouring an optional byte range so video and audio can be
 * scrubbed. Async because the S3 driver has to make a network call to open the stream;
 * callers must `await` it (the fs driver used to return this synchronously — it no
 * longer does).
 */
export async function readStream(
  key: string,
  opts?: { start?: number; end?: number },
): Promise<ReadableStream<Uint8Array>> {
  if (DRIVER === "s3") return s3ReadStream(key, opts);
  return nodeToWebStream(createReadStream(resolveKey(key), opts));
}

export async function stat(key: string): Promise<{ size: number } | null> {
  if (DRIVER === "s3") return s3Stat(key);
  try {
    const s = await fs.stat(resolveKey(key));
    return { size: s.size };
  } catch {
    return null;
  }
}

export async function remove(key: string): Promise<void> {
  if (DRIVER === "s3") return s3Remove(key);
  try {
    await fs.unlink(resolveKey(key));
  } catch {
    // Already gone is a fine outcome for a delete.
  }
}

export function sha256(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** No-op on the s3 driver — a bucket has no root directory to create. */
export async function ensureStorageRoot(): Promise<void> {
  if (DRIVER === "s3") return;
  await fs.mkdir(ROOT, { recursive: true });
}

// --- fs driver ---------------------------------------------------------------------

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");

/**
 * Resolve a storage key to an absolute path, refusing anything that escapes ROOT.
 * Keys reaching this function may come from a URL, so they are untrusted input.
 */
function resolveKey(key: string): string {
  const full = path.resolve(ROOT, key);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (full !== ROOT && !full.startsWith(rootWithSep)) {
    throw new Error("Refusing to resolve a storage key outside the storage root");
  }
  return full;
}

async function fsPut(key: string, data: Buffer | Uint8Array): Promise<void> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

async function fsPutStream(key: string, stream: ReadableStream<Uint8Array>): Promise<number> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const { data, size } = await bufferStream(stream);
  await fs.writeFile(full, data);
  return size;
}

function nodeToWebStream(readable: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return Readable.toWeb(readable as Readable) as ReadableStream<Uint8Array>;
}

// --- s3 driver -----------------------------------------------------------------------
// Talks to any S3-compatible bucket over the standard S3 API — Supabase Storage's S3
// endpoint, Cloudflare R2, or real AWS S3. Supabase-specific only in the endpoint/creds
// an operator points it at; nothing here assumes Supabase.

let _client: S3Client | null = null;
function s3Client(): S3Client {
  if (_client) return _client;
  const endpoint = requireEnv("S3_ENDPOINT");
  const region = process.env.S3_REGION || "auto";
  _client = new S3Client({
    endpoint,
    region,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
  return _client;
}

function s3Bucket(): string {
  return requireEnv("S3_BUCKET");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} — required when STORAGE_DRIVER=s3`);
  return value;
}

async function s3Put(key: string, data: Buffer | Uint8Array): Promise<void> {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: s3Bucket(),
      Key: key,
      Body: data,
    }),
  );
}

async function s3Read(key: string): Promise<Buffer> {
  const res = await s3Client().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty body reading storage key ${key}`);
  return Buffer.from(bytes);
}

async function s3ReadStream(
  key: string,
  opts?: { start?: number; end?: number },
): Promise<ReadableStream<Uint8Array>> {
  const range =
    opts && (opts.start !== undefined || opts.end !== undefined)
      ? `bytes=${opts.start ?? 0}-${opts.end ?? ""}`
      : undefined;
  const res = await s3Client().send(
    new GetObjectCommand({ Bucket: s3Bucket(), Key: key, Range: range }),
  );
  if (!res.Body) throw new Error(`Empty body reading storage key ${key}`);
  // The SDK's Body is a mixed Node/web stream depending on runtime; this is the
  // documented way to get a standard web ReadableStream out of it either way.
  return (res.Body as { transformToWebStream: () => ReadableStream<Uint8Array> }).transformToWebStream();
}

async function s3Stat(key: string): Promise<{ size: number } | null> {
  try {
    const res = await s3Client().send(new HeadObjectCommand({ Bucket: s3Bucket(), Key: key }));
    return { size: res.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

async function s3Remove(key: string): Promise<void> {
  try {
    await s3Client().send(new DeleteObjectCommand({ Bucket: s3Bucket(), Key: key }));
  } catch {
    // Already gone is a fine outcome for a delete.
  }
}

async function bufferStream(stream: ReadableStream<Uint8Array>): Promise<{ data: Buffer; size: number }> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        size += value.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { data: Buffer.concat(chunks), size };
}
