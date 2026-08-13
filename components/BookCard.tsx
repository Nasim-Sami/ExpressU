import Link from "next/link";

import { mediaUrl } from "@/lib/media-url";
import type { BookCard as Book } from "@/lib/books";

/**
 * A book on the shelf.
 *
 * Books without a cover get a drawn one rather than a grey box — a plain placeholder
 * reads as "this one is lesser", and a story someone typed in from their phone should sit
 * on the shelf looking like a book.
 */
export function BookCard({ book }: { book: Book }) {
  return (
    <li>
      <Link
        href={`/read/${book.id}`}
        className="eu-card flex h-full flex-col overflow-hidden transition-colors hover:bg-[var(--surface-sunken)]"
      >
        <span className="relative block aspect-[3/4] w-full overflow-hidden">
          {book.coverKey ? (
            <span
              className="block h-full w-full"
              style={{
                backgroundImage: `url(${mediaUrl(book.coverKey)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : (
            <DrawnCover title={book.title} />
          )}

          {book.moderationStatus !== "LIVE" && (
            <span
              className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: "var(--surface)", color: "var(--ink-muted)" }}
            >
              {book.moderationStatus === "PENDING" ? "Being read" : "Not on the shelf"}
            </span>
          )}
        </span>

        <span className="flex flex-1 flex-col gap-1 p-3">
          <span className="font-display leading-snug font-semibold">{book.title}</span>
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {book.author}
          </span>
          <span className="mt-auto pt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
            ages {book.minAge}–{book.maxAge} · {book.pageCount}{" "}
            {book.pageCount === 1 ? "page" : "pages"}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** A cover made from the title itself, on a colour derived from it so it's stable. */
function DrawnCover({ title }: { title: string }) {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;

  return (
    <span
      className="flex h-full w-full items-center justify-center p-4 text-center"
      style={{
        background: `linear-gradient(150deg, hsl(${hue} 42% 62%), hsl(${(hue + 40) % 360} 46% 44%))`,
      }}
    >
      <span className="font-display line-clamp-4 text-lg leading-tight font-semibold text-white">
        {title}
      </span>
    </span>
  );
}
