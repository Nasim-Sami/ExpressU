import { redirect } from "next/navigation";

export default function InterviewsPage() {
  // Interviews are removed in this single-user app. Redirect to home.
  redirect("/");
}
