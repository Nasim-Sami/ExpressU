# ExpressU

A place where children, adolescents, and young people share any idea, dream, or piece of
creative work — and nobody marks it.

Every showcase platform a young person meets rewards the same three things: success,
profitability, and realism. Ideas that don't clear that bar get a verdict, and people stop
sharing. ExpressU is built so that a child's first idea never meets that verdict.

## What's deliberately missing

These absences are the product. They are enforced in the schema and the types, not just the
UI, so they can't quietly come back:

| Absent | Where it's enforced |
|---|---|
| **Comments** — not disabled, they don't exist | No table. No route. No affordance in any rendered page (asserted in verification). |
| **Public love counts** | `PostView.loveCount` is `null` for everyone but the author, so the number never reaches the browser. No cached count column exists. |
| **Captions on shares** | The `Echo` model has no text column, and `echoPost(postId)` takes no message parameter. |
| **Ranking / trending** | The feed is chronological. The one intervention gives every fourth slot to a post nobody has loved yet — the opposite of ranking. |
| **Follower counts** | A circle is a list of people, never a number. |
| **Streaks** | A streak punishes the day you didn't feel like speaking. |
| **Bulk delete** | Entries go one at a time. Only a post down to its last entry can be removed, and that takes an explicit confirmation. |

## What you can share

Five kinds, one code path. They differ only in what they're called and a couple of metadata
fields — visibility, moderation, Love, Echo and private notes behave identically across all
of them, and must keep doing so.

| Kind | Container | Entries are called | Extra field |
|---|---|---|---|
| **Idea** | a dream or a thought you keep returning to | Chapter | — |
| **Moment** | time with the people you care about | Moment | — |
| **Hobby** | the thing you do because you want to | Memory | which hobby, from a list (or your own) |
| **Learning** | something you're working out | Lesson | — |
| **Open letter** | something said out loud to someone who could act | Letter | recipient type; each letter has To + Subject |

## What's there instead

- **Any format.** Video, audio, images, PDFs, documents, plain text — each rendered properly,
  not as a generic paperclip.
- **Per-post visibility.** *Everyone*, *My circle*, or *Just me*, changeable any time in either
  direction.
- **A journal, not a post.** Nothing gets buried; the author adds entries over time, so a
  profile shows a dream, a hobby or a piece of learning actually evolving.
- **Edit and delete, carefully.** Any entry can be rewritten or removed on its own. An edit
  goes back through moderation — otherwise "post something harmless, then rewrite it" would
  walk straight past the check (`lib/moderation/claim.ts`, with tests).
- **Private encouragement notes.** What replaces comments. Only the author ever reads them,
  and for authors under 16 only preset phrases are available — no free text from a stranger
  can reach a child.
- **One reaction.** A heart. The author alone sees who and how many.
- **A profile you control.** Optional picture and cover — both framed by you with a
  zoom-and-drag cropper rather than an algorithm guessing which part matters — a name that
  needn't be your real one, up to 100 words about yourself, and up to 6 links out. Uploads
  are re-encoded, which strips EXIF: a phone photo doesn't quietly publish where a child
  lives.
