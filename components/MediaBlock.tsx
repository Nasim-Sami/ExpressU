import { mediaUrl } from "@/lib/media-url";
import type { AttachmentView } from "@/lib/posts";

/**
 * Renders whatever a young person attached — a film, a song, a scan of a sketchbook page,
 * a school essay, a text file. Every type gets a real presentation rather than a generic
 * paperclip, because "any format" is only true if the platform actually shows it properly.
 */
export function MediaBlock({ attachments }: { attachments: AttachmentView[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-3">
      {attachments.map((attachment) => (
        <One key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}

function One({ attachment }: { attachment: AttachmentView }) {
  switch (attachment.kind) {
    case "VIDEO":
      return (
        <figure className="overflow-hidden rounded-xl border">
          <video
            controls
            preload="metadata"
            poster={attachment.posterKey ? mediaUrl(attachment.posterKey) : undefined}
            className="h-auto w-full bg-black"
            style={{ maxHeight: "34rem" }}
          >
            <source src={mediaUrl(attachment.storageKey)} type={attachment.mimeType} />
            {/* Captions belong here when the author supplies them — see the a11y note in the README. */}
            Your browser can&apos;t play this video.{" "}
            <a href={mediaUrl(attachment.storageKey)}>Download it instead</a>.
          </video>
        </figure>
      );

    case "AUDIO":
      return (
        <figure
          className="flex flex-col gap-2 rounded-xl border p-4"
          style={{ background: "var(--surface-sunken)" }}
        >
          <figcaption className="flex items-center gap-2 text-sm font-semibold">
            <WaveIcon />
            <span className="truncate">{attachment.filename}</span>
            {attachment.durationSec && (
              <span style={{ color: "var(--ink-muted)" }}>{formatDuration(attachment.durationSec)}</span>
            )}
          </figcaption>
          <audio controls preload="metadata" className="w-full">
            <source src={mediaUrl(attachment.storageKey)} type={attachment.mimeType} />
            Your browser can&apos;t play this audio.
          </audio>
        </figure>
      );

    case "IMAGE":
      return (
        <figure className="overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element -- served through the
              authenticated media route, which next/image cannot fetch server-side. */}
          <img
            src={mediaUrl(attachment.posterKey ?? attachment.storageKey)}
            alt={attachment.filename}
            loading="lazy"
            className="h-auto w-full"
            style={{ maxHeight: "34rem", objectFit: "contain", background: "var(--surface-sunken)" }}
          />
        </figure>
      );

    case "PDF":
      return (
        <FileCard
          attachment={attachment}
          icon={<DocIcon />}
          detail={
            attachment.pageCount
              ? `PDF · ${attachment.pageCount} ${attachment.pageCount === 1 ? "page" : "pages"}`
              : "PDF"
          }
        />
      );

    case "DOC":
      return <FileCard attachment={attachment} icon={<DocIcon />} detail="Document" />;

    case "TEXT":
      return <FileCard attachment={attachment} icon={<DocIcon />} detail="Text file" />;

    default:
      return <FileCard attachment={attachment} icon={<DocIcon />} detail="File" />;
  }
}

function FileCard({
  attachment,
  icon,
  detail,
}: {
  attachment: AttachmentView;
  icon: React.ReactNode;
  detail: string;
}) {
  return (
    <a
      href={mediaUrl(attachment.storageKey)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border p-3 transition-colors"
      style={{ background: "var(--surface-sunken)" }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{attachment.filename}</span>
        <span className="block text-sm" style={{ color: "var(--ink-muted)" }}>
          {detail} · {formatBytes(attachment.sizeBytes)}
        </span>
      </span>
      <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
        Open
      </span>
    </a>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M3 12h2m3-5v10m4-14v18m4-13v8m4-5h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M6 3.5h7.5L19 9v11.5H6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13.2 3.6V9.2H18.8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
