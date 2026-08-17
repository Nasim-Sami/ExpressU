import "server-only";

import { db } from "./db";
import { canView, visiblePostWhere, type Viewer } from "./visibility";
import { toAttachmentView, type AttachmentView } from "./posts";
import type { ModerationStatus, Visibility } from "./constants";

/**
 * Reading an Open Interview.
 *
 * An interview is a Post of kind INTERVIEW, so who may *open* it is decided by exactly
 * the same `canView` that governs every other post — there is no second access rule here.
 *
 * What is new is the second layer: an answer belongs to whoever wrote it, not to the
 * interviewer, and is somebody else's media appearing on the interviewer's page. So each
 * answer is filtered again on its own terms, in one function — `visibleAnswers` — that
 * every read path below goes through.
 */

export interface AnswerView {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  moderationStatus: ModerationStatus;
  author: { id: string; handle: string; displayName: string; avatarKey: string | null };
  attachments: AttachmentView[];
  /** Author-only, like every other count on ExpressU. Null for everyone else. */
  loveCount: number | null;
  viewerLoved: boolean;
  isAuthor: boolean;
}

export interface QuestionView {
  id: string;
  ordinal: number;
  text: string;
  answers: AnswerView[];
  /** Whether this viewer has already answered — they get one answer, revisable. */
  viewerAnswerId: string | null;
}

export interface RoundView {
  entryId: string;
  ordinal: number;
  body: string;
  createdAt: Date;
  questions: QuestionView[];
}

const answerInclude = {
  author: { select: { id: true, handle: true, displayName: true, avatarKey: true } },
  attachments: true,
  loves: { select: { userId: true } },
} as const;

type AnswerRow = {
  id: string;
  body: string;
  createdAt: Date;
  contentUpdatedAt: Date | null;
  moderationStatus: string;
  authorId: string;
  author: { id: string; handle: string; displayName: string; avatarKey: string | null };
  attachments: Parameters<typeof toAttachmentView>[0][];
  loves: { userId: string }[];
};

/**
 * The one rule for who sees an answer.
 *
 * An answer is held back until it has passed its own moderation, exactly like a post —
 * its author sees it meanwhile so nothing appears to vanish, and blocking hides it in
 * both directions. Every list of answers in this file is built through here.
 */
function visibleAnswers(rows: AnswerRow[], viewer: Viewer | null): AnswerView[] {
  return rows
    .filter((row) => {
      if (viewer?.id === row.authorId) return true;
      if (row.moderationStatus !== "LIVE") return false;
      return !viewer?.blockedIds.has(row.authorId);
    })
    .map((row) => {
      const isAuthor = viewer?.id === row.authorId;
      return {
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        editedAt: row.contentUpdatedAt,
        moderationStatus: row.moderationStatus as ModerationStatus,
        author: row.author,
        attachments: row.attachments.map(toAttachmentView),
        loveCount: isAuthor ? row.loves.length : null,
        viewerLoved: viewer ? row.loves.some((love) => love.userId === viewer.id) : false,
        isAuthor,
      };
    });
}

/**
 * Every round of an interview, with its questions and the answers this viewer may read.
 *
 * Returns null when the interview itself isn't theirs to open, so callers can 404 without
 * having to remember the check.
 */
