"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser, isSuspended } from "@/lib/auth";
import { db } from "@/lib/db";
import * as storage from "@/lib/storage";
import {
  HOBBY_OPTIONS,
  KIND_COPY,
  LETTER_RECIPIENTS,
  OTHER_HOBBY,
  isPostKind,
  isVisibility,
  type AttachmentKind,
  type PostKind,
} from "@/lib/constants";

/**
 * Writing: creating a post of any kind, adding an entry, editing one, deleting one.
 *
 * The upload is accepted and the request returns immediately; the post sits in PENDING,
 * visible to its author with a "we're having a quick look" note, until the background
 * worker finishes. Nobody waits on a progress bar to find out whether their work is
 * allowed.
 */

export interface ComposeState {
  error?: string;
}

const MAX_FILE_BYTES = 512 * 1024 * 1024; // 512 MB — a phone video can be big
const MAX_FILES = 10;

/** MIME prefix / exact type → the kind we store and render. */
function kindFor(mimeType: string, filename: string): AttachmentKind {
  const type = mimeType.toLowerCase();
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (type.startsWith("video/")) return "VIDEO";
  if (type.startsWith("audio/")) return "AUDIO";
  if (type.startsWith("image/")) return "IMAGE";
  if (type === "application/pdf" || ext === "pdf") return "PDF";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword" ||
    ["doc", "docx", "odt", "rtf", "pages"].includes(ext)
  ) {
    return "DOC";
  }
  if (type.startsWith("text/") || ["txt", "md", "markdown"].includes(ext)) return "TEXT";

  // Anything else we can still store and offer as a download.
  return "DOC";
}

