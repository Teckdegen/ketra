import { redirect } from "next/navigation";

/** Canonical privacy policy lives at /private. */
export default function PrivacyRedirect() {
  redirect("/private");
}
