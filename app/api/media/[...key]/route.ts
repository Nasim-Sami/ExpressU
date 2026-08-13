import { NextResponse } from "next/server";

import { getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import * as storage from "@/lib/storage";
import { canView } from "@/lib/visibility";
import type { ModerationStatus, Visibility } from "@/lib/constants";

/**
 * Every byte of uploaded media is served from here, and every request runs the same
 * `canView` check as the page that embeds it.
 *
 * This is why `storage/` is not inside `public/`. If uploads were static files, a private
 * video would be readable by anyone who learned or guessed its URL, and the promise the
 * composer makes — "just me" — would be false. A leaked link is the most likely way a
 * young person's private post escapes, so the check lives on the file itself, not only on
 * the page around it.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");

  const viewer = await getViewer();

  // 1. Is this an attachment (or its derived poster)?
  const attachment = await db.attachment.findFirst({
    where: { OR: [{ storageKey: key }, { posterKey: key }] },
    select: {
      mimeType: true,
      posterKey: true,
      storageKey: true,
      entry: {
        select: {
          post: {
            select: { authorId: true, visibility: true, moderationStatus: true },
          },
        },
      },
    },
  });

  if (attachment) {
    const post = attachment.entry.post;
    const allowed = canView(viewer, {
      authorId: post.authorId,
      visibility: post.visibility as Visibility,
      moderationStatus: post.moderationStatus as ModerationStatus,
    });

    // 404 rather than 403: a "forbidden" would confirm the file exists, which itself
    // leaks something about a private post.
    if (!allowed) return new NextResponse("Not found", { status: 404 });

    // Derived posters are always JPEG regardless of the source file's type.
    const contentType = key === attachment.posterKey ? "image/jpeg" : attachment.mimeType;
    return serve(key, contentType, request);
  }

  // 2. Profile pictures and covers. Profiles themselves are not private on ExpressU —
  //    only ideas are — so these need no further check.
  const user = await db.user.findFirst({
    where: {
      OR: [
        { avatarKey: key },
        { coverKey: key },
        // The unframed uploads are reachable too — they're what opens when someone taps
        // a profile picture, and without these rows they'd 404.
        { avatarOriginalKey: key },
        { coverOriginalKey: key },
      ],
    },
    select: { id: true },
  });
  if (user) return serve(key, "image/jpeg", request);

  // 3. Books: covers, and the original file the uploader gave us. These follow the
  //    reading room's own rule — published to everyone, or visible to the uploader alone
  //    while it's still being checked.
  const book = await db.book.findFirst({
    where: { OR: [{ coverKey: key }, { sourceKey: key }] },
    select: { coverKey: true, moderationStatus: true, uploaderId: true, sourceMimeType: true },
  });

  if (book) {
    const allowed =
      book.moderationStatus === "LIVE" ||
      Boolean(viewer && book.uploaderId && viewer.id === book.uploaderId);
    if (!allowed) return new NextResponse("Not found", { status: 404 });

    const contentType =
      key === book.coverKey ? "image/jpeg" : (book.sourceMimeType ?? "application/octet-stream");
    return serve(key, contentType, request);
  }

  return new NextResponse("Not found", { status: 404 });
}

/** Streams the file, honouring Range requests so video and audio can be scrubbed. */
async function serve(key: string, contentType: string, request: Request) {
  const info = await storage.stat(key);
  if (!info) return new NextResponse("Not found", { status: 404 });

  const range = request.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : info.size - 1;

      if (start >= info.size || end >= info.size || start > end) {
        return new NextResponse("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${info.size}` },
        });
      }

      const stream = storage.readStream(key, { start, end });
      return new NextResponse(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
          // Private: this response depends on who asked, so no shared cache may keep it.
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const stream = storage.readStream(key);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
      // Uploaded files are untrusted content; never let one execute as a page.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
