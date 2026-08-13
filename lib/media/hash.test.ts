import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  MIN_AC_ENERGY,
  PHASH_MATCH_THRESHOLD,
  acEnergy,
  hammingDistance,
  perceptualHash,
} from "./hash";

/**
 * Calibration for the re-upload detector, tested in both directions.
 *
 * These assertions guard a decision with real stakes: a false positive tells a young
 * person that the thing they made and were proudest of was stolen from someone else. The
 * threshold must be loose enough to catch an actual re-upload and tight enough that two
 * unrelated pictures are never confused — and if someone later "tunes" these numbers,
 * this file is what stops them tuning it into an accusation machine.
 */

const CIRCLES = `<svg width="400" height="300"><rect width="400" height="300" fill="#fff"/><circle cx="120" cy="110" r="70" fill="#333"/><circle cx="280" cy="200" r="50" fill="#888"/></svg>`;

const TEXT_PAGE = `<svg width="400" height="300"><rect width="400" height="300" fill="#fff"/>${Array.from(
  { length: 12 },
  (_, i) => `<rect x="30" y="${28 + i * 20}" width="${200 + ((i * 37) % 140)}" height="8" fill="#222"/>`,
).join("")}</svg>`;

const SKETCH = `<svg width="400" height="300"><rect width="400" height="300" fill="#f4f1ea"/><path d="M40 260 L120 80 L200 200 L280 60 L360 240" stroke="#222" stroke-width="6" fill="none"/><rect x="150" y="150" width="90" height="90" fill="#b45309"/></svg>`;

const solid = (r: number, g: number, b: number) =>
  sharp({ create: { width: 400, height: 300, channels: 3, background: { r, g, b } } })
    .jpeg()
    .toBuffer();

const svg = (markup: string) => sharp(Buffer.from(markup)).jpeg().toBuffer();

describe("images with no structure are never hashed at all", () => {
  // A blank wall, a solid-colour frame, an empty scan. Their bit pattern comes from
  // rounding noise, so two unrelated ones can collide by pure chance. Refusing to hash
  // them is what keeps that from becoming an accusation.
  it.each([
    ["a flat warm colour", () => solid(240, 120, 40)],
    ["a flat blue", () => solid(90, 150, 230)],
    ["a nearly-black frame", () => solid(25, 22, 20)],
  ])("returns null for %s", async (_label, make) => {
    const image = await make();
    expect(await acEnergy(image)).toBeLessThan(MIN_AC_ENERGY);
    expect(await perceptualHash(image)).toBeNull();
  });

  it("leaves a wide margin between unhashable and genuinely structured images", async () => {
    const flat = await acEnergy(await solid(200, 200, 200));
    const structured = await acEnergy(await svg(CIRCLES));

    expect(flat).toBeLessThan(MIN_AC_ENERGY);
    // Real content clears the bar by orders of magnitude, so the cutoff never has to be
    // a fine judgement call.
    expect(structured).toBeGreaterThan(MIN_AC_ENERGY * 10);
  });
});

describe("unrelated images must never be confused", () => {
  it("keeps every pair of different pictures far above the match threshold", async () => {
    const images: Record<string, Buffer> = {
      circles: await svg(CIRCLES),
      "text page": await svg(TEXT_PAGE),
      sketch: await svg(SKETCH),
    };

    const names = Object.keys(images);
    const hashes: Record<string, string> = {};
    for (const name of names) {
      const hash = await perceptualHash(images[name]);
      expect(hash, `${name} should be hashable`).not.toBeNull();
      hashes[name] = hash!;
    }

    const failures: string[] = [];
    let closest = Infinity;

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const distance = hammingDistance(hashes[names[i]], hashes[names[j]]);
        closest = Math.min(closest, distance);
        if (distance <= PHASH_MATCH_THRESHOLD) {
          failures.push(`${names[i]} vs ${names[j]} = ${distance} bits`);
        }
      }
    }

    expect(
      failures,
      `these would accuse someone of reposting their own work: ${failures.join("; ")}`,
    ).toEqual([]);
    // A comfortable margin, not a squeaker.
    expect(closest).toBeGreaterThan(PHASH_MATCH_THRESHOLD * 2);
  });
});

describe("a genuine re-upload should still be caught", () => {
  it("matches the same image through recompression, resizing and screenshotting", async () => {
    const original = await svg(CIRCLES);
    const originalHash = (await perceptualHash(original))!;
    expect(originalHash).not.toBeNull();

    const variants: Record<string, Buffer> = {
      "recompressed at q40": await sharp(original).jpeg({ quality: 40 }).toBuffer(),
      "resized to 50%": await sharp(original).resize(200, 150).toBuffer(),
      "screenshotted": await sharp(original).resize(320, 240).jpeg({ quality: 55 }).toBuffer(),
    };

    for (const [name, buffer] of Object.entries(variants)) {
      const hash = await perceptualHash(buffer);
      expect(hash, `${name} became unhashable`).not.toBeNull();
      const distance = hammingDistance(originalHash, hash!);
      expect(distance, `${name} slipped past at ${distance} bits`).toBeLessThanOrEqual(
        PHASH_MATCH_THRESHOLD,
      );
    }
  });

  it("is identical to itself", async () => {
    const image = await svg(CIRCLES);
    const a = (await perceptualHash(image))!;
    const b = (await perceptualHash(image))!;
    expect(hammingDistance(a, b)).toBe(0);
  });
});

describe("hamming distance", () => {
  it("treats different-length hashes as maximally distant rather than matching", () => {
    // Fail open on malformed input: never report a match we cannot actually justify.
    expect(hammingDistance("abcd", "abcdef")).toBeGreaterThan(PHASH_MATCH_THRESHOLD);
  });
});
