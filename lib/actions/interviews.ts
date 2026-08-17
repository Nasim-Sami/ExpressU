"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser, getViewer, isSuspended } from "@/lib/auth";
import { db } from "@/lib/db";
import * as storage from "@/lib/storage";
import { saveFiles } from "./posts";
import { MAX_INTERVIEW_QUESTIONS, isVisibility } from "@/lib/constants";
import { canView } from "@/lib/visibility";
import { scheduleAnswerCheck, scheduleEntryCheck } from "@/lib/moderation/schedule";
import type { ModerationStatus, Visibility } from "@/lib/constants";

/**
 * Open Interviews: asking, following up, and answering.
 *
 * The interview itself is an ordinary Post, so creating one reuses everything a post
 * already has — visibility, moderation, Love, notes, reporting. What lives here is the
 * part that is genuinely new: questions attached to a round, and other people's answers
 * attached to those questions.
 *
 * The rule that shapes this file: **an answer is treated exactly like a post, not like a
 * comment.** It is somebody else's writing and media, so it gets its own moderation pass
 * and stays invisible to everyone but its author until that passes. ExpressU has no
 * comments precisely because unmoderated replies are where platforms hurt people; an
 * answer box would be a comment box wearing a hat if it skipped the check.
 */

export interface InterviewState {
  error?: string;
}

const MAX_QUESTION_LENGTH = 300;

function readQuestions(formData: FormData): { ok: true; questions: string[] } | { ok: false; error: string } {
  const questions: string[] = [];

  for (let i = 0; i < MAX_INTERVIEW_QUESTIONS; i++) {
    const raw = String(formData.get(`question${i}`) ?? "").trim();
    if (!raw) continue;
    if (raw.length > MAX_QUESTION_LENGTH) {
      return { ok: false, error: `Keep each question under ${MAX_QUESTION_LENGTH} characters.` };
    }
    questions.push(raw);
  }

  if (questions.length === 0) return { ok: false, error: "Ask at least one question." };
  return { ok: true, questions };
}

/* -------------------------------------------------------------------------- */
/*  Opening an interview                                                        */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the interview a title.").max(200),
  body: z.string().trim().max(20_000),
  visibility: z.string().refine(isVisibility, "Choose who can answer this."),
});

export async function createInterview(
  _prev: InterviewState,
  formData: FormData,
): Promise<InterviewState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };
  if (isSuspended(user)) {
    return { error: "You're on a short pause from posting at the moment." };
  }

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Have another look at the form." };
  }

  const questions = readQuestions(formData);
  if (!questions.ok) return { error: questions.error };

  // An interview nobody can open is an interview nobody can answer. Caught here rather
  // than left as a puzzle for someone wondering why their questions sit in silence.
  if (parsed.data.visibility === "PRIVATE") {
    return {
      error:
        "An interview set to “Just me” can't be answered by anyone. Choose Everyone or My circle.",
    };
  }

  const post = await db.post.create({
    data: {
      authorId: user.id,
      kind: "INTERVIEW",
      title: parsed.data.title,
      visibility: parsed.data.visibility,
      moderationStatus: "PENDING",
    },
  });

  const entry = await db.entry.create({
    data: {
      postId: post.id,
      body: parsed.data.body,
      ordinal: 1,
      questions: {
        create: questions.questions.map((text, index) => ({ ordinal: index + 1, text })),
      },
    },
  });

  scheduleEntryCheck(entry.id, user.id);

  revalidatePath("/");
  revalidatePath("/interviews");
  redirect(`/post/${post.id}`);
}

/* -------------------------------------------------------------------------- */
/*  Following up                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A follow-up round: up to three more questions on an interview you already opened.
 *
 * Earlier rounds stay exactly as they were and remain answerable — a follow-up adds to
 * the conversation rather than replacing it, which is the same promise the Growth Journal
 * makes for ideas.
 */
export async function addFollowUp(
  _prev: InterviewState,
  formData: FormData,
): Promise<InterviewState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };
  if (isSuspended(user)) {
    return { error: "You're on a short pause from posting at the moment." };
  }

  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, kind: true },
  });
  if (!post || post.kind !== "INTERVIEW") return { error: "That interview isn't here." };
  if (post.authorId !== user.id) {
    return { error: "Only the person who opened this interview can add to it." };
  }

  const questions = readQuestions(formData);
  if (!questions.ok) return { error: questions.error };

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
      questions: {
        create: questions.questions.map((text, index) => ({ ordinal: index + 1, text })),
      },
    },
  });

  await db.post.update({ where: { id: postId }, data: { lastEntryAt: new Date() } });

  scheduleEntryCheck(entry.id, user.id);

  revalidatePath(`/post/${postId}`);
  revalidatePath("/interviews");
  return {};
}

/* -------------------------------------------------------------------------- */
/*  Answering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Share your views on one question.
 *
 * Answering twice replaces your previous answer rather than adding a second — one person,
 * one view, revisable. Editing resets the moderation clock, so a harmless answer can't be
 * quietly rewritten into something else after it has been approved.
 */
