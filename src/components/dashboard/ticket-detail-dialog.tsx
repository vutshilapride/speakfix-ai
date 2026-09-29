"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin,
  User,
  CalendarClock,
  FileText,
  Trash2,
  Mic,
  Clock,
  Mail,
  Plus,
  UserPlus,
  Wrench,
  ClipboardCheck,
  Paperclip,
  BadgeCheck,
  CheckCircle2,
  RotateCcw,
  Pencil,
  Volume2,
  Camera,
  ListChecks,
  Cog,
  StickyNote,
  AudioLines,
  ShieldCheck,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useSpeech } from "@/hooks/use-speech";
import { fill, localizedAuditAction, localizedEvidenceType } from "@/lib/i18n";
import { useT } from "@/lib/i18n/context";
import { PriorityTag, StatusTag, CategoryTag } from "./ticket-badges";
import {
  EMPTY_RESOLUTION_FIELDS,
  type AuditEntryRecord,
  type EvidenceEntry,
  type ResolutionFields,
  type TicketRecord,
  type VerificationChecklist,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Viewer {
  id: string;
  name: string;
  role: string; // USER | TECHNICIAN | ADMIN
}

interface TicketDetailDialogProps {
  ticket: TicketRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (ticket: TicketRecord) => void;
  onDeleted: (id: string) => void;
  viewer: Viewer;
}

/* ------------------------------ helpers ------------------------------ */

function computeChecklist(t: TicketRecord): VerificationChecklist {
  return {
    actionRecorded: Boolean(t.technicianAction?.trim()),
    notesSubmitted: Boolean(t.resolutionNotes?.trim()),
    evidenceSubmitted: Boolean(t.evidence && t.evidence.length > 0),
    testPerformed: Boolean(t.testResult?.trim()),
    reporterConfirmed: Boolean(t.reporterConfirmedAt),
  };
}

const AUDIT_ICONS: Record<string, typeof Plus> = {
  TICKET_CREATED: Plus,
  ASSIGNED: UserPlus,
  WORK_STARTED: Wrench,
  RESOLUTION_SUBMITTED: ClipboardCheck,
  EVIDENCE_SUBMITTED: Paperclip,
  VERIFICATION_REQUESTED: BadgeCheck,
  REPORTER_CONFIRMED: CheckCircle2,
  TICKET_REOPENED: RotateCcw,
  DETAILS_UPDATED: Pencil,
  TICKET_DELETED: Trash2,
};

const EVIDENCE_TYPES: { value: EvidenceEntry["type"]; icon: typeof Camera }[] = [
  { value: "photo", icon: Camera },
  { value: "checklist", icon: ListChecks },
  { value: "part", icon: Cog },
  { value: "note", icon: StickyNote },
  { value: "voice", icon: AudioLines },
];

function fmtDateTime(iso: string | null, locale?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------ component ------------------------------ */

export function TicketDetailDialog({
  ticket,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  viewer,
}: TicketDetailDialogProps) {
  const { toast } = useToast();
  const { t: L, langCode } = useT();
  const speech = useSpeech({ lang: langCode });

  const [current, setCurrent] = useState<TicketRecord | null>(ticket);
  const [audit, setAudit] = useState<AuditEntryRecord[]>([]);
  // false while the first audit fetch for the open ticket is in flight —
  // distinguishes "still loading" from a genuinely empty timeline.
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Resolution form state
  const [showForm, setShowForm] = useState(false);
  const [resolution, setResolution] = useState<ResolutionFields>({ ...EMPTY_RESOLUTION_FIELDS });
  const [evidenceDrafts, setEvidenceDrafts] = useState<EvidenceEntry[]>([]);
  const [voiceDoc, setVoiceDoc] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState<string[]>([]);
  const [voiceReady, setVoiceReady] = useState(false);

  // Admin assignment — select a technician first, then press Assign
  const [techs, setTechs] = useState<{ id: string; name: string; role: string }[]>([]);
  const [assignTechId, setAssignTechId] = useState("");

  // Voice resolution conversation (resolve mode)
  const resolveMessagesRef = useRef<{ role: "user" | "agent"; content: string }[]>([]);
  const resolutionRef = useRef(resolution);
  useEffect(() => {
    resolutionRef.current = resolution;
  }, [resolution]);

  const t = current ?? ticket;
  const isStaff = viewer.role === "TECHNICIAN" || viewer.role === "ADMIN";
  // ONLY the assigned technician can work the ticket. Admins assign — the
  // technician progresses the status (start work, resolution, evidence).
  const canWork = Boolean(
    t && viewer.role === "TECHNICIAN" && t.assignedTechnicianId === viewer.id
  );
  const viewerIsReporter = Boolean(t && t.userId === viewer.id);

  /* ------------------- load full ticket + audit on open ------------------- */
  const load = useCallback(
    async (id: string, silent = false) => {
      if (!silent) setBusy("loading");
      try {
        const res = await fetch(`/api/tickets/${id}`, { cache: "no-store" });
        const data = (await res.json()) as {
          ticket?: TicketRecord;
          audit?: AuditEntryRecord[];
          error?: string;
        };
        if (!res.ok || !data.ticket) throw new Error(data.error || "Failed to load ticket");
        setCurrent(data.ticket);
        setAudit(data.audit ?? []);
        setAuditLoaded(true);
        onUpdated(data.ticket);
      } catch (err) {
        toast({
          title: L.ticket.couldNotLoad,
          description: err instanceof Error ? err.message : L.common.pleaseTryAgain,
          variant: "destructive",
        });
        setAuditLoaded(true); // don't hang on "loading" after a failure
      } finally {
        setBusy(null);
      }
    },
    [onUpdated, toast]
  );

  useEffect(() => {
    if (open && ticket?.id) {
      setCurrent(ticket);
      setAuditLoaded(false);
      setShowForm(false);
      setResolution({
        technicianAction: "",
        resolutionNotes: "",
        testResult: "",
      });
      setEvidenceDrafts([]);
      setAssignTechId("");
      setVoiceReplies([]);
      setVoiceReady(false);
      resolveMessagesRef.current = [];
      void load(ticket.id, true);
      // Admin: load technicians for assignment
      if (viewer.role === "ADMIN") {
        void (async () => {
          try {
            const res = await fetch("/api/users?role=TECHNICIAN", { cache: "no-store" });
            const data = (await res.json()) as { users?: { id: string; name: string; role: string }[] };
            if (res.ok && data.users) setTechs(data.users);
          } catch {
            /* assignment dropdown just stays empty */
          }
        })();
      }
    }
     
  }, [open, ticket?.id]);

  /* ------------------------------ actions ------------------------------ */

  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!t) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/tickets/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await res.json()) as { ticket?: TicketRecord; audit?: AuditEntryRecord[]; error?: string };
      if (!res.ok || !data.ticket) throw new Error(data.error || "Update failed");
      setCurrent(data.ticket);
      setAudit(data.audit ?? []);
      onUpdated(data.ticket);
      setShowForm(false);
      return data.ticket;
    } catch (err) {
      toast({
        title: L.ticket.couldNotUpdate,
        description: err instanceof Error ? err.message : L.common.pleaseTryAgain,
        variant: "destructive",
      });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const deleteTicket = async () => {
    if (!t) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/tickets/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted(t.id);
      setDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast({ title: L.ticket.couldNotDelete, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  /* --------------------------- voice resolution --------------------------- */

  const handleVoiceResolution = useCallback(
    async (text: string) => {
      if (!t) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const history = [...resolveMessagesRef.current, { role: "user" as const, content: trimmed }];
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "resolve",
            ticketId: t.id,
            messages: history,
            currentResolution: resolutionRef.current,
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          resolution?: ResolutionFields;
          ready?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Agent failed");
        const reply = data.reply || "";
        resolveMessagesRef.current = [...history, { role: "agent", content: reply }];
        if (data.resolution) {
          setResolution(data.resolution);
          resolutionRef.current = data.resolution;
        }
        setVoiceReplies((prev) => [...prev.slice(-2), reply]);
        setVoiceReady(Boolean(data.ready));
        if (reply) speech.speak(reply);
      } catch (err) {
        toast({
          title: L.ticket.voiceDocFail,
          description: err instanceof Error ? err.message : L.common.pleaseTryAgain,
          variant: "destructive",
        });
      }
    },
    [speech, t, toast, L]
  );

  const voice = useVoiceInput({
    lang: langCode,
    onFinalResult: handleVoiceResolution,
    onError: (message) =>
      toast({ title: L.agent.toastMicError, description: message, variant: "destructive" }),
  });

  /* ------------------------------ render ------------------------------ */

  if (!t) return null;

  const checklist = computeChecklist(t);
  const awaiting = t.status === "AWAITING_VERIFICATION";
  const resolved = t.status === "RESOLVED";
  const formOpen = showForm;
  const canStart = canWork && ["OPEN", "REOPENED"].includes(t.status);
  const canAccept = viewer.role === "TECHNICIAN" && !t.assignedTechnicianId;
  const canRecordResolution = canWork && ["OPEN", "IN_PROGRESS", "REOPENED"].includes(t.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] sm:max-w-2xl flex flex-col">
        {/* -------- header -------- */}
        <DialogHeader className="text-left shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-mono text-sm font-semibold text-muted-foreground">
              {t.ticketNumber}
            </DialogTitle>
            {t.source === "voice" && (
              <span className="inline-flex items-center gap-1 rounded border border-foreground/15 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                <Mic className="h-3 w-3" aria-hidden />
                {L.ticket.reportedByVoice}
              </span>
            )}
            {t.reopenCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-1.5 py-px text-[10px] font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                {fill(L.ticket.reopenedTimes, { count: t.reopenCount })}
              </span>
            )}
          </div>
          <DialogDescription className="text-base font-semibold text-foreground">
            {t.title}
          </DialogDescription>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <CategoryTag category={t.category} />
            <PriorityTag priority={t.priority} />
            <StatusTag status={t.status} />
          </div>
        </DialogHeader>

        {/* -------- body -------- */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 custom-scrollbar text-sm">
          {/* issue */}
          <div className="flex items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="leading-relaxed">{t.description}</p>
          </div>
          {t.urgencyReason && (
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <p className="text-amber-700 dark:text-amber-400">
                <span className="font-semibold">{L.ticket.whyItMatters}</span> {t.urgencyReason}
              </p>
            </div>
          )}
          {t.similarIncidentNote && (
            <div className="flex items-start gap-2.5">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{L.ticket.pattern}</span> {t.similarIncidentNote}
              </p>
            </div>
          )}

          {/* details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <Detail icon={MapPin} label={L.ticket.location} value={t.location} />
            <Detail icon={User} label={L.ticket.reporter} value={t.requesterName} />
            <Detail
              icon={Wrench}
              label={L.ticket.technician}
              value={t.assignedTechnicianName ?? L.ticket.notAssigned}
              muted={!t.assignedTechnicianName}
            />
            <Detail icon={CalendarClock} label={L.ticket.created} value={fmtDateTime(t.createdAt, langCode)} />
            <Detail icon={CalendarClock} label={L.ticket.lastUpdate} value={fmtDateTime(t.updatedAt, langCode)} />
            {t.contactInfo && <Detail icon={Mail} label={L.ticket.contact} value={t.contactInfo} />}
          </div>

          <Separator />

          {/* -------- resolution -------- */}
          {(t.technicianAction || t.resolutionNotes || t.testResult || t.evidence) && (
            <section aria-label={L.ticket.resolutionAria}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {L.ticket.resolution}
              </h3>
              <dl className="mt-2 space-y-2.5">
                {t.technicianAction && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{L.ticket.whatWasDone}</dt>
                    <dd className="mt-0.5">{t.technicianAction}</dd>
                  </div>
                )}
                {t.testResult && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{L.ticket.testResult}</dt>
                    <dd className="mt-0.5">{t.testResult}</dd>
                  </div>
                )}
                {t.resolutionNotes && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{L.ticket.notes}</dt>
                    <dd className="mt-0.5 text-muted-foreground">{t.resolutionNotes}</dd>
                  </div>
                )}
                {t.evidence && t.evidence.length > 0 && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{L.ticket.evidence}</dt>
                    <dd className="mt-1.5 space-y-1">
                      {t.evidence.map((e, i) => {
                        const meta = EVIDENCE_TYPES.find((x) => x.value === e.type);
                        const Icon = meta?.icon ?? Paperclip;
                        const body = (
                          <>
                            {e.fileId && isPreviewableImage(e.mimeType) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/evidence/${e.fileId}`}
                                alt=""
                                loading="lazy"
                                className="h-9 w-9 shrink-0 rounded border border-foreground/10 object-cover"
                              />
                            ) : (
                              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            )}
                            <span className="font-medium">{e.label}</span>
                            {e.fileName && (
                              <span className="truncate text-muted-foreground">— {e.fileName}</span>
                            )}
                            {e.note && <span className="text-muted-foreground">— {e.note}</span>}
                          </>
                        );
                        return e.fileId ? (
                          <a
                            key={i}
                            href={`/api/evidence/${e.fileId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded border border-foreground/10 bg-foreground/[0.02] px-2 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                            aria-label={fill(L.ticket.openEvidenceAria, { name: e.fileName || e.label })}
                          >
                            {body}
                          </a>
                        ) : (
                          <span
                            key={i}
                            className="flex items-center gap-1.5 rounded border border-foreground/10 bg-foreground/[0.02] px-2 py-1 text-xs"
                          >
                            {body}
                          </span>
                        );
                      })}
                    </dd>
                  </div>
                )}
              </dl>

              {/* -------- post-submit evidence add (assigned technician) --------
                  After "Submit for verification" the resolution form is closed,
                  but the technician can still attach evidence while the ticket
                  is awaiting the reporter's confirmation — saved immediately
                  via the add_evidence API action (real file upload supported). */}
              {canWork && t.status === "AWAITING_VERIFICATION" && (
                <div className="mt-3 rounded-md border border-dashed border-foreground/20 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {L.ticket.addEvidenceNow}
                  </p>
                  <EvidenceAdder
                    disabled={busy !== null}
                    onAdd={async (entry) => {
                      const saved = await act("add_evidence", { evidence: [entry] });
                      return Boolean(saved);
                    }}
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{L.ticket.evidenceImmediateHint}</p>
                </div>
              )}
            </section>
          )}

          {/* -------- verification panel -------- */}
          {(t.resolutionSubmittedAt || resolved) && (
            <section
              aria-label={L.ticket.verificationAria}
              className={cn(
                "rounded-lg border p-4",
                resolved
                  ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30"
                  : "border-foreground/15 bg-foreground/[0.02]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {resolved ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                  )}
                  {L.ticket.verification}
                </h3>
                <p
                  className={cn(
                    "text-xs font-semibold",
                    resolved ? "text-emerald-700 dark:text-emerald-400" : "text-violet-700 dark:text-violet-400"
                  )}
                >
                  {resolved
                    ? L.ticket.resolvedConfirmed
                    : L.ticket.awaitingReporter}
                </p>
              </div>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {(
                  [
                    [L.ticket.ckAction, checklist.actionRecorded],
                    [L.ticket.ckNotes, checklist.notesSubmitted],
                    [L.ticket.ckEvidence, checklist.evidenceSubmitted],
                    [L.ticket.ckTest, checklist.testPerformed],
                    [L.ticket.ckReporter, checklist.reporterConfirmed],
                  ] as const
                ).map(([label, done]) => (
                  <li key={label} className="flex items-center gap-2 text-xs">
                    <CheckState done={done} />
                    <span className={done ? "" : "text-muted-foreground"}>{label}</span>
                  </li>
                ))}
              </ul>
              {t.resolutionCheckNote && !resolved && (
                <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  {L.ticket.speakfixNote} {t.resolutionCheckNote}
                </p>
              )}
              {t.reporterResponse && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {L.ticket.reporterSaid} <span className="italic text-foreground/80">“{t.reporterResponse}”</span>
                </p>
              )}
            </section>
          )}

          {/* -------- resolution form (technician / admin) -------- */}
          {canWork && (formOpen || showForm) && !resolved && (
            <section aria-label={L.ticket.recordAria} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {L.ticket.recordResolution}
                </h3>
                <button
                  type="button"
                  onClick={() => setVoiceDoc((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    voiceDoc
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-foreground/15 text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={voiceDoc}
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden />
                  {voiceDoc ? L.ticket.voiceDocActive : L.ticket.voiceDoc}
                </button>
              </div>

              {voiceDoc && (
                <div className="mt-3 rounded-md border border-dashed p-3">
                  <div className="flex items-start gap-3">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (speech.speaking) speech.cancel();
                        if (voice.isListening) voice.stop();
                        else voice.start();
                      }}
                      disabled={voice.isTranscribing}
                      className={cn("gap-1.5", voice.isListening && "bg-rose-600 hover:bg-rose-500")}
                    >
                      <Mic className="h-4 w-4" aria-hidden />
                      {voice.isListening ? L.ticket.stop : L.ticket.speak}
                    </Button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {L.ticket.voiceHint}
                      </p>
                      {voice.interimTranscript && (
                        <p className="mt-1.5 text-xs italic text-muted-foreground/70">
                          {voice.interimTranscript}
                        </p>
                      )}
                      {voiceReplies.map((r, i) => (
                        <p key={i} className="mt-1.5 flex items-start gap-1.5 text-xs text-foreground/90">
                          <Volume2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
                          {r}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="res-action" className="text-xs">
                    {L.ticket.whatWasFixed} <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="res-action"
                    rows={2}
                    value={resolution.technicianAction}
                    onChange={(e) => setResolution((r) => ({ ...r, technicianAction: e.target.value }))}
                    placeholder={L.ticket.actionPh}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="res-test" className="text-xs">
                    {L.ticket.testResult}
                  </Label>
                  <Input
                    id="res-test"
                    value={resolution.testResult}
                    onChange={(e) => setResolution((r) => ({ ...r, testResult: e.target.value }))}
                    placeholder={L.ticket.testPh}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="res-notes" className="text-xs">
                    {L.ticket.notes}
                  </Label>
                  <Input
                    id="res-notes"
                    value={resolution.resolutionNotes}
                    onChange={(e) => setResolution((r) => ({ ...r, resolutionNotes: e.target.value }))}
                    placeholder={L.ticket.notesPh}
                    className="mt-1 text-sm"
                  />
                </div>

                {/* evidence */}
                <div>
                  <Label className="text-xs">
                    {evidenceDrafts.length > 0
                      ? fill(L.ticket.evidenceCount, { count: evidenceDrafts.length })
                      : L.ticket.evidence}
                  </Label>
                  {evidenceDrafts.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {evidenceDrafts.map((e, i) => {
                        const meta = EVIDENCE_TYPES.find((x) => x.value === e.type);
                        const Icon = meta?.icon ?? Paperclip;
                        const body = (
                          <>
                            {e.fileId && isPreviewableImage(e.mimeType) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/evidence/${e.fileId}`}
                                alt=""
                                loading="lazy"
                                className="h-9 w-9 shrink-0 rounded border border-foreground/10 object-cover"
                              />
                            ) : (
                              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            )}
                            <span className="font-medium">{e.label}</span>
                            {e.fileName && (
                              <span className="truncate text-muted-foreground">— {e.fileName}</span>
                            )}
                          </>
                        );
                        return (
                          <li
                            key={i}
                            className="flex items-center gap-1.5 rounded border border-foreground/10 px-2 py-1 text-xs animate-in fade-in slide-in-from-top-1 duration-300"
                          >
                            {e.fileId ? (
                              <a
                                href={`/api/evidence/${e.fileId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-w-0 flex-1 items-center gap-1.5 hover:text-primary"
                                aria-label={fill(L.ticket.openEvidenceAria, { name: e.fileName || e.label })}
                              >
                                {body}
                              </a>
                            ) : (
                              <span className="flex min-w-0 flex-1 items-center gap-1.5">{body}</span>
                            )}
                            <button
                              type="button"
                              className="ml-auto text-muted-foreground hover:text-rose-600 cursor-pointer"
                              onClick={() => setEvidenceDrafts((prev) => prev.filter((_, j) => j !== i))}
                              aria-label={fill(L.ticket.removeEvidenceAria, { label: e.label })}
                            >
                              <Trash2 className="h-3 w-3" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <EvidenceAdder
                    disabled={busy === "submit_resolution"}
                    onAdd={async (entry) => {
                      setEvidenceDrafts((prev) => [...prev, entry]);
                      return true;
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={!resolution.technicianAction.trim() || busy === "submit_resolution"}
                    onClick={() =>
                      void act("submit_resolution", {
                        ...resolution,
                        evidence: evidenceDrafts,
                      })
                    }
                  >
                    {busy === "submit_resolution" ? L.ticket.submitting : L.ticket.submitForVerification}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    {L.ticket.submitHint}
                  </p>
                </div>
              </div>
            </section>
          )}

          <Separator />

          {/* -------- audit timeline -------- */}
          <section aria-label={L.ticket.auditAria}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {L.ticket.history}
            </h3>
            {audit.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {auditLoaded ? L.ticket.noActions : L.ticket.loadingHistory}
              </p>
            ) : (
              <ol className="mt-3 space-y-0">
                {audit.map((entry, i) => {
                  const Icon = AUDIT_ICONS[entry.action] ?? Pencil;
                  const isLast = i === audit.length - 1;
                  return (
                    <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {!isLast && (
                        <span
                          aria-hidden
                          className="absolute left-[9px] top-5 h-full w-px bg-foreground/10"
                        />
                      )}
                      <span className="relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border bg-card">
                        <Icon className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug">
                          <span className="font-semibold">
                            {localizedAuditAction(entry.action, L)}
                          </span>
                          {entry.detail && (
                            <span className="text-muted-foreground"> — {entry.detail}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70 tabular-nums">
                          {fmtDateTime(entry.createdAt, langCode)} · {entry.actorName}
                          {entry.actorRole === "SYSTEM"
                            ? ` ${L.ticket.systemTag}`
                            : ` (${(L.roles[entry.actorRole as keyof typeof L.roles] ?? entry.actorRole).toLowerCase()})`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {t.transcript && (
            <details className="rounded-md border bg-muted/30">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">
                {L.ticket.transcript}
              </summary>
              <div className="max-h-40 overflow-y-auto px-3 pb-3 custom-scrollbar">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {t.transcript}
                </p>
              </div>
            </details>
          )}
        </div>

        {/* -------- footer actions -------- */}
        <DialogFooter className="flex-col gap-3 sm:flex-col shrink-0">
 {/* Reporter verification actions */}
          {viewerIsReporter && awaiting && (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500"
                disabled={busy !== null}
                onClick={() => void act("reporter_confirm", { response: "Confirmed working from ticket view" })}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {busy === "reporter_confirm" ? L.ticket.confirming : L.ticket.confirmRepair}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50"
                disabled={busy !== null}
                onClick={() => void act("reporter_reopen", { response: "Still broken — reported from ticket view" })}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                {busy === "reporter_reopen" ? L.ticket.reopening : L.ticket.stillBroken}
              </Button>
            </div>
          )}

          {/* Staff workflow actions */}
          {isStaff && !resolved && (
            <div className="flex w-full flex-wrap items-center gap-2">
              {canAccept && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void act("assign", {})}
                  className="gap-1.5"
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  {L.ticket.acceptJob}
                </Button>
              )}
              {canStart && (
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void act("start_work")}
                  className="gap-1.5"
                >
                  <Wrench className="h-4 w-4" aria-hidden />
                  {busy === "start_work" ? L.ticket.starting : L.ticket.startWork}
                </Button>
              )}
              {canWork && canRecordResolution && !showForm && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowForm(true)}
                  className="gap-1.5"
                >
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                  {t.technicianAction ? L.ticket.updateResolution : L.ticket.recordResolution}
                </Button>
              )}
              {/* Admin assignment — the admin's main action: select a
                  technician, then press Assign. Nothing happens on selection
                  alone, so an accidental tap can't reassign a job. */}
              {viewer.role === "ADMIN" && techs.length > 0 && !resolved && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={assignTechId}
                    onValueChange={setAssignTechId}
                    disabled={busy !== null}
                  >
                    <SelectTrigger
                      className="h-8 w-[210px] text-xs"
                      aria-label={t.assignedTechnicianName ? L.ticket.reassignAria : L.ticket.assignAria}
                    >
                      <SelectValue
                        placeholder={
                          t.assignedTechnicianName
                            ? fill(L.ticket.reassignPh, { name: t.assignedTechnicianName })
                            : L.ticket.assignPh
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {techs.map((tech) => (
                        <SelectItem
                          key={tech.id}
                          value={tech.id}
                          disabled={tech.id === t.assignedTechnicianId}
                        >
                          {tech.name}
                          {tech.id === t.assignedTechnicianId ? L.ticket.currentTech : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!assignTechId || busy !== null}
                    onClick={async () => {
                      if (!assignTechId) return;
                      const saved = await act("assign", { technicianId: assignTechId });
                      if (saved) setAssignTechId("");
                    }}
                  >
                    <UserPlus className="h-4 w-4" aria-hidden />
                    {busy === "assign" ? L.ticket.assigning : L.ticket.assignAction}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Delete (reporter of this ticket, or admin) */}
          {(viewerIsReporter || viewer.role === "ADMIN") && (
            <div className="flex w-full justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteOpen(true)}
                className="gap-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {L.common.delete}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fill(L.ticket.deleteTitle, { number: t.ticketNumber })}</AlertDialogTitle>
            <AlertDialogDescription>
              {L.ticket.deleteDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void deleteTicket()}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {L.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</p>
        <p className={cn("truncate text-xs font-medium", muted && "text-muted-foreground")}>{value}</p>
      </div>
    </div>
  );
}

/* ------------------------- evidence file helpers ------------------------- */

/** Mime types a browser can reliably display as an <img> (HEIC can't). */
function isPreviewableImage(mimeType?: string) {
  return Boolean(
    mimeType && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)
  );
}

/** Shrink big photos in the browser before upload — mobile cameras produce
 *  3–5 MB files; a 1600 px JPEG at quality 0.82 is plenty for evidence and
 *  uploads far faster (and keeps the DB small). Non-JPEG/PNG/WebP files and
 *  already-small files pass through untouched. */
async function compressImage(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  if (file.size <= 300 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "evidence";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // never block the upload on compression problems
  }
}

function fmtSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // mirrors the server cap

/**
 * Evidence adder — one control row used BOTH inside the resolution form
 * (evidence drafts) and after submission (immediate add_evidence).
 *
 * Photo / part / voice evidence can carry a real file: "Add" opens the
 * device file picker when nothing is selected yet (that's what pressing Add
 * on a photo should do), uploads the file, and attaches it to the ticket.
 * Checklist / note evidence stays text-only. A typed label alone always
 * works too, for every type.
 */
function EvidenceAdder({
  disabled = false,
  onAdd,
}: {
  disabled?: boolean;
  /** Attach one evidence entry; return true when it was accepted so the
 *   adder can clear its inputs. */
  onAdd: (entry: EvidenceEntry) => Promise<boolean> | boolean;
}) {
  const { t: L } = useT();
  const { toast } = useToast();
  const [type, setType] = useState<EvidenceEntry["type"]>("photo");
  const [label, setLabel] = useState("");
  const [error, setError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busyAdd, setBusyAdd] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const fileAccept =
    type === "photo" || type === "part" ? "image/*,.pdf" : type === "voice" ? "audio/*" : null;
  const supportsFile = fileAccept !== null;

  // A different type may not accept the picked file — start clean.
  useEffect(() => {
    setFile(null);
    setPreviewUrl(null);
  }, [type]);

  // Free the preview object URL when it is replaced / on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      toast({ title: L.ticket.evidenceUploadFail, description: L.ticket.fileTooBig, variant: "destructive" });
      return;
    }
    setFile(f);
    setError(false);
    if (isPreviewableImage(f.type)) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
    // Label defaults to the file name (editable before adding)
    if (!label.trim()) {
      setLabel(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 80));
    }
  }

  async function handleAdd() {
    if (busyAdd || disabled) return;
    const trimmed = label.trim();
    if (file) {
      setBusyAdd(true);
      try {
        const upload = await compressImage(file);
        const fd = new FormData();
        fd.append("file", upload, file.name);
        fd.append("type", type);
        const res = await fetch("/api/evidence", { method: "POST", body: fd });
        const data = (await res.json()) as {
          id?: string;
          fileName?: string;
          mimeType?: string;
          error?: string;
        };
        if (!res.ok || !data.id) throw new Error(data.error || "Upload failed");
        const ok = await onAdd({
          type,
          label: trimmed || data.fileName || "Evidence",
          fileId: data.id,
          fileName: data.fileName,
          mimeType: data.mimeType,
        });
        if (ok) {
          setLabel("");
          setFile(null);
          setPreviewUrl(null);
          setError(false);
          labelRef.current?.focus();
        }
      } catch (err) {
        toast({
          title: L.ticket.evidenceUploadFail,
          description: err instanceof Error ? err.message : L.common.pleaseTryAgain,
          variant: "destructive",
        });
      } finally {
        setBusyAdd(false);
      }
      return;
    }
    if (trimmed) {
      const ok = await onAdd({ type, label: trimmed });
      if (ok) {
        setLabel("");
        setError(false);
      }
      labelRef.current?.focus();
      return;
    }
    if (supportsFile) {
      // Nothing typed and no file picked — pressing Add on e.g. a photo
      // should let the technician upload one: open the file picker.
      inputRef.current?.click();
      return;
    }
    setError(true);
    labelRef.current?.focus();
  }

  const FileIcon = type === "voice" ? AudioLines : FileText;

  return (
    <div className="mt-1.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={type} onValueChange={(v) => setType(v as EvidenceEntry["type"])}>
          <SelectTrigger className="w-full text-xs sm:w-[170px]" aria-label={L.ticket.evidenceTypeAria}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVIDENCE_TYPES.map((x) => (
              <SelectItem key={x.value} value={x.value}>
                {localizedEvidenceType(x.value, L)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex min-w-0 flex-1 gap-2">
          <Input
            ref={labelRef}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (error) setError(false);
            }}
            placeholder={supportsFile ? L.ticket.evidenceFilePh : L.ticket.evidencePh}
            aria-invalid={error || undefined}
            className="min-w-0 flex-1 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          {supportsFile && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busyAdd}
              className="shrink-0 gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {L.ticket.chooseFile}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={file ? "default" : "outline"}
            onClick={() => void handleAdd()}
            disabled={disabled || busyAdd}
            className="shrink-0"
          >
            {busyAdd ? L.ticket.addingEvidence : L.common.add}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={fileAccept ?? undefined}
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
        </div>
      </div>

      {/* picked-file preview chip */}
      {file && (
        <div className="mt-1.5 flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs animate-in fade-in slide-in-from-top-1 duration-300">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded border border-foreground/10 object-cover"
            />
          ) : (
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
          <span className="shrink-0 text-muted-foreground">{fmtSize(file.size)}</span>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-rose-600 cursor-pointer"
            onClick={() => {
              setFile(null);
              setPreviewUrl(null);
            }}
            aria-label={L.ticket.removeEvidenceAria.replace(/\{label\}/g, file.name)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-1 text-[11px] font-medium text-rose-600" role="alert">
          {L.ticket.evidenceNeedLabel}
        </p>
      )}
      {supportsFile && !file && !error && (
        <p className="mt-1 text-[11px] text-muted-foreground">{L.ticket.evidenceFileHint}</p>
      )}
    </div>
  );
}

function CheckState({ done }: { done: boolean }) {
  const { t } = useT();
  return done ? (
    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={t.ticket.doneSr} />
  ) : (
    <span
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/30"
      aria-label={t.ticket.pendingSr}
    >
      <span className="sr-only">{t.ticket.pendingSr}</span>
    </span>
  );
}
