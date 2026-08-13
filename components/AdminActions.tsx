"use client";

import { useState, useTransition } from "react";

import {
  approveBan,
  confirmOriginal,
  destroyBook,
  dismissBan,
  deleteUser,
  dismissReport,
  restoreIdea,
  shelveBook,
  suspendUser,
  unshelveBook,
  upholdBlock,
  warnUser,
} from "@/lib/actions/admin";
import { SUSPENSION_DAYS } from "@/lib/constants";

/**
 * Deliberately asymmetric buttons.
 *
 * The forgiving option is the primary, visually-weighted action in every case, and the
 * punitive one is quiet and secondary. A queue where "ban" is the big obvious button
 * produces bans, and the person on the other end of this decision is a child.
 */
export function AdminActions({
  kind,
  itemId,
  subjectId,
  entryId,
  authorId,
  authorHandle,
}: {
  kind: string;
  itemId: string;
  subjectId: string;
  /** Report cards only: the entry to take down, and who wrote it. */
  entryId?: string;
  authorId?: string;
  authorHandle?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <p className="mt-4 text-sm font-semibold" style={{ color: "var(--growth)" }}>
        {done}
      </p>
    );
  }

  function run(fn: () => Promise<void>, message: string) {
    startTransition(async () => {
      await fn();
      setDone(message);
    });
  }

  const quiet = "eu-btn eu-btn-quiet";
  const primary = "eu-btn eu-btn-primary";

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
      {kind === "BAN_CONFIRM" && (
        <>
          <button
            className={primary}
            disabled={pending}
            onClick={() => run(() => dismissBan(itemId, subjectId), "Left alone. Strikes cleared.")}
          >
            No pause — clear their record
          </button>
          <button
            className={quiet}
            disabled={pending}
            onClick={() =>
              run(() => approveBan(itemId, subjectId), `Paused for ${SUSPENSION_DAYS} days.`)
            }
          >
            Approve the {SUSPENSION_DAYS}-day pause
          </button>
        </>
      )}

      {kind === "ORIGINALITY_UNSURE" && (
        <>
          <button
            className={primary}
            disabled={pending}
            onClick={() => run(() => confirmOriginal(itemId, subjectId), "Confirmed as theirs.")}
          >
            It&apos;s their own work
          </button>
          <button
            className={quiet}
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  upholdBlock(
                    itemId,
                    subjectId,
                    "We had another look and this one isn't going up. If you made it yourself, tell us and we'll look again.",
                  ),
                "Blocked.",
              )
            }
          >
            Block it
          </button>
        </>
      )}

      {kind === "BLOCK_APPEAL" && (
        <>
          <button
            className={primary}
            disabled={pending}
            onClick={() => run(() => restoreIdea(itemId, subjectId), "Restored, and they've been told.")}
          >
            They&apos;re right — put it back
          </button>
          <button
            className={quiet}
            disabled={pending}
            onClick={() =>
              run(
                () => dismissReport(itemId),
                "Left as it is.",
              )
            }
          >
            Keep it down
          </button>
        </>
      )}

      {kind === "USER_REPORT" && (
        <ReportActions
          itemId={itemId}
          entryId={entryId}
          authorId={authorId}
          authorHandle={authorHandle}
          pending={pending}
          run={run}
        />
      )}

      {(kind === "BOOK_REVIEW" || kind === "BOOK_BLOCKED" || kind === "BOOK_REPORT") && (
        <BookActions
          itemId={itemId}
          bookId={subjectId}
          uploaderId={authorId}
          uploaderHandle={authorHandle}
          pending={pending}
          run={run}
        />
      )}
    </div>
  );
}

/**
 * What a person can do about a book.
 *
 * "Put it on the shelf" is the primary action for the same reason "nothing wrong here" is
 * primary for reports: the queue's default gesture shapes what the queue produces, and
 * most books held for a look are simply books.
 */
