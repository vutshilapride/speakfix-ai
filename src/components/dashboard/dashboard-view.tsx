"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fill, localizedCategory, localizedPriority, localizedStatus } from "@/lib/i18n";
import { useT } from "@/lib/i18n/context";
import { StatsCards } from "./stats-cards";
import { TicketList } from "./ticket-list";
import { TicketDetailDialog, type Viewer } from "./ticket-detail-dialog";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketRecord,
  type TicketStats,
} from "@/lib/types";

export type TicketScope = "mine" | "queue" | "all";

interface DashboardViewProps {
  /** Incremented by the parent whenever a new ticket is created via the voice agent */
  refreshKey: number;
  viewer: Viewer;
  scope?: TicketScope;
}

export function DashboardView({ refreshKey, viewer, scope = "mine" }: DashboardViewProps) {
  const { toast } = useToast();
  const { t } = useT();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<TicketRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(`/api/tickets?scope=${scope}`, { cache: "no-store" });
        const data = (await res.json()) as { tickets?: TicketRecord[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load tickets");
        setTickets(data.tickets ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load tickets";
        toast({ title: t.dash.toastLoadFail, description: message, variant: "destructive" });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scope, toast]
  );

  useEffect(() => {
    void load();
     
  }, [refreshKey, scope]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status !== "ALL" && t.status !== status) return false;
      if (category !== "ALL" && t.category !== category) return false;
      if (priority !== "ALL" && t.priority !== priority) return false;
      if (q) {
        const haystack = `${t.ticketNumber} ${t.title} ${t.description} ${t.location} ${t.requesterName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, search, status, category, priority]);

  const stats: TicketStats = useMemo(
    () => ({
      total: tickets.length,
      open: tickets.filter((t) => t.status === "OPEN").length,
      inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
      awaitingVerification: tickets.filter((t) => t.status === "AWAITING_VERIFICATION").length,
      resolved: tickets.filter((t) => t.status === "RESOLVED").length,
      reopened: tickets.filter((t) => t.status === "REOPENED").length,
      critical: tickets.filter((t) => t.priority === "CRITICAL").length,
      high: tickets.filter((t) => t.priority === "HIGH").length,
    }),
    [tickets]
  );

  const handleUpdated = useCallback((ticket: TicketRecord) => {
    setSelected((prev) => (prev && prev.id === ticket.id ? ticket : prev));
    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const hasFilters = search !== "" || status !== "ALL" || category !== "ALL" || priority !== "ALL";
  const copy = t.scopes[scope];

  return (
    <div className="space-y-4">
      <StatsCards stats={stats} showReopened={scope !== "mine"} />

      {/* Toolbar */}
      <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.dash.searchPlaceholder}
            className="pl-9"
            aria-label={t.dash.searchAria}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[130px]" aria-label={t.dash.statusFilterAria}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.dash.allStatuses}</SelectItem>
              {TICKET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {localizedStatus(s, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full sm:w-[120px]" aria-label={t.dash.priorityFilterAria}>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.dash.allPriorities}</SelectItem>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {localizedPriority(p, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-[150px]" aria-label={t.dash.categoryFilterAria}>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.dash.allCategories}</SelectItem>
              {TICKET_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {localizedCategory(c, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="col-span-2 flex gap-2 sm:col-span-1">
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} aria-label={t.dash.clearFilters} title={t.dash.clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load(true)}
              disabled={refreshing}
              aria-label={t.dash.refreshAria}
              title={t.dash.refresh}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {tickets.length === 0 ? copy.empty : t.dash.noMatch}
          </p>
        </div>
      ) : (
        <TicketList
          tickets={filtered}
          onSelect={(ticket) => {
            setSelected(ticket);
            setDialogOpen(true);
          }}
        />
      )}

      {tickets.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pb-1">
          {fill(t.dash.showing, { shown: filtered.length, total: tickets.length })}
        </p>
      )}

      <TicketDetailDialog
        ticket={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        viewer={viewer}
      />
    </div>
  );

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
    setCategory("ALL");
    setPriority("ALL");
  }
}
