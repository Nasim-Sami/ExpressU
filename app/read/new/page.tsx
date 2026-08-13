import Link from "next/link";
import { redirect } from "next/navigation";

import { BookUploader } from "@/components/BookUploader";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Add a book — ExpressU" };

export default async function NewBookPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/read/new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/read" className="text-sm font-semibold" style={{ color: "var(--ink-muted)" }}>
        ← Reading room
      </Link>

      <h1 className="font-display mt-4 text-3xl font-semibold">Add a book</h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        A story you wrote, or one you think other people here should be able to read.
      </p>

      <div className="mt-6">
        <BookUploader />
      </div>
    </div>
  );
}