function BookActions({
  itemId,
  bookId,
  uploaderId,
  uploaderHandle,
  pending,
  run,
}: {
  itemId: string;
  bookId: string;
  uploaderId?: string;
  uploaderHandle?: string;
  pending: boolean;
  run: (fn: () => Promise<void>, message: string) => void;
}) {
  const [mode, setMode] = useState<null | "unshelve" | "destroy" | "warn">(null);
  const [text, setText] = useState("");

  if (mode) {
    const isDestroy = mode === "destroy";

    return (
      <div className="flex w-full flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">
            {mode === "unshelve"
              ? "What should the person who added it be told?"
              : mode === "warn"
                ? "What should they be told?"
                : "Why are you deleting this book?"}
          </span>
          {isDestroy && (
            <span style={{ color: "var(--love-strong)" }}>
              This removes the book, every page of it, and the file it came from. It cannot
              be undone. Taking it off the shelf is reversible; this isn&apos;t.
            </span>
          )}
          <input
            className="eu-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Written to them directly — plain, and not a telling-off."
            autoFocus
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            className="eu-btn"
            style={{ background: isDestroy ? "var(--love-strong)" : "var(--accent)", color: "#fff" }}
            disabled={pending || (mode === "warn" && !uploaderId)}
            onClick={() => {
              if (mode === "unshelve") run(() => unshelveBook(itemId, bookId, text), "Off the shelf.");
              else if (mode === "destroy") run(() => destroyBook(itemId, bookId, text), "Deleted.");
              else if (uploaderId) run(() => warnUser(itemId, uploaderId, text), "Warned.");
            }}
          >
            {mode === "unshelve"
              ? "Take it off the shelf"
              : mode === "warn"
                ? "Send the warning"
                : "Delete this book"}
          </button>
          <button
            className="eu-btn eu-btn-quiet"
            onClick={() => {
              setMode(null);
              setText("");
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className="eu-btn eu-btn-primary"
        disabled={pending}
        onClick={() => run(() => shelveBook(itemId, bookId), "On the shelf.")}
      >
        Put it on the shelf
      </button>
      <button className="eu-btn eu-btn-quiet" disabled={pending} onClick={() => setMode("unshelve")}>
        Take it off the shelf
      </button>
      {uploaderId && (
        <button className="eu-btn eu-btn-quiet" disabled={pending} onClick={() => setMode("warn")}>
          Warn @{uploaderHandle}
        </button>
      )}
      <button
        className="text-sm font-semibold"
        disabled={pending}
        style={{ color: "var(--love-strong)" }}
        onClick={() => setMode("destroy")}
      >
        Delete the book
      </button>
    </>
  );
}

/**
 * What a person can do about a report, ordered from lightest to heaviest.
 *
 * "Nothing wrong here" is the primary button on purpose. Most reports are disagreements,
 * not danger, and a queue whose loudest control is "delete account" will produce deleted
 * accounts. The two irreversible options are last, quiet, and behind a confirmation.
 */
function ReportActions({
  itemId,
  entryId,
  authorId,
  authorHandle,
  pending,
  run,
}: {
  itemId: string;
  entryId?: string;
  authorId?: string;
  authorHandle?: string;
  pending: boolean;
  run: (fn: () => Promise<void>, message: string) => void;
}) {
  const [mode, setMode] = useState<null | "warn" | "suspend" | "delete">(null);
  const [text, setText] = useState("");

  if (mode) {
    const isDelete = mode === "delete";

    return (
      <div className="flex w-full flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">
            {mode === "warn"
              ? "What should they be told?"
              : mode === "suspend"
                ? "Why are you pausing this account?"
                : `Type @${authorHandle} to confirm you're deleting this account`}
          </span>
          {isDelete && (
            <span style={{ color: "var(--love-strong)" }}>
              This removes the account, everything they&apos;ve ever posted, and every file
              they uploaded. It cannot be undone.
            </span>
          )}
          <input
            className="eu-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              isDelete
                ? `@${authorHandle}`
                : mode === "warn"
                  ? "Written to them directly — plain, and not a telling-off."
                  : "Recorded against your name."
            }
            autoFocus
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            className="eu-btn"
            style={{
              background: isDelete ? "var(--love-strong)" : "var(--accent)",
              color: "#fff",
            }}
            disabled={
              pending ||
              !authorId ||
              // Deleting requires the handle typed back, exactly.
              (isDelete && text.trim().replace(/^@/, "") !== authorHandle)
            }
            onClick={() => {
              if (!authorId) return;
              if (mode === "warn") run(() => warnUser(itemId, authorId, text), "Warned.");
              else if (mode === "suspend")
                run(() => suspendUser(itemId, authorId, text), "Account paused.");
              else run(() => deleteUser(itemId, authorId, text), "Account deleted.");
            }}
          >
            {mode === "warn"
              ? "Send the warning"
              : mode === "suspend"
                ? `Pause for ${SUSPENSION_DAYS} days`
                : "Delete this account"}
          </button>
          <button
            className="eu-btn eu-btn-quiet"
            onClick={() => {
              setMode(null);
              setText("");
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className="eu-btn eu-btn-primary"
        disabled={pending}
        onClick={() => run(() => dismissReport(itemId), "Closed.")}
      >
        Nothing wrong here
      </button>

      {entryId && (
        <button
          className="eu-btn eu-btn-quiet"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                upholdBlock(
                  itemId,
                  entryId,
                  "Someone flagged this and we've taken it down for now. If you think that's wrong, reply and a person will read it.",
                ),
              "Taken down.",
            )
          }
        >
          Take the post down
        </button>
      )}

      {authorId && (
        <>
          <button className="eu-btn eu-btn-quiet" disabled={pending} onClick={() => setMode("warn")}>
            Warn them
          </button>
          <button
            className="eu-btn eu-btn-quiet"
            disabled={pending}
            onClick={() => setMode("suspend")}
          >
            Pause the account
          </button>
          <button
            className="text-sm font-semibold"
            disabled={pending}
            style={{ color: "var(--love-strong)" }}
            onClick={() => setMode("delete")}
          >
            Delete the account
          </button>
        </>
      )}
    </>
  );
}
