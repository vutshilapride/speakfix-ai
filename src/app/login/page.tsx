import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

/**
 * Standalone login page (also reachable from the landing hero panel).
 * Visitors already signed in are sent straight to the app.
 */
export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/app");
  return <LoginForm />;
}
