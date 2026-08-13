import "server-only";

import sharp from "sharp";

/**
 * Perceptual hashing, used to catch a video or image that has already been uploaded to
 * ExpressU in a slightly different form — re-encoded, resized, trimmed, or screenshotted.
 *
 * This is a pHash (DCT-based) rather than the simpler aHash/dHash, because the thing we
 * are actually defending against is a re-upload that went through a compression pass.
 * DCT throws away the high-frequency detail that compression mangles and keeps the coarse
 * structure a human would recognise as "the same clip".
 *
 * What this CANNOT do — and no amount of cleverness here would change it — is tell you
 * that a video came from YouTube. It only ever compares against media already on our own
 * platform. See lib/moderation/ for the layer that looks for platform watermarks.
 */

const SIZE = 32; // DCT input
const KEEP = 8; // low-frequency square we actually hash

/** Precomputed DCT-II basis: cos((2x+1) * u * pi / 2N). */
const COS = (() => {
  const table = new Float64Array(SIZE * SIZE);
  for (let x = 0; x < SIZE; x++) {
    for (let u = 0; u < SIZE; u++) {
      table[x * SIZE + u] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * SIZE));
    }
  }
  return table;
})();

function dct2d(input: Float64Array): Float64Array {
  // Separable: rows first, then columns.
  const rows = new Float64Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let u = 0; u < SIZE; u++) {
      let sum = 0;
      for (let x = 0; x < SIZE; x++) {
        sum += input[y * SIZE + x] * COS[x * SIZE + u];
      }
      rows[y * SIZE + u] = sum * (u === 0 ? Math.SQRT1_2 : 1);
    }
  }

  const out = new Float64Array(SIZE * SIZE);
  for (let u = 0; u < SIZE; u++) {
    for (let v = 0; v < SIZE; v++) {
      let sum = 0;
      for (let y = 0; y < SIZE; y++) {
        sum += rows[y * SIZE + u] * COS[y * SIZE + v];
      }
      out[v * SIZE + u] = sum * (v === 0 ? Math.SQRT1_2 : 1);
    }
  }
  return out;
}

/**
 * Below this, an image has essentially no structure — a plain background, a blank scan,
 * a solid-colour frame. Measured as the mean absolute value of the retained AC
 * coefficients; see hash.test.ts for the measurements this number comes from.
 *
 * A featureless image's hash is determined by rounding noise rather than by content, so
 * two unrelated blank pictures can land close together purely by chance. Hashing them
 * anyway is how a perceptual matcher ends up telling a young person that their photo of
 * a white wall was stolen from someone else.
 */
export const MIN_AC_ENERGY = 40;

/** Shared front half of the hash: greyscale → 32×32 → DCT → retained AC coefficients. */
async function coefficientsFor(image: Buffer): Promise<number[]> {
  const raw = await sharp(image)
    .greyscale()
    .resize(SIZE, SIZE, { fit: "fill" })
    .raw()
    .toBuffer();

  const pixels = new Float64Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) pixels[i] = raw[i];

  const freq = dct2d(pixels);

  // Top-left KEEP x KEEP block, dropping the DC term, which only carries overall
  // brightness and would make the hash sensitive to exposure changes.
  const coefficients: number[] = [];
  for (let v = 0; v < KEEP; v++) {
    for (let u = 0; u < KEEP; u++) {
      if (u === 0 && v === 0) continue;
      coefficients.push(freq[v * SIZE + u]);
    }
  }
  return coefficients;
}

/** How much visual structure an image actually has. Exported so the threshold is testable. */
export async function acEnergy(image: Buffer): Promise<number> {
  const coefficients = await coefficientsFor(image);
  const total = coefficients.reduce((sum, c) => sum + Math.abs(c), 0);
  return total / coefficients.length;
}

/**
 * 64-bit perceptual hash as a 16-character hex string, or **null** when the image has too
 * little structure for a perceptual hash to mean anything. A null hash simply opts that
 * attachment out of perceptual matching — the exact SHA-256 check still applies to it.
 */
export async function perceptualHash(image: Buffer): Promise<string | null> {
  const coefficients = await coefficientsFor(image);

  const energy =
    coefficients.reduce((sum, c) => sum + Math.abs(c), 0) / coefficients.length;
  if (energy < MIN_AC_ENERGY) return null;

  const sorted = [...coefficients].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // 63 coefficients + a padding bit = 64.
  let bits = "";
  for (const c of coefficients) bits += c > median ? "1" : "0";
  bits += "0";

  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Number of differing bits between two hex hashes. Lower means more similar. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Threshold for "this is the same media".
 *
 * 64-bit pHash: identical content sits at 0-2, a re-encode or resize typically 3-8,
 * genuinely different images almost always above 20. We use 8, deliberately on the
 * strict side. A false positive here accuses a young person of reposting something
 * they actually made, which is the worst mistake this system can make — so when a
 * comparison lands in the ambiguous band we would rather miss it and let the
 * watermark check (and a human) decide.
 */
export const PHASH_MATCH_THRESHOLD = 8;

export function isPerceptualMatch(a: string, b: string): boolean {
  return hammingDistance(a, b) <= PHASH_MATCH_THRESHOLD;
}
