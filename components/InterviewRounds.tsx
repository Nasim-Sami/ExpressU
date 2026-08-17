import { AnswerBox } from "./AnswerBox";
import { AnswerCard } from "./AnswerCard";
import { isoDate, readableDate } from "@/lib/format";
import type { RoundView } from "@/lib/interviews";

/**
 * The whole interview: every round, its questions, and the answers under each.
 *
 * Rounds are shown oldest first, so an interview reads as a conversation that grew rather
 * than a stack of the newest thing. Every question stays answerable however old it is —
 * a follow-up adds to the interview, it doesn't close what came before.
 */
export function InterviewRounds({
  rounds,
  isInterviewer,
  signedIn,
}: {
  rounds: RoundView[];
  isInterviewer: boolean;
  signedIn: boolean;
}) {
  return (
    <ol className="mt-6 flex flex-col gap-6">
      {rounds.map((round) => (
        <li key={round.entryId}>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--growth)" }}>
              {round.ordinal === 1 ? "The first questions" : `Follow-up ${round.ordinal - 1}`}
            </h2>
            <time
              dateTime={isoDate(round.createdAt)}
              className="text-sm"
              style={{ color: "var(--ink-muted)" }}
            >
              {readableDate(round.createdAt)}
            </time>
          </div>

          {round.body && (
            <p className="mt-2 whitespace-pre-wrap" style={{ color: "var(--ink-muted)" }}>
              {round.body}
            </p>
          )}

          <div className="mt-3 flex flex-col gap-4">
            {round.questions.map((question) => (
              <section key={question.id} className="eu-card p-5">
                <h3 className="font-display text-lg font-semibold">
                  <span className="mr-2 text-sm" style={{ color: "var(--accent)" }}>
                    {question.ordinal}.
                  </span>
                  {question.text}
                </h3>

                {question.answers.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-3">
                    {question.answers.map((answer) => (
                      <AnswerCard key={answer.id} answer={answer} />
                    ))}
                  </ul>
                )}

                <AnswerBox
                  questionId={question.id}
                  alreadyAnswered={question.viewerAnswerId !== null}
                  disabled={isInterviewer || !signedIn}
                  disabledReason={
                    isInterviewer
                      ? question.answers.length === 0
                        ? "Nobody has answered this one yet."
                        : undefined
                      : "Sign in to share your views."
                  }
                />
              </section>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
