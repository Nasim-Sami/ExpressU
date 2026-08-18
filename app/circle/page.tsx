import { redirect } from "next/navigation";

export default function CirclePage() {
  // Circle feature removed for single-user app. Redirect to home.
  redirect("/");
}
