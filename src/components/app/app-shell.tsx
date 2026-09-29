"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AudioLines,
  LayoutDashboard,
  Mic,
  Moon,
  Sun,
  ArrowRight,
  LogOut,
  ChevronDown,
  Wrench,
  BarChart3,
  UserCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fill } from "@/lib/i18n";
import { LanguageProvider, useT } from "@/lib/i18n/context";
import { VoiceAgentView } from "@/components/voice/voice-agent-view";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { InsightsView } from "@/components/insights/insights-view";
import { ProfileView } from "@/components/profile/profile-view";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  preferredLanguage: string;
  role: string; // USER | TECHNICIAN | ADMIN
}

type Tab = "agent" | "mine" | "queue" | "all" | "insights" | "profile";

/**
 * Holds the live user state and provides the user's preferred language to
 * the entire app — every component below reads translated strings via useT().
 */
export function AppShell({ user: initialUser }: { user: AppUser }) {
  const [user, setUser] = useState<AppUser>(initialUser);

  return (
    <LanguageProvider language={user.preferredLanguage || "English"}>
      <AppShellInner user={user} onUserUpdated={setUser} />
    </LanguageProvider>
  );
}

function AppShellInner({
  user,
  onUserUpdated,
}: {
  user: AppUser;
  onUserUpdated: (u: AppUser) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("agent");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const { setTheme } = useTheme();

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isTech = user.role === "TECHNICIAN";
  const isAdmin = user.role === "ADMIN";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  const tabs: { key: Tab; label: string; shortLabel: string; icon: typeof Mic }[] = [
    { key: "agent", label: t.nav.report, shortLabel: t.nav.reportShort, icon: Mic },
    { key: "mine", label: t.nav.mine, shortLabel: t.nav.mineShort, icon: LayoutDashboard },
    ...(isTech || isAdmin
      ? [{ key: "queue" as Tab, label: t.nav.queue, shortLabel: t.nav.queueShort, icon: Wrench }]
      : []),
    ...(isAdmin
      ? [
          { key: "all" as Tab, label: t.nav.all, shortLabel: t.nav.allShort, icon: LayoutDashboard },
          { key: "insights" as Tab, label: t.nav.insights, shortLabel: t.nav.insights, icon: BarChart3 },
        ]
      : []),
    { key: "profile", label: t.nav.profile, shortLabel: t.nav.profile, icon: UserCircle },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ------------------------------ Header ------------------------------ */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 sm:py-0 sm:h-14">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              aria-label={t.nav.home}
            >
              <AudioLines className="h-4.5 w-4.5" aria-hidden />
            </Link>
            <div className="shrink-0 leading-tight sm:min-w-0">
              <Link
                href="/"
                className="font-display whitespace-nowrap text-sm font-semibold tracking-tight transition-colors hover:text-primary"
              >
                SpeakFix AI
              </Link>
              <p className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                {t.roles[user.role as keyof typeof t.roles] ?? t.roles.USER} · {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")
              }
              aria-label={t.nav.theme}
              className="h-8 w-8 shrink-0"
            >
              <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
              <Moon className="h-4 w-4 dark:hidden" aria-hidden />
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full border bg-card py-1 pl-1 pr-2 transition-colors hover:border-primary/40 cursor-pointer"
                  aria-label={t.nav.accountMenu}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {initials || "U"}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-xs font-medium sm:inline">
                    {firstName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setTab("profile")}
                  className="cursor-pointer"
                >
                  <UserCircle className="h-4 w-4" aria-hidden />
                  {t.nav.profileMenu}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {loggingOut ? t.nav.loggingOut : t.nav.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tab switcher — full-width row on small screens so all tabs stay reachable */}
          <nav
            className="flex w-full items-center gap-0.5 overflow-x-auto rounded-md border p-0.5 sm:w-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label={t.nav.mainNav}
          >
            {tabs.map(({ key, label, shortLabel, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                title={label}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer",
                  tab === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden md:inline">{label}</span>
                <span className="md:hidden">{shortLabel}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ------------------------------- Main -------------------------------- */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Compact intro — only on the voice tab */}
        {tab === "agent" && (
          <section className="mb-6 max-w-xl" aria-label="Introduction">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {fill(t.intro.title, { name: firstName })}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.intro.subtitle}</p>
          </section>
        )}

        {/* Ticket list headers */}
        {tab !== "agent" && tab !== "insights" && tab !== "profile" && (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                {tab === "mine" ? t.scopes.mine.title : tab === "queue" ? t.scopes.queue.title : t.scopes.all.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {tab === "mine"
                  ? t.scopes.mine.subtitle
                  : tab === "queue"
                    ? t.scopes.queue.subtitle
                    : t.scopes.all.subtitle}
              </p>
            </div>
            {tab === "mine" && (
              <Button size="sm" variant="outline" onClick={() => setTab("agent")} className="gap-1.5">
                <Mic className="h-4 w-4" aria-hidden />
                {t.headers.reportProblem}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
          </div>
        )}
        {tab === "insights" && (
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold tracking-tight">{t.headers.insights}</h2>
            <p className="text-xs text-muted-foreground">{t.headers.insightsSub}</p>
          </div>
        )}
        {tab === "profile" && (
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold tracking-tight">{t.headers.profile}</h2>
            <p className="text-xs text-muted-foreground">{t.headers.profileSub}</p>
          </div>
        )}

        {/* Voice agent tab (kept mounted to preserve the conversation) */}
        <div className={tab === "agent" ? "" : "hidden"} aria-hidden={tab !== "agent"}>
          <VoiceAgentView
            onTicketCreated={() => setRefreshKey((k) => k + 1)}
            onGoToDashboard={() => setTab(isTech ? "queue" : "mine")}
            userName={user.name}
          />
        </div>

        {/* Ticket dashboards — only mounted for roles that can access them,
            so no unauthorized fetches ever fire */}
        <div className={tab === "mine" ? "" : "hidden"} aria-hidden={tab !== "mine"}>
          <DashboardView
            refreshKey={refreshKey}
            scope="mine"
            viewer={{ id: user.id, name: user.name, role: user.role }}
          />
        </div>
        {(isTech || isAdmin) && (
          <div className={tab === "queue" ? "" : "hidden"} aria-hidden={tab !== "queue"}>
            <DashboardView
              refreshKey={refreshKey}
              scope="queue"
              viewer={{ id: user.id, name: user.name, role: user.role }}
            />
          </div>
        )}
        {isAdmin && (
          <>
            <div className={tab === "all" ? "" : "hidden"} aria-hidden={tab !== "all"}>
              <DashboardView
                refreshKey={refreshKey}
                scope="all"
                viewer={{ id: user.id, name: user.name, role: user.role }}
              />
            </div>
            <div className={tab === "insights" ? "" : "hidden"} aria-hidden={tab !== "insights"}>
              <InsightsView />
            </div>
          </>
        )}

        {/* Profile — every logged-in user can see and edit their own */}
        <div className={tab === "profile" ? "" : "hidden"} aria-hidden={tab !== "profile"}>
          <ProfileView user={user} onUserUpdated={onUserUpdated} />
        </div>
      </main>

      {/* ------------------------------ Footer ------------------------------ */}
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">SpeakFix AI</span> — {t.footer.tagline}
          </p>
          <p className="text-[11px] text-muted-foreground/70">{t.footer.promise}</p>
        </div>
      </footer>
    </div>
  );
}
