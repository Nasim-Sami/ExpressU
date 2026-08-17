import Link from "next/link";

import { AnswerCard } from "@/components/AnswerCard";
import { Avatar } from "@/components/Avatar";
import { getViewer } from "@/lib/auth";
import { isoDate, readableDate, timeAgo } from "@/lib/format";
import { getAnswerFeed, getOpenInterviews } from "@/lib/interviews";

export const metadata = { title: "Open interviews — ExpressU" };

/**
 * The two ways into interviews.
 *
 * "Give an interview" is a list of questions waiting for you. "See the interviews" is
 * what people said. Deliberately two tabs rather than one merged stream: answering and
 * reading are different moods, and mixing them turns the page into a feed you scroll
 * rather than a question you sit with.
 */
export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const seeing = tab === "answers";
  const viewer = await getViewer();

  const [open, answers] = await Promise.all([
    seeing ? Promise.resolve([]) : getOpenInterviews(viewer),
    seeing ? getAnswerFeed(viewer) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold">Open interviews</h1>
          <p className="mt-2 max-w-xl" style={{ color: "var(--ink-muted)" }}>
            Someone asks up to three questions. Anyone can answer, in words or a recording
            or a video. Nobody marks the answers.
          </p>
        </div>
        <Link href="/compose/interview" className="eu-btn eu-btn-primary">
          Open an interview
        </Link>
      </div>

      <nav aria-label="Interviews" className="mt-5 flex flex-wrap gap-2">
        <Tab href="/interviews" active={!seeing} label="Give an interview" />
        <Tab href="/interviews?tab=answers" active={seeing} label="See the interviews" />
      </nav>

      {seeing ? (
        answers.length === 0 ? (
          <Empty
            headline="Nobody has answered anything yet."
            detail="When people share their views, they'll appear here."
          />
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {answers.map(({ answer, question, interview }) =>
              answer ? (
                <li key={answer.id} className="eu-card p-5">
                  <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--ink-faint)" }}>
                    Answering
                  </p>
                  <Link
                    href={`/post/${interview.id}`}
                    className="font-display mt-1 block text-lg font-semibold hover:underline"
                  >
                    {question.text}
                  </Link>
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                    from “{interview.title}” by {interview.author.displayName}
                  </p>

                  <ul className="mt-4">
                    <AnswerCard answer={answer} />
                  </ul>
                </li>
              ) : null,
            )}
          </ul>
        )
      ) : open.length === 0 ? (
        <Empty
          headline="No interviews are open right now."
          detail="You could ask the first question yourself — three at most, and one is plenty."
        />
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {open.map((item) => (
            <li key={item.id} className="eu-card p-5">
              <div className="flex items-start gap-3">
                <Link href={`/u/${item.author.handle}`} className="shrink-0">
                  <Avatar user={item.author} size={40} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${item.author.handle}`} className="font-semibold hover:underline">
                    {item.author.displayName}
                  </Link>
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                    @{item.author.handle}
                    {" · "}
                    <time dateTime={isoDate(item.lastEntryAt)} title={readableDate(item.lastEntryAt)}>
                      {timeAgo(item.lastEntryAt)}
                    </time>
                    {item.viewerHasAnswered && " · you've answered"}
                  </p>
                </div>
              </div>

              <h2 className="font-display mt-3 text-xl font-semibold">{item.title}</h2>

              {/* The newest round only. A follow-up should read as a new question, not as
                  a wall of everything ever asked — the rest is one tap away. */}
              <ol className="mt-3 flex flex-col gap-2">
                {item.latestQuestions.map((question, index) => (
                  <li key={question.id} className="flex gap-2">
                    <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                      {index + 1}.
                    </span>
                    <span>{question.text}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
                <Link href={`/post/${item.id}`} className="eu-btn eu-btn-primary">
                  {item.viewerHasAnswered ? "See the full interview" : "Share your views"}
                </Link>
                {item.hasEarlierRounds && (
                  <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
                    {item.rounds} rounds — earlier questions are still open
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--on-accent)" : "var(--ink-muted)",
        borderColor: active ? "var(--accent)" : "var(--line)",
      }}
    >
      {label}
    </Link>
  );
}

function Empty({ headline, detail }: { headline: string; detail: string }) {
  return (
    <div className="eu-card mt-6 p-8 text-center">
      <p className="font-semibold">{headline}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
        {detail}
      </p>
      <Link href="/compose/interview" className="eu-btn eu-btn-quiet mt-5">
        Open an interview
      </Link>
    </div>
  );
}
