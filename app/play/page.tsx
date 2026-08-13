import { GameGrid } from "@/components/GameGrid";
import { GAMES } from "@/lib/games";

export const metadata = {
  title: "Play — ExpressU",
  description: "Small games and puzzles that stretch different parts of how you think.",
};

export default function PlayHub() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Games &amp; puzzles</h1>
      <p className="mt-2 max-w-xl" style={{ color: "var(--ink-muted)" }}>
        Small games, each leaning on a different way of thinking. Being good at one says
        nothing about the others — that&apos;s rather the point.
      </p>

      <GameGrid games={GAMES} />

      <p
        className="mt-6 rounded-xl p-4 text-sm"
        style={{ background: "var(--surface-sunken)", color: "var(--ink-muted)" }}
      >
        There are no leaderboards here and there never will be. Your best score is kept on
        your own device, shown only to you, and you can wipe it whenever you like — the
        same reason nobody but you can see how many people loved your work.
      </p>
    </div>
  );
}
