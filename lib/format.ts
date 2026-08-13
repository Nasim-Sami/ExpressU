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
