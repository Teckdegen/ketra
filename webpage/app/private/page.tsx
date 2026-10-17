import { redirect } from "next/navigation";

/** Old path — canonical policy is /privacy. */
export default function PrivateRedirect() {
  redirect("/privacy");
}
