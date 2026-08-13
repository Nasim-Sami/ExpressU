import "server-only";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import { db } from "@/lib/db";
import * as storage from "@/lib/storage";
import { extractKeyframes, extractPoster, probe, withExtractedAudio } from "./ffmpeg";
import { perceptualHash } from "./hash";
import { extractDocxText, extractPdfText, extractPlainText } from "./text";
import { transcribe } from "./transcribe";

/**
 * Derive everything moderation and the UI need from a raw upload: a poster frame, a
 * perceptual hash, a duration, a transcript, a text layer.
 *
 * Runs in the background worker, never in the request that accepted the upload. A young
 * person posts and gets on with their day; nobody watches a progress bar while a machine
 * decides about their work.
 */

export interface ProcessedMedia {
  frames: Buffer[];
  transcript: string | null;
  documentText: string | null;
}

/** Writes derived fields back to the Attachment row and returns what moderation needs. */
export async function processAttachment(attachmentId: string): Promise<ProcessedMedia> {
  const attachment = await db.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new Error(`No attachment ${attachmentId}`);

  const empty: ProcessedMedia = { frames: [], transcript: null, documentText: null };

  try {
    switch (attachment.kind) {
      case "VIDEO":
        return await processVideo(attachment.id, attachment.storageKey);
      case "AUDIO":
        return await processAudio(attachment.id, attachment.storageKey);
      case "IMAGE":
        return await processImage(attachment.id, attachment.storageKey);
      case "PDF":
        return await processPdf(attachment.id, attachment.storageKey);
      case "DOC":
        return await processDoc(attachment.id, attachment.storageKey);
      case "TEXT":
        return await processText(attachment.id, attachment.storageKey);
      default:
        await markReady(attachment.id);
        return empty;
    }
  } catch (error) {
    await db.attachment.update({
      where: { id: attachment.id },
      data: { processingStatus: "FAILED" },
    });
    // A processing failure must not swallow the post. Moderation proceeds with whatever
    // we did manage to derive, and a human sees the gap.
    console.error(`[media] failed to process ${attachment.id}:`, error);
    return empty;
  }
}

async function markReady(id: string, data: Record<string, unknown> = {}) {
  await db.attachment.update({
    where: { id },
    data: { processingStatus: "READY", ...data },
  });
}

/** ffmpeg needs a real path, so stream the object out to a temp file first. */
async function withLocalFile<T>(key: string, fn: (filePath: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "expressu-src-"));
  const filePath = path.join(dir, path.basename(key));
  try {
    await fs.writeFile(filePath, await storage.read(key));
    return await fn(filePath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function processVideo(id: string, key: string): Promise<ProcessedMedia> {
  return withLocalFile(key, async (filePath) => {
    const info = await probe(filePath);

    // Poster: the thumbnail on the card, and the image we perceptually hash.
    let posterKey: string | null = null;
    let phash: string | null = null;
    const poster = await extractPoster(filePath);
    if (poster) {
      posterKey = `${key}.poster.jpg`;
      await storage.put(posterKey, poster);
      phash = await perceptualHash(poster);
    }

    // Frames spread across the clip — watermarks hide in some frames and not others.
    const frames = await extractKeyframes(filePath, 6);

    const transcript = await withExtractedAudio(filePath, async (wav) =>
      wav ? await transcribe(wav) : null,
    );

    await markReady(id, {
      durationSec: info.durationSec,
      width: info.width,
      height: info.height,
      posterKey,
      phash,
      extractedText: transcript,
    });

    return { frames, transcript, documentText: null };
  });
}

async function processAudio(id: string, key: string): Promise<ProcessedMedia> {
  return withLocalFile(key, async (filePath) => {
    const info = await probe(filePath);
    const transcript = await withExtractedAudio(filePath, async (wav) =>
      wav ? await transcribe(wav) : null,
    );

    await markReady(id, { durationSec: info.durationSec, extractedText: transcript });
    return { frames: [], transcript, documentText: null };
  });
}

async function processImage(id: string, key: string): Promise<ProcessedMedia> {
  const data = await storage.read(key);
  const meta = await sharp(data).metadata();
  const phash = await perceptualHash(data);

  // A web-friendly version so a 12 MP phone photo doesn't get sent down the wire whole.
  const posterKey = `${key}.view.jpg`;
  await storage.put(
    posterKey,
    await sharp(data).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer(),
  );

  await markReady(id, {
    width: meta.width ?? null,
    height: meta.height ?? null,
    phash,
    posterKey,
  });

  // The image itself is what moderation looks at.
  const forModel = await sharp(data)
    .rotate()
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return { frames: [forModel], transcript: null, documentText: null };
}

async function processPdf(id: string, key: string): Promise<ProcessedMedia> {
  const data = await storage.read(key);
  const { text, pageCount } = await extractPdfText(data);
  await markReady(id, { pageCount, extractedText: text || null });
  return { frames: [], transcript: null, documentText: text || null };
}

async function processDoc(id: string, key: string): Promise<ProcessedMedia> {
  const text = await extractDocxText(await storage.read(key));
  await markReady(id, { extractedText: text || null });
  return { frames: [], transcript: null, documentText: text || null };
}

async function processText(id: string, key: string): Promise<ProcessedMedia> {
  const text = extractPlainText(await storage.read(key));
  await markReady(id, { extractedText: text || null });
  return { frames: [], transcript: null, documentText: text || null };
}
