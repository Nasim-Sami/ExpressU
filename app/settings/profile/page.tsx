import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileEditor } from "@/components/ProfileEditor";
import { getSessionUser } from "@/lib/auth";
import { readLinks } from "@/lib/links";

export default async function ProfileSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        All of this is optional, and you can change it whenever you like.{" "}
        <Link href={`/u/${user.handle}`} className="font-semibold hover:underline">
          See how it looks
        </Link>
        .
      </p>

      <div className="mt-5">
        <ProfileEditor user={{ ...user, links: readLinks(user.links) }} />
      </div>

      <div className="eu-card mt-5 flex flex-wrap items-center gap-3 p-5">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">People you&apos;ve blocked</span>
          <span className="block text-sm" style={{ color: "var(--ink-muted)" }}>
            Anyone you&apos;ve blocked can&apos;t see you, and you can&apos;t see them.
          </span>
        </span>
        <Link href="/settings/blocked" className="eu-btn eu-btn-quiet">
          Manage
        </Link>
      </div>
    </div>
  );
}
