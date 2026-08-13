import { mediaUrl } from "@/lib/media-url";

/**
 * Avatar with an initials fallback. The fallback colour is derived from the handle so a
 * user without a photo still gets something consistently theirs — no grey silhouette,
 * which reads as "incomplete profile" and is exactly the nagging this platform avoids.
 */
const FALLBACK_TINTS = [
  "#B45309", // marigold
  "#4D7C4A", // sprout
  "#C2415A", // coral
  "#3F6D8C", // slate blue
  "#7A5195", // plum
  "#946B2D", // ochre
];

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_TINTS[hash % FALLBACK_TINTS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  user,
  size = 40,
}: {
  user: { handle: string; displayName: string; avatarKey?: string | null };
  size?: number;
}) {
  const dimension = { width: size, height: size };

  if (user.avatarKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- media is served through an
      // authenticated route, which next/image's optimiser cannot fetch on the server.
      <img
        src={mediaUrl(user.avatarKey)}
        alt={`${user.displayName}'s profile picture`}
        style={{ ...dimension, borderRadius: "50%", objectFit: "cover" }}
        className="border"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        ...dimension,
        borderRadius: "50%",
        background: tintFor(user.handle),
        color: "#fff",
        fontSize: Math.round(size * 0.38),
      }}
      className="inline-flex shrink-0 items-center justify-center font-semibold"
    >
      {initials(user.displayName)}
    </span>
  );
}
