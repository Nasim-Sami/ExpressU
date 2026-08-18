/**
 * Single source of truth for the enum-ish string columns in the Prisma schema.
 *
 * SQLite has no native enums, so those columns are plain Strings in the database.
 * Everything in the app goes through the types and helpers here instead of bare
 * string literals, so a typo is a compile error rather than a silent data bug.
 */

export const VISIBILITY = ["PUBLIC", "CIRCLE", "PRIVATE"] as const;
export type Visibility = (typeof VISIBILITY)[number];

/** Human-facing labels. Deliberately plain language, not jargon. */
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  PUBLIC: "Everyone",
  CIRCLE: "My circle",
  PRIVATE: "Just me",
};

export const VISIBILITY_HELP: Record<Visibility, string> = {
  PUBLIC: "Anyone on ExpressU can find this.",
  CIRCLE: "Only people you're connected with will see it.",
  PRIVATE: "Kept in your profile for you alone. You can share it later, any time.",
};

/* -------------------------------------------------------------------------- */
/*  What a person can share                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The five kinds of post. They are one table and one code path on purpose: visibility,
 * moderation, Love, Echo and private notes must behave identically whether you are
 * sharing a dream, an afternoon with your family, a hobby, something you learned, or a
 * letter you want read.
 *
 * Only the words change — and the words matter. "Chapter 3" of an idea and "Memory 3"
 * of a hobby are the same row with a different name, because a hobby doesn't develop,
 * it accumulates; and a letter doesn't grow at all, it gets sent again.
 */
export const POST_KIND = ["IDEA", "MOMENT", "HOBBY", "LEARNING"] as const;
export type PostKind = (typeof POST_KIND)[number];

export interface KindCopy {
  /** URL segment: /compose/idea, /compose/hobby, … */
  slug: string;
  /** Button and menu text. */
  action: string;
  /** Singular, lowercase, for sentences: "this idea". */
  noun: string;
  /** Singular label for chips and badges. Not derivable from the plural — "Hobbies"
   *  loses more than an "s". */
  singular: string;
  /** Profile tab label. */
  plural: string;
  /** What one entry is called: Chapter / Memory / Lesson / Letter. */
  entryNoun: string;
  /** Plural of entryNoun. Spelled out because "Memory" does not pluralise with an "s". */
  entryPlural: string;
  /** Label on the very first entry in the timeline. */
  firstEntryLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  bodyHelp: string;
  /** One line under the composer heading, explaining what this space is for. */
  intro: string;
}

export const KIND_COPY: Record<PostKind, KindCopy> = {
  IDEA: {
    slug: "idea",
    action: "Share an idea",
    noun: "idea",
    singular: "Idea",
    plural: "Ideas",
    entryNoun: "Chapter",
    entryPlural: "chapters",
    firstEntryLabel: "How it started",
    titleLabel: "What is it?",
    titlePlaceholder: "A library where you borrow tools instead of books",
    bodyLabel: "Tell us about it",
    bodyPlaceholder: "What it is, where it came from, what you're stuck on…",
    bodyHelp: "However finished or unfinished it is. Nobody is marking this.",
    intro: "A thought you keep coming back to. It doesn't have to be realistic, or finished, or good.",
  },
  MOMENT: {
    slug: "moment",
    action: "Add a moment",
    noun: "moment",
    singular: "Moment",
    plural: "Moments",
    entryNoun: "Moment",
    entryPlural: "moments",
    firstEntryLabel: "The moment",
    titleLabel: "What happened?",
    titlePlaceholder: "Sunday at my grandmother's",
    bodyLabel: "Tell us about it",
    bodyPlaceholder: "Who was there, what you did, the bit you want to remember…",
    bodyHelp:
      "Ordinary days count. This isn't for the highlights — it's for the ones you'd forget otherwise.",
    intro:
      "Time with the people you care about. Keep it to yourself, your circle, or everyone — most people keep these close.",
  },
  HOBBY: {
    slug: "hobby",
    action: "Share a hobby",
    noun: "hobby",
    singular: "Hobby",
    plural: "Hobbies",
    entryNoun: "Memory",
    entryPlural: "memories",
    firstEntryLabel: "Where it began",
    titleLabel: "What would you call this?",
    titlePlaceholder: "The bonsai on my windowsill",
    bodyLabel: "Tell us about it",
    bodyPlaceholder: "How you got into it, what you love about it, what you're making now…",
    bodyHelp: "You don't have to be good at it. That isn't what this is for.",
    intro: "The thing you do because you want to. Add a memory to it whenever there's something to remember.",
  },
  LEARNING: {
    slug: "learning",
    action: "Share a learning",
    noun: "learning",
    singular: "Learning",
    plural: "Learnings",
    entryNoun: "Lesson",
    entryPlural: "lessons",
    firstEntryLabel: "What I set out to learn",
    titleLabel: "What are you learning?",
    titlePlaceholder: "Teaching myself to read music",
    bodyLabel: "What have you worked out so far?",
    bodyPlaceholder: "What clicked, what didn't, what you'd tell someone starting today…",
    bodyHelp: "Half-learned counts. So does the part you got wrong first.",
    intro: "Something you're working out. Come back and add a lesson each time it moves.",
  },
};

