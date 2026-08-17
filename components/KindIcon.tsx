import type { PostKind } from "@/lib/constants";

/**
 * One small glyph per kind of post. Kept deliberately simple: these appear at 16px in
 * card headers and smaller still in the background pattern, where anything fussy turns
 * into grey mush.
 */
export function KindIcon({
  kind,
  className = "h-4 w-4",
}: {
  kind: PostKind;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    "aria-hidden": true as const,
  };

  switch (kind) {
    case "IDEA":
      // A bulb, but drawn as a sprouting filament — the same idea as the logo.
      return (
        <svg {...common}>
          <path
            d="M12 3.2a6 6 0 0 0-3.4 10.9c.5.4.8 1 .8 1.6v.5h5.2v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3.2z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9.8 19h4.4M10.6 21.2h2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case "MOMENT":
      // Two figures close together. Not a camera or a calendar — a moment here is about
      // who you were with, not what was photographed or when.
      return (
        <svg {...common}>
          <circle cx="8.6" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3.2 19.6c.3-2.9 2.6-4.9 5.4-4.9s5.1 2 5.4 4.9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="16.6" cy="6.4" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M15.2 13.2c2.6-.5 5 1.3 5.6 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    case "HOBBY":
      // A painter's palette: the most legible "things you do for the love of it".
      return (
        <svg {...common}>
          <path
            d="M12 3.4c-4.8 0-8.6 3.5-8.6 7.9 0 4.3 3.6 7.3 7.4 7.3.9 0 1.5-.6 1.5-1.4 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4h1.8c3.2 0 5.8-2.5 5.8-5.6 0-3.4-3.6-4.7-8.6-4.7z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="10" r="1.1" fill="currentColor" />
          <circle cx="12" cy="7.6" r="1.1" fill="currentColor" />
          <circle cx="16" cy="9.4" r="1.1" fill="currentColor" />
        </svg>
      );

    case "LEARNING":
      // An open book, spine in the middle.
      return (
        <svg {...common}>
          <path
            d="M12 6.4C10.4 5.2 8.4 4.6 5.6 4.6H3.4v13h2.2c2.8 0 4.8.6 6.4 1.8 1.6-1.2 3.6-1.8 6.4-1.8h2.2v-13h-2.2c-2.8 0-4.8.6-6.4 1.8z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M12 6.4v13" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );

    case "LETTER":
      // A paper plane: a letter that has been sent, not one sitting in a drawer.
      return (
        <svg {...common}>
          <path
            d="M20.8 3.6 3.4 10.2l6.2 2.4 2.4 6.2z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M20.8 3.6 9.6 12.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case "INTERVIEW":
      // A question mark over an open door — a question put out to whoever wants to walk
      // through it. Not a speech bubble: this platform has no comments, and a bubble is
      // exactly what a comment looks like.
      return (
        <svg {...common}>
          <path
            d="M4.4 20.4V5a1.4 1.4 0 0 1 1.4-1.4h8.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M3 20.4h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M16.4 8.2a2.6 2.6 0 1 1 3.4 2.5c-.7.3-1 .8-1 1.5v.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="18.8" cy="16.2" r="0.9" fill="currentColor" />
        </svg>
      );
  }
}
