import { getSessionUser } from "@/lib/auth";
import { LandingClient } from "@/components/landing/landing-client";

/**
 * SpeakFix AI — marketing landing page, personalised for the signed-in
 * visitor. Log In / Sign Up navigate to the standalone auth pages; the
 * live application lives at /app.
 */
export default async function LandingPage() {
  const session = await getSessionUser();
  const user = session
    ? { name: session.name, email: session.email, role: session.role }
    : null;

  return <LandingClient user={user} />;
}
