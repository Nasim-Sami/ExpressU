/**
 * Gentle relative time. Deliberately vague at the far end ("a while back" rather than
 * "247 days ago") — an old idea shouldn't feel stale, it should feel like it's still there.
 */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "last month" : `${months} months ago`;
  return "a while back";
}

/** Full timestamp for the `title`/`dateTime` attributes, so the precise value is still available. */
export function isoDate(date: Date): string {
  return date.toISOString();
}

export function readableDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Past the point where `timeAgo` stops saying anything useful.
 *
 * "a while back" and "8 months ago" are fine on a busy feed but useless when someone is
 * looking through their own journal for the entry they wrote last spring. Beyond a month,
 * interfaces show the real date alongside rather than making people hover — which on a
 * phone they cannot do at all.
 */
export function isDistant(date: Date, days = 30): boolean {
  return Date.now() - date.getTime() > days * 24 * 60 * 60 * 1000;
}

/**
 * Date and time together, for the places where the hour genuinely matters — an edit made
 * an hour after the original, two entries added the same afternoon.
 */
export function readableDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
