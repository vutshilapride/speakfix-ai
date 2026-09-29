"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  RotateCcw,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fill, localizedAuditAction, localizedCategory } from "@/lib/i18n";
import { useT } from "@/lib/i18n/context";
import type { AuditEntryRecord, RecurringIssue } from "@/lib/types";

interface InsightsData {
  recurring: RecurringIssue[];
  users: { id: string; name: string; email: string; role: string; ticketCount: number }[];
  activity: AuditEntryRecord[];
}

export function InsightsView() {
  const { toast } = useToast();
  const { t: L, langCode } = useT();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/insights", { cache: "no-store" });
      const json = (await res.json()) as InsightsData & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load insights");
      setData(json);
    } catch (err) {
      toast({
        title: L.insights.couldNotLoad,
        description: err instanceof Error ? err.message : L.common.pleaseTryAgain,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* -------- recurring issues -------- */}
      <section aria-label={L.insights.recurringAria}>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <RotateCcw className="h-4 w-4 text-muted-foreground" aria-hidden />
          {L.insights.recurring}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {L.insights.recurringSub}
        </p>
        {data.recurring.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
            {L.insights.noRecurring}
          </p>
        ) : (
          <ul className="mt-3 divide-y overflow-hidden rounded-lg border bg-card">
            {data.recurring.map((r) => (
              <li key={`${r.location}::${r.category}`} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {fill(L.insights.incidents, { count: r.count })}
                  </span>
                  <span className="text-sm font-medium">
                    {localizedCategory(r.category, L)} — {r.location}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                    {L.insights.lastLabel} {new Date(r.lastReportedAt).toLocaleDateString(langCode, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{r.suggestion}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
                  {r.ticketNumbers.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -------- people -------- */}
      {data.users.length > 0 && (
        <section aria-label={L.insights.peopleAria}>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <UserIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
            {L.insights.people}
          </h3>
          <ul className="mt-3 divide-y overflow-hidden rounded-lg border bg-card">
            {data.users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-[10px] font-semibold text-muted-foreground">
                  {u.name
                    .split(/\s+/)
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.name}
                    {u.role !== "USER" && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded border border-foreground/15 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                        {u.role === "TECHNICIAN" ? <Wrench className="h-2.5 w-2.5" aria-hidden /> : null}
                        {L.roles[u.role as keyof typeof L.roles] ?? u.role}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {u.ticketCount === 1
                    ? L.insights.ticketCountOne
                    : fill(L.insights.ticketCount, { count: u.ticketCount })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* -------- activity -------- */}
      {data.activity.length > 0 && (
        <section aria-label={L.insights.activityAria}>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            {L.insights.activity}
          </h3>
          <ul className="mt-3 divide-y overflow-hidden rounded-lg border bg-card">
            {data.activity.slice(0, 12).map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {new Date(a.createdAt).toLocaleString(langCode, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <p className="min-w-0 flex-1 text-xs">
                  <span className="font-medium">{a.actorName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {a.detail ?? localizedAuditAction(a.action, L)}
                  </span>
                </p>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40" aria-hidden />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
