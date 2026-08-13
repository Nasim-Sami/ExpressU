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
    </div>
  );
}