async function saveFiles(entryId: string, files: File[], alreadyCount = 0): Promise<string | null> {
  let index = alreadyCount;
  for (const file of files) {
    if (file.size === 0) continue;
    if (index >= MAX_FILES) break;
    if (file.size > MAX_FILE_BYTES) {
      return `"${file.name}" is larger than 512 MB. Could you share a shorter version?`;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = storage.buildKey(file.name);
    await storage.put(key, buffer);

    await db.attachment.create({
      data: {
        entryId,
        kind: kindFor(file.type, file.name),
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: buffer.byteLength,
        storageKey: key,
        sha256: storage.sha256(buffer),
      },
    });
    index++;
  }
  return null;
}

/** Deletes an entry's files from disk as well as the rows. */
async function purgeAttachments(entryId: string, onlyIds?: string[]): Promise<void> {
  const attachments = await db.attachment.findMany({
    where: { entryId, ...(onlyIds ? { id: { in: onlyIds } } : {}) },
    select: { id: true, storageKey: true, posterKey: true },
  });

  for (const attachment of attachments) {
    await storage.remove(attachment.storageKey);
    if (attachment.posterKey) await storage.remove(attachment.posterKey);
  }

  await db.attachment.deleteMany({
    where: { id: { in: attachments.map((a) => a.id) } },
  });
}

const baseSchema = z.object({
  title: z.string().trim().min(1, "Give it a name — even a rough one.").max(200),
  body: z.string().trim().max(20_000),
  visibility: z.string().refine(isVisibility, "Choose who can see this."),
  attest: z.string().optional(),
});

/** Kind-specific metadata, validated per kind rather than trusting the form. */
function readKindFields(
  kind: PostKind,
  formData: FormData,
): { ok: true; post: { hobbyName?: string; recipientType?: string }; entry: { letterTo?: string; letterSubject?: string } } | { ok: false; error: string } {
  if (kind === "HOBBY") {
    const choice = String(formData.get("hobbyName") ?? "").trim();
    const custom = String(formData.get("hobbyCustom") ?? "").trim();

    if (!choice) return { ok: false, error: "Pick the hobby this is about." };

    if (choice === OTHER_HOBBY) {
      if (!custom) return { ok: false, error: "Tell us what the hobby is." };
      return { ok: true, post: { hobbyName: custom.slice(0, 60) }, entry: {} };
    }

    if (!(HOBBY_OPTIONS as readonly string[]).includes(choice)) {
      return { ok: false, error: "Pick a hobby from the list." };
    }
    return { ok: true, post: { hobbyName: choice }, entry: {} };
  }

  if (kind === "LETTER") {
    const recipientType = String(formData.get("recipientType") ?? "").trim();
    const letterTo = String(formData.get("letterTo") ?? "").trim();
    const letterSubject = String(formData.get("letterSubject") ?? "").trim();

    if (!(LETTER_RECIPIENTS as readonly string[]).includes(recipientType)) {
      return { ok: false, error: "Choose who this letter is going to." };
    }
    if (!letterTo) return { ok: false, error: "Write who the letter is addressed to." };
    if (!letterSubject) return { ok: false, error: "Give the letter a subject." };

    return {
      ok: true,
      post: { recipientType },
      entry: { letterTo: letterTo.slice(0, 200), letterSubject: letterSubject.slice(0, 200) },
    };
  }

  return { ok: true, post: {}, entry: {} };
}

/** Letter fields only, for adding or editing an entry on an existing letter. */
function readLetterEntryFields(
  formData: FormData,
): { ok: true; letterTo: string; letterSubject: string } | { ok: false; error: string } {
  const letterTo = String(formData.get("letterTo") ?? "").trim();
  const letterSubject = String(formData.get("letterSubject") ?? "").trim();
  if (!letterTo) return { ok: false, error: "Write who this letter is addressed to." };
  if (!letterSubject) return { ok: false, error: "Give this letter a subject." };
  return { ok: true, letterTo: letterTo.slice(0, 200), letterSubject: letterSubject.slice(0, 200) };
}

/* -------------------------------------------------------------------------- */
/*  Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createPost(
  _prev: ComposeState,
  formData: FormData,
): Promise<ComposeState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };

  if (isSuspended(user)) {
    return {
      error:
        "You're on a short pause from posting at the moment. Everything you've already shared is still here.",
    };
  }

  const rawKind = String(formData.get("kind") ?? "");
  if (!isPostKind(rawKind)) return { error: "Something went wrong — try again." };
  const kind = rawKind;

  const parsed = baseSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    visibility: formData.get("visibility"),
    attest: formData.get("attest") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Have another look at the form." };
  }

  const extra = readKindFields(kind, formData);
  if (!extra.ok) return { error: extra.error };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const hasFiles = files.some((f) => f.size > 0);

  if (!parsed.data.body && !hasFiles) {
    return { error: "Write something, or attach something. Either is enough." };
  }
  if (hasFiles && !parsed.data.attest) {
    return { error: "Just confirm the work is yours to share, then we're good." };
  }

  await storage.ensureStorageRoot();

  const post = await db.post.create({
    data: {
      authorId: user.id,
      kind,
      title: parsed.data.title,
      visibility: parsed.data.visibility,
      moderationStatus: "PENDING",
      ...extra.post,
    },
  });

  const entry = await db.entry.create({
    data: {
      postId: post.id,
      body: parsed.data.body,
      ordinal: 1,
      originalityAttested: Boolean(parsed.data.attest),
      ...extra.entry,
    },
  });

  const fileError = await saveFiles(entry.id, files);
  if (fileError) {
    await db.post.delete({ where: { id: post.id } });
    return { error: fileError };
  }

  revalidatePath("/");
  redirect(`/post/${post.id}`);
}

/* -------------------------------------------------------------------------- */
/*  Add an entry                                                               */
/* -------------------------------------------------------------------------- */

/** The journal grows: another chapter, memory, lesson or letter on something you started. */
export async function addEntry(
  _prev: ComposeState,
  formData: FormData,
): Promise<ComposeState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };
  if (isSuspended(user)) {
    return { error: "You're on a short pause from posting at the moment." };
  }

  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const attest = formData.get("attest");

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, kind: true },
  });
  if (!post || post.authorId !== user.id) {
    return { error: "That's not yours to add to." };
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const hasFiles = files.some((f) => f.size > 0);

  const letterFields: { letterTo?: string; letterSubject?: string } = {};
  if (post.kind === "LETTER") {
    const letter = readLetterEntryFields(formData);
    if (!letter.ok) return { error: letter.error };
    letterFields.letterTo = letter.letterTo;
    letterFields.letterSubject = letter.letterSubject;
  }

  if (!body && !hasFiles) {
    const noun = KIND_COPY[post.kind as PostKind].entryNoun.toLowerCase();
    return { error: `Add a note or a file to this ${noun}.` };
  }
  if (hasFiles && !attest) return { error: "Just confirm the work is yours to share." };

  const last = await db.entry.findFirst({
    where: { postId },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });

  const entry = await db.entry.create({
    data: {
      postId,
      body,
      ordinal: (last?.ordinal ?? 0) + 1,
      originalityAttested: Boolean(attest),
      ...letterFields,
    },
  });

  const fileError = await saveFiles(entry.id, files);
  if (fileError) {
    await db.entry.delete({ where: { id: entry.id } });
    return { error: fileError };
  }

  // A new entry goes back through the same check as a new post.
  await db.post.update({
    where: { id: postId },
    data: { lastEntryAt: new Date(), moderationStatus: "PENDING" },
  });

  revalidatePath(`/post/${postId}`);
  redirect(`/post/${postId}`);
}

/* -------------------------------------------------------------------------- */
/*  Edit an entry                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Editing rewrites one entry in place. The post goes back to PENDING and the entry's
 * `updatedAt` moves past its `moderatedAt`, so the worker re-checks THIS entry rather
 * than the post's oldest one. Without that, "post something harmless, then edit it into
 * whatever you like" would be an open door straight past moderation.
 */
