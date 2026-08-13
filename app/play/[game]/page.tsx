import Link from "next/link";
import { notFound } from "next/navigation";

import { Binary } from "@/components/games/Binary";
import { CodeBreaker } from "@/components/games/CodeBreaker";
import { Colours } from "@/components/games/Colours";
import { Hanoi } from "@/components/games/Hanoi";
import { Jugs } from "@/components/games/Jugs";
import { Knight } from "@/components/games/Knight";
import { Lights } from "@/components/games/Lights";
import { Maze } from "@/components/games/Maze";
import { Mirror } from "@/components/games/Mirror";
import { NextNumber } from "@/components/games/NextNumber";
import { OddOne } from "@/components/games/OddOne";
import { Pairs } from "@/components/games/Pairs";
import { Sequence } from "@/components/games/Sequence";
import { Slide } from "@/components/games/Slide";
import { Solitaire } from "@/components/games/Solitaire";
import { Span } from "@/components/games/Span";
import { Sudoku } from "@/components/games/Sudoku";
import { Target } from "@/components/games/Target";
import { Unjumble } from "@/components/games/Unjumble";
import { WordSearch } from "@/components/games/WordSearch";
import { GAMES, gameBySlug } from "@/lib/games";

/**
 * One component per game, looked up by slug.
 *
 * A plain map rather than a dynamic import: every game is a few kilobytes of logic with no
 * dependencies, and the whole point of this section is that a bored child can move between
 * twenty of them without waiting for anything.
 */
const SCREENS: Record<string, () => React.ReactElement> = {
  pairs: Pairs,
  sequence: Sequence,
  slide: Slide,
  code: CodeBreaker,
  lights: Lights,
  hanoi: Hanoi,
  maze: Maze,
  binary: Binary,
  sudoku: Sudoku,
  unjumble: Unjumble,
  wordsearch: WordSearch,
  target: Target,
  nextnumber: NextNumber,
  oddone: OddOne,
  span: Span,
  colours: Colours,
  mirror: Mirror,
  jugs: Jugs,
  solitaire: Solitaire,
  knight: Knight,
};

export function generateStaticParams() {
  return GAMES.map((game) => ({ game: game.slug }));
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game: slug } = await params;
  const meta = gameBySlug(slug);
  const Screen = SCREENS[slug];
  if (!meta || !Screen) notFound();

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <Link href="/play" className="text-sm font-semibold" style={{ color: "var(--ink-muted)" }}>
          ← All games
        </Link>
      </div>

      <Screen />
    </>
  );
}
