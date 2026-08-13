import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

/** Cap on any single ffmpeg invocation, so a malformed upload can't wedge the worker. */
const TIMEOUT_MS = 120_000;

export interface MediaProbe {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

export async function probe(filePath: string): Promise<MediaProbe> {
  const { stdout } = await run(
    FFPROBE,
    [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ],
    { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
  );

  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
    }>;
  };

  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const duration = parsed.format?.duration ? Number(parsed.format.duration) : null;

  return {
    durationSec: Number.isFinite(duration) ? duration : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    hasVideo: Boolean(video),
    hasAudio: streams.some((s) => s.codec_type === "audio"),
  };
}

async function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "expressu-"));
}

/**
 * Grab `count` frames spread evenly across the clip.
 *
 * Even spacing matters for the originality check: a TikTok watermark often only appears
 * in some frames, and burned-in handles are frequently in the first or last second. A
 * single thumbnail from the midpoint would miss both.
 */
export async function extractKeyframes(
  filePath: string,
  count = 6,
): Promise<Buffer[]> {
  const { durationSec } = await probe(filePath);
  const dir = await tempDir();

  try {
    const frames: Buffer[] = [];
    // Skip the very start and end — often black or a fade.
    const span = durationSec && durationSec > 1 ? durationSec : 1;
    for (let i = 0; i < count; i++) {
      const at = (span * (i + 0.5)) / count;
      const out = path.join(dir, `frame-${i}.jpg`);
      try {
        await run(
          FFMPEG,
          [
            "-ss",
            at.toFixed(3),
            "-i",
            filePath,
            "-frames:v",
            "1",
            "-vf",
            "scale='min(720,iw)':-2",
            "-q:v",
            "4",
            "-y",
            out,
          ],
          { timeout: TIMEOUT_MS },
        );
        frames.push(await fs.readFile(out));
      } catch {
        // A seek past the end of a short or damaged clip just yields no frame here.
      }
    }
    return frames;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** A single representative frame for the card thumbnail. */
export async function extractPoster(filePath: string): Promise<Buffer | null> {
  const { durationSec } = await probe(filePath);
  const at = durationSec && durationSec > 2 ? durationSec * 0.25 : 0;
  const dir = await tempDir();
  const out = path.join(dir, "poster.jpg");

  try {
    await run(
      FFMPEG,
      [
        "-ss",
        at.toFixed(3),
        "-i",
        filePath,
        "-frames:v",
        "1",
        "-vf",
        "scale='min(1280,iw)':-2",
        "-q:v",
        "3",
        "-y",
        out,
      ],
      { timeout: TIMEOUT_MS },
    );
    return await fs.readFile(out);
  } catch {
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * Strip audio to 16 kHz mono WAV — what whisper.cpp wants. Returns a temp file path the
 * caller is responsible for cleaning up (see `withExtractedAudio`).
 */
export async function extractAudioWav(filePath: string): Promise<string | null> {
  const { hasAudio } = await probe(filePath);
  if (!hasAudio) return null;

  const dir = await tempDir();
  const out = path.join(dir, "audio.wav");

  try {
    await run(
      FFMPEG,
      ["-i", filePath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-y", out],
      { timeout: TIMEOUT_MS },
    );
    return out;
  } catch {
    await fs.rm(dir, { recursive: true, force: true });
    return null;
  }
}

/** Extract audio, hand it to `fn`, and always clean up the temp directory afterwards. */
export async function withExtractedAudio<T>(
  filePath: string,
  fn: (wavPath: string | null) => Promise<T>,
): Promise<T> {
  const wav = await extractAudioWav(filePath);
  try {
    return await fn(wav);
  } finally {
    if (wav) await fs.rm(path.dirname(wav), { recursive: true, force: true });
  }
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await run(FFMPEG, ["-version"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}
