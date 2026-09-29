import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SignupForm } from "@/components/auth/signup-form";

/**
 * Standalone signup page (also reachable from the landing hero panel).
 * Visitors already signed in are sent straight to the app.
 */
export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/app");
  return <SignupForm />;
}
