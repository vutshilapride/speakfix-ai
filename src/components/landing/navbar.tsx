"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, AudioLines, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LandingUser } from "./types";

const links = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "U"
  );
}

export function LandingNavbar({ user }: { user: LandingUser }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "landing-nav fixed inset-x-0 top-0 z-50 border-b",
        scrolled || open ? "scrolled" : ""
      )}
    >
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        {/* Logo */}
        <Link href="#home" className="group flex items-center gap-2.5" aria-label="SpeakFix AI home">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#4f6ef7] to-[#6b8cff] text-white shadow-[0_4px_18px_rgba(79,110,247,0.5)] transition-transform duration-300 group-hover:scale-105">
            <AudioLines className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            SpeakFix <span className="text-[#6b8cff]">AI</span>
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link, i) => (
            <li key={link.label}>
              <a
                href={link.href}
                className={cn(
                  "relative px-4 py-2 text-[15px] font-medium tracking-tight transition-colors",
                  "text-slate-300 hover:text-white",
                  i === 0 &&
                    "text-white after:absolute after:inset-x-4 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-[#4f6ef7]"
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop actions — personalised by session */}
        {user ? (
          <div className="hidden items-center gap-3 lg:flex">
            <span className="flex items-center gap-2.5 rounded-full border border-[#253054] bg-[#111836]/80 py-1.5 pl-1.5 pr-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#4f6ef7] to-[#6b8cff] text-xs font-bold text-white">
                {initialsOf(user.name)}
              </span>
              <span className="text-sm font-medium text-slate-200">
                {user.name.split(/\s+/)[0]}
              </span>
            </span>
            <Link
              href="/app"
              className="btn-primary-landing group inline-flex items-center gap-2 rounded-full px-6 py-2 text-[15px] font-semibold"
            >
              Open App
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/login"
              className="btn-ghost-landing rounded-full px-6 py-2 text-[15px] font-semibold"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="btn-primary-landing rounded-full px-6 py-2 text-[15px] font-semibold"
            >
              Sign Up
            </Link>
          </div>
        )}

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#253054] text-slate-200 lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-[#253054]/60 bg-[#0a0e27]/95 px-5 pb-6 pt-3 backdrop-blur-xl lg:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((link, i) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-xl px-4 py-3 text-[15px] font-medium",
                    i === 0 ? "bg-[#4f6ef7]/15 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          {user ? (
            <div className="mt-4 flex flex-col gap-2.5">
              <span className="flex items-center justify-center gap-2.5 rounded-full border border-[#253054] bg-[#111836]/80 py-2 text-sm font-medium text-slate-200">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#4f6ef7] to-[#6b8cff] text-[11px] font-bold text-white">
                  {initialsOf(user.name)}
                </span>
                {user.name}
              </span>
              <Link
                href="/app"
                className="btn-primary-landing rounded-full px-6 py-2.5 text-center text-[15px] font-semibold"
              >
                Open App
              </Link>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="btn-ghost-landing rounded-full px-6 py-2.5 text-center text-[15px] font-semibold"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="btn-primary-landing rounded-full px-6 py-2.5 text-center text-[15px] font-semibold"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