export async function editEntry(
  _prev: ComposeState,
  formData: FormData,
): Promise<ComposeState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };

  const entryId = String(formData.get("entryId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  const entry = await db.entry.findUnique({
    where: { id: entryId },
    include: {
      post: { select: { id: true, authorId: true, kind: true } },
      _count: { select: { attachments: true } },
    },
  });
  if (!entry || entry.post.authorId !== user.id) {
    return { error: "That's not yours to edit." };
  }

  const removeIds = formData
    .getAll("removeAttachment")
    .map(String)
    .filter(Boolean);

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const hasNewFiles = files.some((f) => f.size > 0);
  const remaining = entry._count.attachments - removeIds.length;

  const letterFields: { letterTo?: string; letterSubject?: string } = {};
  if (entry.post.kind === "LETTER") {
    const letter = readLetterEntryFields(formData);
    if (!letter.ok) return { error: letter.error };
    letterFields.letterTo = letter.letterTo;
    letterFields.letterSubject = letter.letterSubject;
  }

  if (!body && remaining <= 0 && !hasNewFiles) {
    return { error: "Leave some words or a file — an empty one can't be saved." };
  }
  if (hasNewFiles && !formData.get("attest")) {
    return { error: "Just confirm the new files are yours to share." };
  }

  if (removeIds.length > 0) await purgeAttachments(entryId, removeIds);

  if (hasNewFiles) {
    const fileError = await saveFiles(entryId, files, Math.max(0, remaining));
    if (fileError) return { error: fileError };
  }

  await db.entry.update({
    where: { id: entryId },
    // contentUpdatedAt is what marks this as edited and what sends it back through
    // moderation. It is set here and nowhere else, so incidental row writes (an ordinal
    // shifting after a sibling is deleted) never masquerade as an edit.
    data: { body, ...letterFields, contentUpdatedAt: new Date() },
  });

  await db.post.update({
    where: { id: entry.post.id },
    data: { moderationStatus: "PENDING" },
  });

  revalidatePath(`/post/${entry.post.id}`);
  redirect(`/post/${entry.post.id}`);
}

/** Rename a post. Never allowed to become empty. */
export async function editTitle(
  _prev: ComposeState,
  formData: FormData,
): Promise<ComposeState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };

  const postId = String(formData.get("postId") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!title) return { error: "A title can't be empty." };

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post || post.authorId !== user.id) return { error: "That's not yours to rename." };

  await db.post.update({ where: { id: postId }, data: { title: title.slice(0, 200) } });

  revalidatePath(`/post/${postId}`);
  return {};
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export interface DeleteState {
  error?: string;
}

/**
 * Delete exactly one entry.
 *
 * There is deliberately no way to remove a whole journal in a single action. Entries go
 * one at a time, and only when a post is down to its last one can that last one — and
 * with it the post — be removed. Someone who has kept a hobby for two years should not
 * be able to lose it to one mis-click, and a platform built to make young people feel
 * safe sharing cannot also make their work easy to destroy by accident.
 */
export async function deleteEntry(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };

  const entryId = String(formData.get("entryId") ?? "");

  const entry = await db.entry.findUnique({
    where: { id: entryId },
    include: {
      post: { select: { id: true, authorId: true, _count: { select: { entries: true } } } },
    },
  });
  if (!entry || entry.post.authorId !== user.id) {
    return { error: "That's not yours to delete." };
  }

  const postId = entry.post.id;
  const isLastOne = entry.post._count.entries <= 1;

  // Deleting the last entry removes the post too, and that needs saying out loud first.
  if (isLastOne && formData.get("confirmWholePost") !== "yes") {
    return {
      error: "This is the only one left, so deleting it removes the whole thing. Tick the box if you're sure.",
    };
  }

  await purgeAttachments(entryId);

  if (isLastOne) {
    await db.post.delete({ where: { id: postId } });
    revalidatePath("/");
    redirect(`/u/${user.handle}`);
  }

  await db.entry.delete({ where: { id: entryId } });

  // Close the gap so the journal still reads 1, 2, 3. Ascending order means each entry
  // only ever moves down into a number that has just been vacated, so the
  // [postId, ordinal] uniqueness holds at every step.
  const rest = await db.entry.findMany({
    where: { postId },
    orderBy: { ordinal: "asc" },
    select: { id: true, ordinal: true },
  });
  for (const [index, row] of rest.entries()) {
    const wanted = index + 1;
    if (row.ordinal !== wanted) {
      await db.entry.update({ where: { id: row.id }, data: { ordinal: wanted } });
    }
  }

  const newest = rest[rest.length - 1];
  if (newest) {
    const newestRow = await db.entry.findUnique({
      where: { id: newest.id },
      select: { createdAt: true },
    });
    if (newestRow) {
      await db.post.update({
        where: { id: postId },
        data: { lastEntryAt: newestRow.createdAt },
      });
    }
  }

  revalidatePath(`/post/${postId}`);
  return {};
}

/* -------------------------------------------------------------------------- */
/*  Visibility                                                                 */
/* -------------------------------------------------------------------------- */

/** Change who can see a post. Always available, in both directions. */
export async function setVisibility(postId: string, visibility: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || !isVisibility(visibility)) return;

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true, author: { select: { handle: true } } },
  });
  if (!post || post.authorId !== user.id) return;

  await db.post.update({ where: { id: postId }, data: { visibility } });
  revalidatePath(`/post/${postId}`);
  revalidatePath(`/u/${post.author.handle}`);
  revalidatePath("/");
}
