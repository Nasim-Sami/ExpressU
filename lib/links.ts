/**
 * Links a person chooses to put on their profile.
 *
 * These are the only place on ExpressU where one user can send another off the platform,
 * which on a site built for children deserves more care than a text field:
 *
 *   - Only http and https are ever stored. `javascript:` and `data:` URLs are the classic
 *     way to turn "add your Instagram" into running code in someone else's browser.
 *   - The host is always shown next to the label, so a child can see that "my art" goes
 *     to some-stranger-site.example before they tap it, not after.
 *   - Rendering adds rel="noopener noreferrer nofollow ugc" and opens in a new tab, so
 *     the destination can neither reach back into the page nor inherit any credit.
 *
 * None of that makes an arbitrary link safe. It makes it honest, which is what we can
 * actually offer.
 */

export interface ProfileLink {
  label: string;
  url: string;
}

export const MAX_LINKS = 6;
const MAX_LABEL = 40;

/** Well-known hosts get a friendlier default label than their domain. */
const KNOWN_HOSTS: { match: RegExp; label: string }[] = [
  { match: /(^|\.)facebook\.com$/i, label: "Facebook" },
  { match: /(^|\.)instagram\.com$/i, label: "Instagram" },
  { match: /(^|\.)(youtube\.com|youtu\.be)$/i, label: "YouTube" },
  { match: /(^|\.)linkedin\.com$/i, label: "LinkedIn" },
  { match: /(^|\.)(twitter\.com|x\.com)$/i, label: "X" },
  { match: /(^|\.)tiktok\.com$/i, label: "TikTok" },
  { match: /(^|\.)github\.com$/i, label: "GitHub" },
  { match: /(^|\.)behance\.net$/i, label: "Behance" },
  { match: /(^|\.)dribbble\.com$/i, label: "Dribbble" },
  { match: /(^|\.)soundcloud\.com$/i, label: "SoundCloud" },
  { match: /(^|\.)bandcamp\.com$/i, label: "Bandcamp" },
  { match: /(^|\.)spotify\.com$/i, label: "Spotify" },
  { match: /(^|\.)medium\.com$/i, label: "Medium" },
  { match: /(^|\.)substack\.com$/i, label: "Substack" },
  { match: /(^|\.)pinterest\.[a-z.]+$/i, label: "Pinterest" },
  { match: /(^|\.)twitch\.tv$/i, label: "Twitch" },
  { match: /(^|\.)reddit\.com$/i, label: "Reddit" },
  { match: /(^|\.)deviantart\.com$/i, label: "DeviantArt" },
];

/**
 * The bare host, with `www.` dropped — what we show so the destination is never a
 * surprise.
 *
 * Assumes https for a scheme-less address, matching `parseLink`. Without that, a person
 * typing "youtube.com/@me" gets no host shown and a label of "Link" while they're still
 * editing, which makes the field look broken right when they're deciding to trust it.
 */
export function hostOf(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    // Only web addresses have a host worth showing; a javascript: URL must not get one.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function suggestLabel(url: string): string {
  const host = hostOf(url);
  if (!host) return "Link";
  const known = KNOWN_HOSTS.find((entry) => entry.match.test(host));
  return known ? known.label : host;
}

/**
 * Parses and normalises one link, or returns a reason it can't be stored.
 * A bare "instagram.com/me" is treated as https rather than rejected — that is how
 * people actually type addresses.
 */
export function parseLink(
  rawUrl: string,
  rawLabel?: string,
): { ok: true; link: ProfileLink } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: false, error: "That link is empty." };

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: `"${rawUrl}" doesn't look like a web address.` };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    // The important one. A javascript: or data: URL here would run in the browser of
    // whoever tapped it.
    return { ok: false, error: "Links have to start with http:// or https://" };
  }

  if (!parsed.hostname.includes(".")) {
    return { ok: false, error: `"${rawUrl}" doesn't look like a web address.` };
  }

  const label = (rawLabel ?? "").trim().slice(0, MAX_LABEL) || suggestLabel(parsed.toString());

  return { ok: true, link: { label, url: parsed.toString() } };
}

/** Reads the stored JSON, discarding anything that no longer parses. Never throws. */
export function readLinks(json: string | null): ProfileLink[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is ProfileLink =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as ProfileLink).url === "string" &&
          typeof (entry as ProfileLink).label === "string",
      )
      // Re-validate on the way out: a link stored before a rule tightened must not
      // suddenly become renderable again.
      .filter((entry) => parseLink(entry.url).ok)
      .slice(0, MAX_LINKS);
  } catch {
    return [];
  }
}

export function writeLinks(links: ProfileLink[]): string | null {
  return links.length === 0 ? null : JSON.stringify(links.slice(0, MAX_LINKS));
}
