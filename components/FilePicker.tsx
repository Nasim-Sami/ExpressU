"use client";

import { useRef, useState } from "react";

/**
 * The attach-anything control, shared by every composer and the entry editor.
 *
 * The native file input stays the source of truth for the form submission; drag-and-drop
 * writes into it via a DataTransfer rather than keeping a parallel list that could drift
 * out of sync with what actually gets uploaded.
 */
export function FilePicker({
  label = "Add anything you've made",
  help = "Video, audio, images, PDFs, documents, text files. Up to 10 files.",
  existing,
}: {
  label?: string;
  help?: string;
  /** Files already attached, offered for removal. Only used when editing. */
  existing?: { id: string; filename: string; sizeBytes: number }[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function sync(next: File[]) {
    setFiles(next);
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    for (const file of next) transfer.items.add(file);
    inputRef.current.files = transfer.files;
  }

  function add(incoming: FileList | null) {
    if (!incoming) return;
    sync([...files, ...Array.from(incoming)].slice(0, 10));
  }

  const keptExisting = (existing ?? []).filter((f) => !removed.has(f.id));
  const needsAttest = files.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold">{label}</span>
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        {help}
      </p>

      {keptExisting.length > 0 && (
        <ul className="flex flex-col gap-2">
          {keptExisting.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--surface-sunken)" }}
            >
              <span className="min-w-0 flex-1 truncate">{file.filename}</span>
              <span style={{ color: "var(--ink-muted)" }}>
                {(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => setRemoved(new Set([...removed, file.id]))}
                className="font-semibold"
                style={{ color: "var(--love-strong)" }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Removals travel as hidden inputs so the whole edit is one form submission. */}
      {[...removed].map((id) => (
        <input key={id} type="hidden" name="removeAttachment" value={id} />
      ))}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className="rounded-xl border-2 border-dashed p-6 text-center transition-colors"
        style={{
          borderColor: dragging ? "var(--accent)" : "var(--line-strong)",
          background: dragging ? "var(--accent-soft)" : "transparent",
        }}
      >
        <input
          ref={inputRef}
          id="files"
          name="files"
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => add(e.target.files)}
        />
        <label htmlFor="files" className="cursor-pointer font-semibold" style={{ color: "var(--accent)" }}>
          Choose files
        </label>
        <span style={{ color: "var(--ink-muted)" }}> or drag them here</span>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--surface-sunken)" }}
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span style={{ color: "var(--ink-muted)" }}>
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => sync(files.filter((_, i) => i !== index))}
                className="font-semibold"
                style={{ color: "var(--ink-muted)" }}
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {needsAttest && (
        <label className="mt-1 flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="attest" value="yes" className="mt-1" required />
          <span>
            This is my own work, or I have the right to share it.
            <span className="block" style={{ color: "var(--ink-muted)" }}>
              Covers, remixes, fan art and things made in someone else&apos;s style all count as
              yours.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
