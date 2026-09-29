"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, LockKeyhole, Mail, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { NATIVE_LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useT } from "@/lib/i18n/context";
import type { AppUser } from "@/components/app/app-shell";

export function ProfileView({
  user,
  onUserUpdated,
}: {
  user: AppUser;
  onUserUpdated: (u: AppUser) => void;
}) {
  const { toast } = useToast();
  const { t } = useT();

  // Stored value the UI can actually show — accounts created before a
  // language was retired fall back to English (their stored value is
  // upgraded to the shown one the next time they save).
  const effectiveStoredLanguage =
    (SUPPORTED_LANGUAGES as readonly string[]).includes(user.preferredLanguage)
      ? user.preferredLanguage
      : "English";

  // profile form
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [language, setLanguage] = useState(effectiveStoredLanguage);
  const [savingProfile, setSavingProfile] = useState(false);

  // password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setLanguage(effectiveStoredLanguage);
  }, [user.id, user.name, user.email, effectiveStoredLanguage]);

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const profileDirty =
    name.trim() !== user.name ||
    email.trim().toLowerCase() !== user.email ||
    language !== effectiveStoredLanguage;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          preferredLanguage: language,
        }),
      });
      const data = (await res.json()) as { user?: AppUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error || t.profile.couldNotSave);
      onUserUpdated(data.user);
      toast({
        title: t.profile.toastSaved,
        description: t.profile.toastSavedDesc,
      });
    } catch (err) {
      toast({
        title: t.profile.toastSaveFail,
        description: err instanceof Error ? err.message : t.common.pleaseTryAgain,
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not change your password.");
      setCurrentPassword("");
      setNewPassword("");
      toast({
        title: t.profile.toastPwUpdated,
        description: t.profile.toastPwDesc,
      });
    } catch (err) {
      toast({
        title: t.profile.toastPwFail,
        description: err instanceof Error ? err.message : t.common.pleaseTryAgain,
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* ------------------------------ summary ------------------------------ */}
      <section className="rounded-lg border bg-card p-5" aria-label={t.profile.summaryAria}>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials || "U"}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold tracking-tight">
              {user.name}
            </h3>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              <span className="font-medium text-foreground">
                {t.roles[user.role as keyof typeof t.roles] ?? user.role}
              </span>{" "}
              {t.profile.accountWord}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------- edit details ---------------------------- */}
      <section className="rounded-lg border bg-card p-5" aria-label={t.profile.editAria}>
        <h3 className="font-display text-base font-semibold tracking-tight">{t.profile.details}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t.profile.detailsSub}
        </p>

        <form onSubmit={saveProfile} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs">
              <User className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {t.profile.fullName}
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email" className="text-xs">
              <Mail className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {t.profile.email}
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t.profile.preferredLanguage}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="text-sm" aria-label={t.profile.preferredLanguage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {NATIVE_LANGUAGE_NAMES[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={savingProfile || !profileDirty}
            className="gap-1.5"
            size="sm"
          >
            {savingProfile ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {savingProfile ? t.profile.saving : t.profile.save}
          </Button>
        </form>
      </section>

      {/* --------------------------- change password --------------------------- */}
      <section className="rounded-lg border bg-card p-5" aria-label={t.profile.pwAria}>
        <h3 className="font-display text-base font-semibold tracking-tight">{t.profile.password}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t.profile.passwordSub}
        </p>

        <form onSubmit={changePassword} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pw-current" className="text-xs">
              <LockKeyhole className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {t.profile.currentPassword}
            </Label>
            <Input
              id="pw-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new" className="text-xs">
              <LockKeyhole className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {t.profile.newPassword}
              <span className="ml-1 font-normal text-muted-foreground">{t.profile.passwordMin}</span>
            </Label>
            <Input
              id="pw-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={savingPassword || !currentPassword || !newPassword}
            variant="outline"
            className="gap-1.5"
            size="sm"
          >
            {savingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {savingPassword ? t.profile.updating : t.profile.updatePassword}
          </Button>
        </form>
      </section>
    </div>
  );
}
