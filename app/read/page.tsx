import Link from "next/link";

import { BookCard } from "@/components/BookCard";
import { SearchBar } from "@/components/SearchBar";
import { getViewer } from "@/lib/auth";
import { getLibrary } from "@/lib/books";

export const metadata = {
  title: "Reading room — ExpressU",
  description: "Stories to read, and a shelf anyone can add to.",
};

const AGE_BANDS = [
  { label: "3–5", age: 4 },
  { label: "6–8", age: 7 },
  { label: "9–11", age: 10 },
  { label: "12–15", age: 13 },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string; age?: string }>;
}) {
  const { q = "", lang, age } = await searchParams;
  const viewer = await getViewer();

  const ageNumber = age ? Number(age) : undefined;
  const books = await getLibrary(viewer, {
    query: q,
    language: lang === "bn" || lang === "en" ? lang : undefined,
    age: Number.isFinite(ageNumber) ? ageNumber : undefined,
  });

  const linkTo = (next: { lang?: string; age?: string }) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const nextLang = next.lang ?? lang;
    const nextAge = next.age ?? age;
    if (nextLang && nextLang !== "all") params.set("lang", nextLang);
    if (nextAge && nextAge !== "all") params.set("age", nextAge);
    const qs = params.toString();
    return qs ? `/read?${qs}` : "/read";
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Stacked on a phone: side by side, the button sits in the middle of the paragraph
          and the text wraps around it. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold">Reading room</h1>
          <p className="mt-2 max-w-xl" style={{ color: "var(--ink-muted)" }}>
            Stories to sit with. Anyone can put one on the shelf — a story you wrote, or one
            you want other people to be able to read.
          </p>
        </div>
        <Link href="/read/new" className="eu-btn eu-btn-primary self-start sm:self-auto">
          Add a book
        </Link>
      </div>

      <div className="mt-5 flex">
        <SearchBar
          action="/read"
          defaultValue={q}
          hidden={{ lang, age }}
          placeholder="Search by title or who wrote it — spelling doesn't have to be exact"
          label="Search the reading room"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip href={linkTo({ lang: "all" })} active={!lang} label="Any language" />
        <Chip href={linkTo({ lang: "bn" })} active={lang === "bn"} label="বাংলা" />
        <Chip href={linkTo({ lang: "en" })} active={lang === "en"} label="English" />

        <span className="w-full sm:hidden" />

        <Chip href={linkTo({ age: "all" })} active={!age} label="Any age" />
        {AGE_BANDS.map((band) => (
          <Chip
            key={band.label}
            href={linkTo({ age: String(band.age) })}
            active={age === String(band.age)}
            label={band.label}
          />
        ))}
      </div>

      {books.length === 0 ? (
        <div className="eu-card mt-6 p-8 text-center">
          <p className="font-semibold">
            {q.trim() ? `Nothing on the shelf for “${q.trim()}”.` : "The shelf is empty here."}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
            {q.trim()
              ? "Try part of the title, or the name of whoever wrote it."
              : "Try a different age or language — or put the first one here yourself."}
          </p>
          <Link href="/read/new" className="eu-btn eu-btn-quiet mt-5">
            Add a book
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors"
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