export async function getInterview(viewer: Viewer | null, postId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      kind: true,
      title: true,
      authorId: true,
      visibility: true,
      moderationStatus: true,
      author: { select: { id: true, handle: true, displayName: true, avatarKey: true } },
    },
  });

  if (!post || post.kind !== "INTERVIEW") return null;

  const allowed = canView(viewer, {
    authorId: post.authorId,
    visibility: post.visibility as Visibility,
    moderationStatus: post.moderationStatus as ModerationStatus,
  });
  if (!allowed) return null;

  const entries = await db.entry.findMany({
    where: { postId },
    orderBy: { ordinal: "asc" },
    select: {
      id: true,
      ordinal: true,
      body: true,
      createdAt: true,
      questions: {
        orderBy: { ordinal: "asc" },
        include: { responses: { orderBy: { createdAt: "asc" }, include: answerInclude } },
      },
    },
  });

  const rounds: RoundView[] = entries.map((entry) => ({
    entryId: entry.id,
    ordinal: entry.ordinal,
    body: entry.body,
    createdAt: entry.createdAt,
    questions: entry.questions.map((question) => {
      const answers = visibleAnswers(question.responses as AnswerRow[], viewer);
      return {
        id: question.id,
        ordinal: question.ordinal,
        text: question.text,
        answers,
        viewerAnswerId: answers.find((answer) => answer.isAuthor)?.id ?? null,
      };
    }),
  }));

  return { post, rounds, isInterviewer: viewer?.id === post.authorId };
}

/**
 * "Give an interview" — interviews open for this person to answer.
 *
 * Their own are excluded: an interview is a question put to other people, and answering
 * yourself is the same shape of nonsense as passing on your own post.
 */
export async function getOpenInterviews(viewer: Viewer | null, limit = 40) {
  const rows = await db.post.findMany({
    where: {
      AND: [
        { kind: "INTERVIEW" },
        visiblePostWhere(viewer),
        ...(viewer ? [{ authorId: { not: viewer.id } }] : []),
      ],
    },
    orderBy: { lastEntryAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      createdAt: true,
      lastEntryAt: true,
      author: { select: { id: true, handle: true, displayName: true, avatarKey: true } },
      entries: {
        orderBy: { ordinal: "desc" },
        select: {
          id: true,
          ordinal: true,
          body: true,
          questions: { orderBy: { ordinal: "asc" }, select: { id: true, text: true } },
        },
      },
    },
  });

  const answered = viewer
    ? new Set(
        (
          await db.interviewResponse.findMany({
            where: { authorId: viewer.id },
            select: { question: { select: { entry: { select: { postId: true } } } } },
          })
        ).map((row) => row.question.entry.postId),
      )
    : new Set<string>();

  return rows.map((post) => {
    const rounds = post.entries.length;
    const latest = post.entries[0];
    return {
      id: post.id,
      title: post.title,
      author: post.author,
      lastEntryAt: post.lastEntryAt,
      rounds,
      /* The newest round's questions are what a browser sees first; "see the full
         interview" opens the rest. A follow-up should read as a new question, not as a
         wall of everything ever asked. */
      latestQuestions: latest?.questions ?? [],
      hasEarlierRounds: rounds > 1,
      viewerHasAnswered: answered.has(post.id),
    };
  });
}

/**
 * "See the interviews" — the answers people have given, newest first.
 *
 * Ordered by recency and nothing else. No "most answered" and no popularity term: that
 * would be a leaderboard for whose questions attract a crowd, which is the one thing this
 * platform doesn't build.
 */
export async function getAnswerFeed(viewer: Viewer | null, limit = 40) {
  const rows = await db.interviewResponse.findMany({
    where: {
      AND: [
        { moderationStatus: "LIVE" },
        ...(viewer && viewer.blockedIds.size > 0
          ? [{ authorId: { notIn: [...viewer.blockedIds] } }]
          : []),
        // The answer is only readable if its interview is.
        { question: { entry: { post: visiblePostWhere(viewer) } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      ...answerInclude,
      question: {
        select: {
          id: true,
          text: true,
          entry: {
            select: {
              post: {
                select: {
                  id: true,
                  title: true,
                  author: { select: { handle: true, displayName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    answer: visibleAnswers([row as unknown as AnswerRow], viewer)[0] ?? null,
    question: { id: row.question.id, text: row.question.text },
    interview: row.question.entry.post,
  }));
}

/** How many people have answered anything in this interview — shown to its author only. */
export async function countRespondents(postId: string): Promise<number> {
  const rows = await db.interviewResponse.findMany({
    where: { question: { entry: { postId } }, moderationStatus: "LIVE" },
    select: { authorId: true },
    distinct: ["authorId"],
  });
  return rows.length;
}