/**
 * How many questions one round of an interview may ask.
 *
 * Three is the feature, not a technical limit. A wall of questions reads as a form to be
 * filled in; three reads as someone who actually wants to know. Follow-up rounds add
 * three more when there is more to ask.
 */
export const KIND_BY_SLUG: Record<string, PostKind> = Object.fromEntries(
  POST_KIND.map((kind) => [KIND_COPY[kind].slug, kind]),
);

export function isPostKind(value: string): value is PostKind {
  return (POST_KIND as readonly string[]).includes(value);
}

/**
 * Hobbies offered in the dropdown. Broad on purpose — a list that misses a child's
 * actual hobby quietly tells them it doesn't count, so OTHER_HOBBY is always there
 * and opens a free text field.
 */
export const OTHER_HOBBY = "Something else";

export const HOBBY_OPTIONS = [
  "Drawing & painting",
  "Photography",
  "Crafts & DIY",
  "Origami",
  "Knitting & sewing",
  "Pottery",
  "Calligraphy",
  "Model building",
  "Music",
  "Singing",
  "Dancing",
  "Acting & drama",
  "Film-making",
  "Animation",
  "Podcasting",
  "Writing",
  "Reading",
  "Languages",
  "Cooking & baking",
  "Gardening",
  "Birdwatching",
  "Astronomy",
  "Science experiments",
  "Coding",
  "Robotics",
  "Video games",
  "Board games",
  "Card games",
  "Chess",
  "Puzzles",
  "Magic tricks",
  "Collecting",
  "Football",
  "Cricket",
  "Basketball",
  "Badminton",
  "Table tennis",
  "Athletics",
  "Swimming",
  "Cycling",
  "Skating",
  "Martial arts",
  "Yoga",
  "Hiking",
  "Fishing",
  "Volunteering",
  OTHER_HOBBY,
] as const;

/** Who an open letter can be addressed to. */
export const LETTER_RECIPIENTS = [
  "Government",
  "Ministry",
  "Directorate",
  "Organization",
  "Institution",
  "Association",
  "Agency",
  "Corporation",
  "Federation",
  "Foundation",
  "Council",
  "Committee",
  "Society",
  "Forum",
  "Parliament",
  "Others",
] as const;

export const MODERATION_STATUS = [
  "PENDING",
  "LIVE",
  "BLOCKED",
  "UNDER_REVIEW",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUS)[number];

export const ATTACHMENT_KIND = [
  "VIDEO",
  "AUDIO",
  "IMAGE",
  "PDF",
  "DOC",
  "TEXT",
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KIND)[number];

export const USER_ROLE = ["MEMBER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLE)[number];

export const USER_STATUS = ["ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const CONNECTION_STATUS = ["PENDING", "ACCEPTED"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUS)[number];

export const MODERATION_VERDICT = [
  "APPROVED",
  "BLOCKED_EXPLICIT",
  "BLOCKED_REPOSTED",
  "WARNED_IRRELEVANT",
  "NEEDS_REVIEW",
  "ERROR",
] as const;
export type ModerationVerdict = (typeof MODERATION_VERDICT)[number];

export const REVIEW_KIND = [
  "BAN_CONFIRM",
  "ORIGINALITY_UNSURE",
  "USER_REPORT",
  "BLOCK_APPEAL",
  // The reading room. Books are held to a stricter bar than posts — a child sits and
  // reads one for an hour — so anything short of a clean verdict reaches a person.
  "BOOK_REVIEW",
  "BOOK_BLOCKED",
  "BOOK_REPORT",
] as const;
export type ReviewKind = (typeof REVIEW_KIND)[number];

export const NOTIFICATION_KIND = [
  "LOVED",
  "ENCOURAGED",
  "ECHOED",
  "MILESTONE",
  "MODERATION",
  "CONNECTION",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KIND)[number];

/**
 * Four consecutive off-purpose posts open a ban review. Note "open a review" —
 * never "ban". A human approves every suspension.
 */
export const STRIKES_BEFORE_BAN_REVIEW = 4;

/** Length of the suspension an admin may approve, in days. */
export const SUSPENSION_DAYS = 15;

/**
 * Below this age, encouragement notes sent TO a user are preset phrases only.
 * No free text can reach a younger child from a stranger.
 */
export const FREE_TEXT_MIN_AGE = 16;

/**
 * Profile description cap, counted in words rather than characters because that's what
 * a person writing about themselves is actually thinking in.
 */
export const MAX_BIO_WORDS = 100;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function isVisibility(value: string): value is Visibility {
  return (VISIBILITY as readonly string[]).includes(value);
}

export function isModerationStatus(value: string): value is ModerationStatus {
  return (MODERATION_STATUS as readonly string[]).includes(value);
}
