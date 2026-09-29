"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Languages, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";
import type { LearnedPhraseRecord } from "@/lib/types";

interface NotebookPanelProps {
  /** Bumped by the parent whenever Iris learns a new phrase (triggers refetch). */
  version: number;
}

/**
 * Iris's language notebook — the phrases the SpeakFix community taught her
 * in free-talk, grouped by language. Rendered inside the ticket-stub frame
 * while the agent is in free-talk mode.
 */
export function NotebookPanel({ version }: NotebookPanelProps) {
  const { t } = useT();
  const [phrases, setPhrases] = useState<LearnedPhraseRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/learned-phrases", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { phrases?: LearnedPhraseRecord[] };
        if (!cancelled) setPhrases(data.phrases ?? []);
      })
      .catch(() => {
        /* silent — the panel simply shows the empty state */
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // Group by language, newest first, most-taught languages on top
  const groups = useMemo(() => {
    if (!phrases) return [];
    const map = new Map<string, LearnedPhraseRecord[]>();
    for (const p of phrases) {
      const list = map.get(p.language) ?? [];
      list.push(p);
      map.set(p.language, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [phrases]);

  return (
    <div className="flex flex-col h-full" aria-label={t.agent.notebook.title}>
      {/* Brand strip */}
      <div className="h-1.5 w-full bg-brand-gradient" aria-hidden />

      {/* Header */}
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold tracking-[0.08em] flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden />
            {t.agent.notebook.title}
          </h3>
          {phrases !== null && phrases.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wide font-bold border-primary/50 text-primary dark:text-primary/90 bg-primary/5"
            >
              {fill(t.agent.notebook.count, { count: phrases.length })}
            </Badge>
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          {t.agent.notebook.subtitle}
        </p>
      </div>

      {/* Tear line under the header */}
      <div className="perforation mx-3" aria-hidden />

      {/* Learned phrases, grouped by language */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 custom-scrollbar">
        {phrases === null ? (
          <div className="space-y-2.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-2">
            <Sparkles className="h-5 w-5 text-primary/70" aria-hidden />
            <p className="text-sm font-medium">{t.agent.notebook.empty}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t.agent.notebook.teachHint}
            </p>
          </div>
        ) : (
          groups.map(([language, items]) => (
            <div key={language}>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <Languages className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                {language}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {items.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-dashed border-primary/25 bg-primary/[0.04] px-3 py-2"
                  >
                    <p className="text-sm font-semibold leading-snug break-words">
                      “{p.phrase}”
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug break-words">
                      {p.meaning}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Barcode footer (keeps a fixed h-14 so the punched notches line up) */}
      <footer className="flex h-14 shrink-0 items-center justify-between gap-4 border-t-2 border-dashed border-foreground/20 px-4">
        <div className="barcode w-28 text-foreground" aria-hidden />
        <p className="font-mono text-[10px] font-semibold tracking-[0.28em] text-muted-foreground">
          SF·LEARN
        </p>
      </footer>
    </div>
  );
}
