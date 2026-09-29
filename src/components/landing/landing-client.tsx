"use client";

import { useEffect } from "react";
import { LandingNavbar } from "./navbar";
import { LandingHero } from "./hero";
import { LandingFeatures } from "./features";
import { LandingHowItWorks } from "./how-it-works";
import { LandingAbout, LandingCta, LandingFooter } from "./cta-footer";
import type { LandingUser } from "./types";

/**
 * Client shell for the marketing landing page.
 * "Log In" / "Sign Up" navigate to the standalone /login and /signup
 * pages; the landing itself stays a clean marketing page.
 */
export function LandingClient({ user }: { user: LandingUser }) {
  // Scroll-reveal: every .reveal element fades in when it enters the viewport
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("reveal-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing min-h-screen bg-[#0a0e27] font-sans">
      <LandingNavbar user={user} />
      <main>
        <LandingHero user={user} />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingAbout />
        <LandingCta user={user} />
      </main>
      <LandingFooter user={user} />
    </div>
  );
}