- **Links that say where they go.** Only http/https are storable (a `javascript:` URL on a
  child's profile would run in the browser of whoever tapped it), the destination host is
  always shown next to the label, and every link carries `rel="noopener noreferrer nofollow
  ugc"`.
- **Games and puzzles.** Twenty at `/play`, each exercising a different way of thinking —
  memory, attention, planning, logic, words, numbers, space — with up to twenty levels
  apiece. Every generated puzzle is proved solvable by a test that walks each level
  (`lib/puzzles.test.ts`); handing a child a puzzle with no answer would teach them the
  failure was theirs. Best scores live in `localStorage`, never the database — a score in a
  table is one `ORDER BY` from being a leaderboard, and levels unlock in order but "open
  every level" is offered plainly, because *not yet* is a verdict too.
- **A reading room.** Stories at `/read`, with typo-tolerant search by title or author, a
  reader that remembers your text size, page jumping, and search *inside* a book. Anyone can
  add one by uploading a PDF, Word or text file — or by typing the story straight in, which
  matters more than it looks, because a child with a story in a notebook has no PDF. Books
  are held to a stricter bar than posts: anything short of a clean verdict waits for a
  person, since a child sits and reads one for an hour.
- **Reporting.** Anyone can report a post. A report never hides anything on its own; it
  opens an item for a person to judge, so being disliked can't silence you.

---

## Running it

### Prerequisite: a broken variable on this machine

`~/.zshrc` line 1 contains:

```
export SSL_CERT_FILE=$(python -m certifi)
```

That command produces nothing here, so `SSL_CERT_FILE` ends up **empty** — which makes Node
load its trust store from a non-existent path and fail every HTTPS request
(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`). It breaks `npm install` and any outbound call from the
app, including the moderation model.

Fix it in `~/.zshrc` (use `python3`, and only set it if it worked):

```bash
CERTS=$(python3 -m certifi 2>/dev/null) && [ -n "$CERTS" ] && export SSL_CERT_FILE="$CERTS"
```

Until then, prefix commands with `unset SSL_CERT_FILE;`.

### Setup

```bash
npm install
npx prisma db push
npm run db:seed
```

### Run

```bash
npm run dev
```

…and in a second terminal, the background moderation worker:

```bash
npm run worker
```

The worker is optional. Without it, posts stay `PENDING` and remain visible to their author
with a "we're having a quick look" note. Nothing breaks and nothing is lost.

### Sign in

`npm run db:seed` creates four accounts, all sharing the password `expressu`. They exist so
you can sign in as four different people and check the visibility rules by hand:

| Email | Who |
|---|---|
| `maya@example.com` | 14. Has a private idea and a three-chapter Growth Journal. |
| `idris@example.com` | 17. Has a circle-only idea that only Maya should see. |
| `rosa@example.com` | 20. Connected to nobody — use her to test that circle ideas stay hidden. |
| `sam@example.com` | Admin. Can reach `/admin`. |

These are for local development only. Four accounts sharing a password written down in a
README is fine on a laptop and indefensible anywhere public, so anything deployed needs a
seed that creates no people at all.

---

## The safety system

### One honest limitation

Proving a video came from YouTube or TikTok requires a licensed content-fingerprint database.
We cannot build that. What's here is a layered system that catches most real cases:

| Layer | Catches | Action |
|---|---|---|
| SHA-256 | Byte-identical re-upload of something already on ExpressU | Block |
| Perceptual hash (DCT) | Re-encoded, resized, or screenshotted copy | Block |
| Claude vision on video frames | Platform watermarks, burned-in @handles, screen-recording chrome, broadcast graphics | Block if confident, **human queue if unsure** |
| Uploader attestation | — | Checkbox at upload |

**Only the certain layers auto-block.** An uncertain originality call *publishes the idea* and
quietly opens a review item. Falsely accusing a fourteen-year-old of stealing the thing they
made is the worst failure this system can have, so it is designed never to do that on a guess.

Two rules protect the creator specifically, both regression-tested in
`lib/moderation/duplicates.test.ts`:

- You can always re-post **your own** work (that's what chapters are).
- A **blocked** upload never counts as "already here" — otherwise someone could take a
  teenager's video, post it first, get blocked, and thereby lock the real creator out.

### What an admin can actually do

From the review queue, ordered lightest first — the forgiving option is the primary button
on every card, because a queue whose loudest control is "delete account" produces deleted
accounts:

| Action | Effect |
|---|---|
| Nothing wrong here | Closes the item. Nothing happens to anyone. |
| Take the post down | Hides that post; the author is told and can appeal. |
| Warn them | A direct message from a person. The account is untouched. |
| Pause the account | 15-day suspension, attributed to the admin who approved it. Everything already shared stays up. |
| Delete the account | Irreversible. Cascades to every post, entry, love and note, and deletes the uploaded files from disk first. Requires typing the handle back, and refuses on admin accounts or your own. |

All of it is asserted against a real database in `lib/moderation/admin-chain.test.ts`.

### Who can ban

Nobody automated. The pipeline can warn, hide, and count strikes. Four consecutive
off-purpose posts open a `BAN_CONFIRM` item in `/admin` and stop there; only an admin
approving it creates a suspension, and `applySuspension` throws without an admin id. Any
approved post clears the slate — forgiveness is automatic, not a favour.

This is asserted in `lib/moderation/strikes.test.ts` against a real database.

### Tone

Warnings and blocks are product copy, reviewed as carefully as anything else on the platform.
Never "your content is irrelevant." A test asserts that no author-facing moderation message
contains the words *irrelevant*, *violation*, *rejected*, *inappropriate*, *failed*, or
*invalid*. Every block carries a one-click appeal that reaches a person.

### Model

`claude-opus-5`, adaptive thinking, `effort: high`, with structured outputs so the verdict is
a validated object rather than parsed prose. A model refusal routes to a human rather than
being guessed either way. **Without `ANTHROPIC_API_KEY` the platform still runs** — posts
publish unchecked, because a missing key is our failure and a young person shouldn't pay for
it.

Optional, for audio/video transcription (runs locally — children's audio never leaves the
machine):

```bash
brew install whisper-cpp
mkdir -p models && curl -L -o models/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

---

## Where things live

```
app/
  page.tsx                 feed (chronological + quiet-post rotation)
  post/[id]/               post page + journal timeline + entry edit/delete + author panel
  u/[handle]/              profile: kind tabs, plus owner-only visibility shelves
  compose/[kind]/          one composer, four kinds
  settings/profile/        picture, cover, name, 100-word bio
  heard/                   private encouragement inbox
  admin/                   review queue
  api/media/[...key]/      ← every byte of media, access-checked per request
lib/
  visibility.ts            ⚠ the single chokepoint for who sees what
  posts.ts                 all post reads; nothing else builds a Post `where`
  constants.ts             kinds, their wording, hobby + recipient lists
  media-url.ts             URL building, client-safe (storage.ts is server-only)
  moderation/
    prompt.ts              the moderation system prompt
    act.ts                 pure verdict → consequence rules
    claim.ts               what still needs checking; closes the edit-bypass
    strikes.ts             the strike ledger; the only place suspensions exist
    duplicates.ts          re-upload detection
  media/                   ffmpeg, perceptual hashing, transcription, text extraction
worker/index.ts            the background moderation loop
```

Three rules for anyone extending this:

1. **All post reads go through `lib/visibility.ts`.** Single posts use `canView`; lists use
   `visiblePostWhere`, which pushes the same rules into SQL. A test asserts the two agree on
   all 60 viewer × visibility × status combinations — change one and it fails until you
   change the other.

2. **Media is not in `public/`.** It's served from `/api/media/[...key]`, which runs the same
   `canView` check. If uploads were static files, a leaked link would expose a private video.
3. **Don't add a fifth kind by copying the fourth.** A kind is wording plus at most a field
   or two (`lib/constants.ts`). The moment one gets its own table or its own read path, the
   guarantees start drifting apart between them.

## Tests

```bash
npm test
```

210 tests. The ones that carry weight:

- `lib/visibility.test.ts` — the full access matrix, plus proof that an admin has **no**
  master key to private posts.
- `lib/moderation/act.test.ts` — every verdict path, including that author-facing copy never
  carries a judgement word and that no blocking path leaves the author without recourse.
- `lib/moderation/strikes.test.ts` — the automated system cannot suspend anyone.
- `lib/moderation/duplicates.test.ts` — a blocked upload can't lock the real creator out.
- `lib/moderation/claim.test.ts` — an edited entry goes back through moderation, and an
  entry whose number merely shifted does not.
- `lib/moderation/admin-chain.test.ts` — against a real database: explicit content is
  blocked outright while merely *suspected* content goes to a human; a report reaches the
  queue without hiding anything; warn/suspend/delete each do exactly what they say.
- `lib/links.test.ts` — `javascript:` and `data:` URLs can never reach a profile.
- `lib/media/hash.test.ts` — the perceptual-hash threshold, tested in both directions, plus
  the rule that a structureless image is never hashed at all (a hash of a blank wall is
  rounding noise, and matching on it would be an accusation).

## Known gaps

- **Captions/subtitles on video** are not yet authorable. The player supports a `<track>`;
  the composer needs a field for it. Worth doing before real users.
- **Guardian accounts** aren't built. Age is self-declared at signup and drives only the
  free-text rule.
- **Storage is local disk.** `lib/storage.ts` is written as the interface an S3 adapter would
  implement.
- **Deleted files are removed from disk, but old avatars/covers replaced before this build
  may still be orphaned** in `storage/`.
- **The hobby list is fixed in `lib/constants.ts`.** "Something else" covers the gap, but the
  written-in values aren't collected anywhere, so the list can't learn from what people
  actually pick.
- Moderation has been verified end-to-end for the deterministic layers (hashes, strikes,
  verdict rules, appeals). **The Claude vision call itself has not been exercised** — there
  was no API key on this machine. Set one and post the watermarked fixture at
  `/tmp/eu-fixtures/watermarked.mp4` to try it.
