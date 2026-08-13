import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Speech-to-text via whisper.cpp, running locally.
 *
 * Local on purpose: this is children's audio. It should not be shipped to a third-party
 * transcription service just so we can check it for explicit content. The only thing that
 * leaves this machine is the resulting text, and only to the moderation model.
 *
 * Transcription is OPTIONAL. If whisper isn't installed, every function here returns null
 * and moderation proceeds on frames, caption, and metadata alone. A missing dev dependency
 * must never be the reason a young person can't post.
 *
 *   brew install whisper-cpp
 *   curl -L -o models/ggml-base.en.bin \
 *     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
 */

const BINARY = process.env.WHISPER_BIN ?? "whisper-cli";
const MODEL = process.env.WHISPER_MODEL ?? "./models/ggml-base.en.bin";
const TIMEOUT_MS = 300_000;

let availability: boolean | null = null;

export async function transcriptionAvailable(): Promise<boolean> {
  if (availability !== null) return availability;
  try {
    await run(BINARY, ["--help"], { timeout: 15_000 });
    await fs.access(path.resolve(MODEL));
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

/** Returns the transcript, or null when transcription is unavailable or fails. */
export async function transcribe(wavPath: string): Promise<string | null> {
  if (!(await transcriptionAvailable())) return null;

  const outBase = wavPath.replace(/\.wav$/, "");
  try {
    await run(
      BINARY,
      [
        "-m",
        path.resolve(MODEL),
        "-f",
        wavPath,
        "--output-txt",
        "--output-file",
        outBase,
        "--no-timestamps",
        "--print-progress",
        "false",
      ],
      { timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
    );

    const text = await fs.readFile(`${outBase}.txt`, "utf8");
    await fs.rm(`${outBase}.txt`, { force: true });
    return text.trim() || null;
  } catch {
    return null;
  }
}
