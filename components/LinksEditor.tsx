"use client";

import { useState } from "react";

import { MAX_LINKS, hostOf, suggestLabel, type ProfileLink } from "@/lib/links";

/**
 * The links row of the profile editor.
 *
 * Each link is submitted as a paired hidden field so the whole profile still saves in one
 * form post. The host is shown next to every entry while editing, for the same reason it
 * is shown when reading: you should always be able to see where a link actually goes.
 */
export function LinksEditor({ initial }: { initial: ProfileLink[] }) {
  const [links, setLinks] = useState<ProfileLink[]>(initial);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const full = links.length >= MAX_LINKS;

  function add() {
    const trimmed = url.trim();
    if (!trimmed || full) return;
    setLinks([...links, { url: trimmed, label: label.trim() || suggestLabel(trimmed) }]);
    setUrl("");
    setLabel("");
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold">Your links</span>
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        Anywhere else you are — YouTube, Instagram, a portfolio, your school club&apos;s
        page. Up to {MAX_LINKS}. Anyone who can see your profile can follow these, so only
        add ones you&apos;re happy for strangers to open.
      </p>

      {links.length > 0 && (
        <ul className="flex flex-col gap-2">
          {links.map((link, index) => (
            <li
              key={`${link.url}-${index}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--surface-sunken)" }}
            >
              <input type="hidden" name="linkLabel" value={link.label} />
              <input type="hidden" name="linkUrl" value={link.url} />

              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{link.label}</span>
                <span className="block truncate" style={{ color: "var(--ink-muted)" }}>
                  {hostOf(link.url) || link.url}
                </span>
              </span>

              <button
                type="button"
                onClick={() => setLinks(links.filter((_, i) => i !== index))}
                className="font-semibold"
                style={{ color: "var(--love-strong)" }}
                aria-label={`Remove ${link.label}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="eu-field sm:flex-[2]"
            placeholder="youtube.com/@you"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Link address"
            // Enter inside a sub-field would otherwise submit the whole profile form.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <input
            className="eu-field sm:flex-1"
            placeholder={url ? suggestLabel(url) : "What to call it"}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            aria-label="What to call this link"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" onClick={add} className="eu-btn eu-btn-quiet shrink-0" disabled={!url.trim()}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}
