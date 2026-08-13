"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as storage from "@/lib/storage";
import { MAX_BIO_WORDS, countWords } from "@/lib/constants";
import { MAX_LINKS, parseLink, writeLinks, type ProfileLink } from "@/lib/links";

export interface ProfileState {
  error?: string;
  saved?: boolean;
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "You need a name people can call you.")
    .max(60, "That name is a bit long — 60 characters or fewer."),
  bio: z.string().trim().max(4_000),
});

/**
 * Re-encodes an uploaded picture to a bounded JPEG.
 *
 * Two reasons, both mattering more on a platform for young people: it strips EXIF, so a
 * photo taken on a phone doesn't quietly publish the GPS coordinates of a child's house;
 * and it means whatever was uploaded is served as a plain image rather than as its
 * original bytes.
 *
 * The framing is already the author's own — ImageCropper sends a picture cut to exactly
 * this shape — so `fit: "cover"` here only ever rescales. We deliberately do NOT use
 * sharp's attention-based cropping any more: letting an algorithm decide which part of a
 * child's photo matters is how you end up cropping someone's head off.
 */
async function reencode(
  file: File,
  width: number,
  height: number,
  quality: number,
): Promise<Buffer> {
  const input = Buffer.from(await file.arrayBuffer());
  return sharp(input)
    .rotate() // honour EXIF orientation before we discard the metadata
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg({ quality })
    .toBuffer();
}

/**
 * Store, replace, or clear one picture.
 *
 * Returns `{}` when nothing changed, `{ key }` with the new storage key (or `null` to
 * clear), or `{ error }`. The old file is deleted from disk on both replace and clear —
 * an orphaned photo of a child sitting in storage forever is not an acceptable default.
 */
async function handlePicture(input: {
  file: FormDataEntryValue | null;
  /** The picture as uploaded, before the author framed it. */
  original: FormDataEntryValue | null;
  remove: boolean;
  currentKey: string | null;
  currentOriginalKey: string | null;
  filename: string;
  width: number;
  height: number;
  quality: number;
  tooBig: string;
  unreadable: string;
}): Promise<{ key?: string | null; originalKey?: string | null } | { error: string }> {
  const { file, original, remove, currentKey, currentOriginalKey } = input;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) return { error: input.tooBig };
    try {
      const buffer = await reencode(file, input.width, input.height, input.quality);
      const key = storage.buildKey(input.filename);
      await storage.put(key, buffer);
      if (currentKey) await storage.remove(currentKey);

      // Keep the unframed picture too, so tapping it later shows the whole photo rather
      // than the square it was cut to. Bounded and re-encoded exactly like the crop, so
      // EXIF still goes and a 12 MP phone photo doesn't sit on disk at full size.
      let originalKey: string | null = null;
      if (original instanceof File && original.size > 0 && original.size <= MAX_IMAGE_BYTES) {
        try {
          const full = await sharp(Buffer.from(await original.arrayBuffer()))
            .rotate()
            .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 86 })
            .toBuffer();
          originalKey = storage.buildKey(`original-${input.filename}`);
          await storage.put(originalKey, full);
        } catch {
          // A crop that saved but an original that didn't is a smaller problem than
          // rejecting the whole edit, so carry on without it.
          originalKey = null;
        }
      }
      if (currentOriginalKey) await storage.remove(currentOriginalKey);

      return { key, originalKey };
    } catch {
      return { error: input.unreadable };
    }
  }

  if (remove && currentKey) {
    await storage.remove(currentKey);
    if (currentOriginalKey) await storage.remove(currentOriginalKey);
    return { key: null, originalKey: null };
  }

  return {};
}

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };

  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Have another look at the form." };
  }

  const { displayName, bio } = parsed.data;

  const words = countWords(bio);
  if (words > MAX_BIO_WORDS) {
    return {
      error: `That's ${words} words — the limit is ${MAX_BIO_WORDS}. Trim ${words - MAX_BIO_WORDS} and it'll fit.`,
    };
  }

  // Links arrive as parallel arrays of hidden fields. Each one is re-validated here —
  // the browser form is a convenience, never the thing that decides what may be stored.
  const rawUrls = formData.getAll("linkUrl").map(String);
  const rawLabels = formData.getAll("linkLabel").map(String);
  const links: ProfileLink[] = [];

  for (const [index, rawUrl] of rawUrls.entries()) {
    if (links.length >= MAX_LINKS) break;
    const parsed = parseLink(rawUrl, rawLabels[index]);
    if (!parsed.ok) return { error: parsed.error };
    links.push(parsed.link);
  }

  const data: {
    displayName: string;
    bio: string | null;
    links: string | null;
    avatarKey?: string | null;
    coverKey?: string | null;
    avatarOriginalKey?: string | null;
    coverOriginalKey?: string | null;
  } = {
    displayName,
    bio: bio || null,
    links: writeLinks(links),
  };

  await storage.ensureStorageRoot();

  const avatar = await handlePicture({
    file: formData.get("avatar"),
    original: formData.get("avatarOriginal"),
    remove: formData.get("removeAvatar") === "yes",
    currentKey: user.avatarKey,
    currentOriginalKey: user.avatarOriginalKey,
    filename: "avatar.jpg",
    width: 512,
    height: 512,
    quality: 88,
    tooBig: "That picture is over 12 MB. A smaller one will work better anyway.",
    unreadable: "We couldn't read that picture. Try a JPEG or PNG.",
  });
  if ("error" in avatar) return avatar;
  if (avatar.key !== undefined) data.avatarKey = avatar.key;
  if (avatar.originalKey !== undefined) data.avatarOriginalKey = avatar.originalKey;

  const cover = await handlePicture({
    file: formData.get("cover"),
    original: formData.get("coverOriginal"),
    remove: formData.get("removeCover") === "yes",
    currentKey: user.coverKey,
    currentOriginalKey: user.coverOriginalKey,
    filename: "cover.jpg",
    width: 1600,
    height: 400,
    quality: 84,
    tooBig: "That cover image is over 12 MB. Try a smaller one.",
    unreadable: "We couldn't read that cover image. Try a JPEG or PNG.",
  });
  if ("error" in cover) return cover;
  if (cover.key !== undefined) data.coverKey = cover.key;
  if (cover.originalKey !== undefined) data.coverOriginalKey = cover.originalKey;

  await db.user.update({ where: { id: user.id }, data });

  revalidatePath(`/u/${user.handle}`);
  revalidatePath("/settings/profile");
  revalidatePath("/");

  return { saved: true };
}