export async function submitAnswer(
  _prev: InterviewState,
  formData: FormData,
): Promise<InterviewState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };
  if (isSuspended(user)) {
    return { error: "You're on a short pause from posting at the moment." };
  }

  const questionId = String(formData.get("questionId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const hasFiles = files.some((f) => f.size > 0);

  if (!body && !hasFiles) {
    return { error: "Write something, or attach something. Either is enough." };
  }
  if (body.length > 20_000) return { error: "That's longer than we can take — try trimming it." };

  const question = await db.interviewQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      entry: {
        select: {
          post: {
            select: { id: true, authorId: true, visibility: true, moderationStatus: true },
          },
        },
      },
    },
  });
  if (!question) return { error: "That question isn't here any more." };

  const post = question.entry.post;

  // You can only answer an interview you can actually see — same check as opening it,
  // enforced server-side because a question id is guessable and a form is just a URL.
  const viewer = await getViewer();
  const allowed = canView(viewer, {
    authorId: post.authorId,
    visibility: post.visibility as Visibility,
    moderationStatus: post.moderationStatus as ModerationStatus,
  });
  if (!allowed) return { error: "That interview isn't open to you." };

  // Answering your own interview is the same shape of nonsense as passing on your own
  // post — there is nobody it reaches who couldn't already read it.
  if (post.authorId === user.id) {
    return { error: "This is your own interview — the questions are yours to ask." };
  }

  await storage.ensureStorageRoot();

  const existing = await db.interviewResponse.findUnique({
    where: { questionId_authorId: { questionId, authorId: user.id } },
    select: { id: true },
  });

  const response = existing
    ? await db.interviewResponse.update({
        where: { id: existing.id },
        data: {
          body,
          // Back to PENDING: an edited answer is unchecked content again.
          moderationStatus: "PENDING",
          contentUpdatedAt: new Date(),
        },
      })
    : await db.interviewResponse.create({
        data: { questionId, authorId: user.id, body, moderationStatus: "PENDING" },
      });

  if (hasFiles) {
    const existingCount = await db.attachment.count({ where: { responseId: response.id } });
    const fileError = await saveFiles({ responseId: response.id }, files, existingCount);
    if (fileError) return { error: fileError };
  }

  // Answers are checked in their own right, the same as posts.
  scheduleAnswerCheck(response.id);

  revalidatePath(`/post/${post.id}`);
  revalidatePath("/interviews");
  return {};
}

/** Taking your own answer back. Yours to remove, nobody's to approve. */
export async function deleteAnswer(responseId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const response = await db.interviewResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      authorId: true,
      attachments: { select: { storageKey: true, posterKey: true } },
      question: { select: { entry: { select: { postId: true } } } },
    },
  });
  if (!response || response.authorId !== user.id) return;

  // Files first: a row deleted with its storage still on disk leaves the file orphaned
  // and unreachable, which is the one state nobody can clean up later.
  for (const attachment of response.attachments) {
    await storage.remove(attachment.storageKey);
    if (attachment.posterKey) await storage.remove(attachment.posterKey);
  }

  await db.interviewResponse.delete({ where: { id: responseId } });

  revalidatePath(`/post/${response.question.entry.postId}`);
  revalidatePath("/interviews");
}

/* -------------------------------------------------------------------------- */
/*  Loving an answer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A heart on an answer. Same promise as everywhere else: the number is the author's
 * alone, and nobody else ever sees a count.
 */
export async function loveAnswer(responseId: string): Promise<{ loved: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { loved: false };

  const response = await db.interviewResponse.findUnique({
    where: { id: responseId },
    select: {
      authorId: true,
      moderationStatus: true,
      question: {
        select: {
          entry: {
            select: {
              post: { select: { authorId: true, visibility: true, moderationStatus: true } },
            },
          },
        },
      },
    },
  });
  if (!response) return { loved: false };

  // Must be able to see the interview, and the answer must be published.
  const post = response.question.entry.post;
  const canSeeInterview = canView(viewer, {
    authorId: post.authorId,
    visibility: post.visibility as Visibility,
    moderationStatus: post.moderationStatus as ModerationStatus,
  });
  if (!canSeeInterview) return { loved: false };
  if (response.moderationStatus !== "LIVE") return { loved: false };
  if (viewer.blockedIds.has(response.authorId)) return { loved: false };

  const existing = await db.responseLove.findUnique({
    where: { responseId_userId: { responseId, userId: viewer.id } },
  });

  if (existing) {
    await db.responseLove.delete({ where: { id: existing.id } });
    return { loved: false };
  }

  await db.responseLove.create({ data: { responseId, userId: viewer.id } });
  return { loved: true };
}

/* -------------------------------------------------------------------------- */
/*  Taking an interview down                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Delete a whole interview — every round, every question, and every answer.
 *
 * This is heavier than deleting a post, and the UI says so before it happens: an
 * interview holds other people's words. Somebody answered a question in good faith, and
 * closing the interview takes their answer with it. That is the right behaviour — an
 * answer only makes sense attached to its question, and leaving orphaned replies floating
 * loose would be worse — but it is not something to do by accident.
 *
 * The rows cascade (Post → Entry → Question → Response → Attachment/Love). The files do
 * not, so they are removed first: a row deleted with its storage still on disk leaves an
 * unreachable orphan nobody can clean up later.
 */
export async function deleteInterview(postId: string): Promise<InterviewState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, kind: true },
  });
  if (!post || post.kind !== "INTERVIEW") return { error: "That interview isn't here." };
  if (post.authorId !== user.id) return { error: "That's not yours to delete." };

  // Every file attached anywhere under this interview — the rounds themselves, and every
  // answer anyone gave.
  const files = await db.attachment.findMany({
    where: {
      OR: [
        { entry: { postId } },
        { response: { question: { entry: { postId } } } },
      ],
    },
    select: { storageKey: true, posterKey: true },
  });

  for (const file of files) {
    await storage.remove(file.storageKey);
    if (file.posterKey) await storage.remove(file.posterKey);
  }

  await db.post.delete({ where: { id: postId } });

  revalidatePath("/");
  revalidatePath("/interviews");
  redirect(`/u/${user.handle}`);
}
