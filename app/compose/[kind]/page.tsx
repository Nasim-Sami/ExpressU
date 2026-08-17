import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { KindIcon } from "@/components/KindIcon";
import { InterviewComposer } from "@/components/InterviewComposer";
import { PostComposer } from "@/components/PostComposer";
import { getSessionUser, isSuspended } from "@/lib/auth";
import { KIND_BY_SLUG, KIND_COPY, POST_KIND } from "@/lib/constants";

export default async function ComposePage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind: slug } = await params;
  const kind = KIND_BY_SLUG[slug];
  if (!kind) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const copy = KIND_COPY[kind];
  const paused = isSuspended(user);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <KindIcon kind={kind} className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">{copy.action}</h1>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {copy.intro}
          </p>
        </div>
      </div>

      {/* Switching between kinds mid-thought should be one click, not a trip back to
          the nav — a hobby and an idea often start out feeling like the same thing. */}
      <nav aria-label="What are you sharing?" className="mt-5 flex flex-wrap gap-2">
        {POST_KIND.map((option) => {
          const active = option === kind;
          return (
            <Link
              key={option}
              href={`/compose/${KIND_COPY[option].slug}`}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--on-accent)" : "var(--ink-muted)",
                borderColor: active ? "var(--accent)" : "var(--line)",
              }}
            >
              <KindIcon kind={option} className="h-4 w-4" />
              {KIND_COPY[option].singular}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        {paused ? (
          <div className="eu-card p-6">
            <p>
              You&apos;re on a short pause from posting at the moment. Everything you&apos;ve
              already shared is still here, and still yours.
            </p>
          </div>
        ) : kind === "INTERVIEW" ? (
          // An interview isn't a body with attachments — it's a title and a set of
          // questions, so it gets its own composer rather than a mode of the shared one.
          <InterviewComposer />
        ) : (
          <PostComposer kind={kind} />
        )}
      </div>
    </div>
  );
}
