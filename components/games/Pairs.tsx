"use client";

import { useEffect, useRef, useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug, shuffle } from "@/lib/games";

const SYMBOLS = ["🌱", "🎨", "📖", "✈️", "🎵", "⭐", "🐦", "🪁", "🧵", "🔭", "🥁", "🍄"];

/** Three pairs at level 1, twelve at level 20. */
function pairsFor(level: number): number {
  return Math.min(SYMBOLS.length, 3 + Math.floor(((level - 1) * 9) / 19));
}

interface Card {
  id: number;
  symbol: string;
  faceUp: boolean;
  matched: boolean;
}

function deal(level: number): Card[] {
  const symbols = SYMBOLS.slice(0, pairsFor(level));
  // Shuffled fresh each time — a memory game you've memorised isn't one.
  return shuffle([...symbols, ...symbols]).map((symbol, id) => ({
    id,
    symbol,
    faceUp: false,
    matched: false,
  }));
}

export function Pairs() {
  const meta = gameBySlug("pairs")!;

  return (
    <GameShell meta={meta} goal={(level) => `${pairsFor(level)} pairs to find.`}>
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const [cards, setCards] = useState<Card[]>(() => deal(api.level));
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const [improved, setImproved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = cards.every((card) => card.matched);
  const total = cards.length / 2;

  // Any pending flip-back must be cancelled if the component goes away mid-turn,
  // otherwise React warns about setting state after unmount.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function flip(index: number) {
    if (busy || done) return;

    const card = cards[index];
    if (card.faceUp || card.matched) return;

    const next = cards.map((c, i) => (i === index ? { ...c, faceUp: true } : c));
    const shown = next.filter((c) => c.faceUp && !c.matched);
    setCards(next);

    if (shown.length < 2) return;

    const attempts = moves + 1;
    setMoves(attempts);

    const [a, b] = shown;
    if (a.symbol === b.symbol) {
      const matched = next.map((c) =>
        c.symbol === a.symbol ? { ...c, matched: true, faceUp: true } : c,
      );
      setCards(matched);

      if (matched.every((c) => c.matched)) {
        setImproved(api.finish(attempts).improved);
      }
      return;
    }

    // Hold the mismatch visible long enough to actually memorise it.
    setBusy(true);
    timer.current = setTimeout(() => {
      setCards((current) => current.map((c) => (c.matched ? c : { ...c, faceUp: false })));
      setBusy(false);
    }, 900);
  }

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {moves} {moves === 1 ? "move" : "moves"}
      </p>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {cards.map((card, index) => {
          const revealed = card.faceUp || card.matched;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(index)}
              disabled={revealed || busy || done}
              aria-label={revealed ? `Card showing ${card.symbol}` : "Face-down card"}
              className="flex aspect-square items-center justify-center rounded-xl border-2 text-3xl transition-colors"
              style={{
                background: card.matched
                  ? "var(--growth-soft)"
                  : revealed
                    ? "var(--surface)"
                    : "var(--surface-sunken)",
                borderColor: card.matched ? "var(--growth)" : "var(--line)",
                cursor: revealed || busy ? "default" : "pointer",
              }}
            >
              <span aria-hidden="true">{revealed ? card.symbol : ""}</span>
            </button>
          );
        })}
      </div>

      {done ? (
        <Finished
          headline={`All ${total} pairs in ${moves} moves.`}
          improved={improved}
          onAgain={api.again}
        />
      ) : (
        <button type="button" onClick={api.again} className="eu-btn eu-btn-quiet mt-4">
          Shuffle again
        </button>
      )}
    </>
  );
}
