import type { Strings } from "./en";

/**
 * Languages a user can pick — values stored in the User.preferredLanguage column.
 *
 * Kept only where the FULL pipeline works: the UI is fully translated, the
 * assistant (GLM) converses accurately, and mainstream browsers ship a
 * matching speech-synthesis voice (en/af/fr/pt/sw).
 *
 * The other South African languages (isiZulu, isiXhosa, Xitsonga, Sesotho,
 * Setswana, Sepedi, siSwati, Tshivenda, isiNdebele) are NOT selectable yet:
 * the model garbles them and no browser voice exists. Iris LEARNS them
 * instead — users teach her phrases during free-talk, stored in the
 * LearnedPhrase table and injected into her prompts over time.
 */
export const SUPPORTED_LANGUAGES = [
  "English",
  "Afrikaans",
  "French",
  "Portuguese",
  "Swahili",
] as const;

/** BCP-47 codes used for speech synthesis, speech recognition and date formatting. */
export const LANGUAGE_CODES: Record<string, string> = {
  English: "en-ZA",
  Afrikaans: "af-ZA",
  French: "fr-FR",
  Portuguese: "pt-PT",
  Swahili: "sw-KE",
};

/** How each language calls itself — shown in the language pickers. */
export const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  English: "English",
  Afrikaans: "Afrikaans",
  French: "Français",
  Portuguese: "Português",
  Swahili: "Kiswahili",
};

/* Individual dictionaries (typed against the English master). */
import { en } from "./en";
import { af } from "./af";
import { fr } from "./fr";
import { pt } from "./pt";
import { sw } from "./sw";

export const TRANSLATIONS: Record<string, Strings> = {
  English: en,
  Afrikaans: af,
  French: fr,
  Portuguese: pt,
  Swahili: sw,
};

/** Strings for a preferred language, falling back to English. */
export function getStrings(lang: string | null | undefined): Strings {
  return (lang && TRANSLATIONS[lang]) || en;
}

/** BCP-47 speech/locale code for a preferred language. */
export function languageCode(lang: string | null | undefined): string {
  return (lang && LANGUAGE_CODES[lang]) || "en-ZA";
}

/** Fill {placeholder} tokens in a translated template. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in vars ? String(vars[key]) : m
  );
}

/* ------- display helpers for system values (values stay English in the DB) ------- */

export function localizedStatus(status: string, t: Strings): string {
  return t.statuses[status as keyof Strings["statuses"]] ?? status.replaceAll("_", " ").toLowerCase();
}

export function localizedPriority(priority: string, t: Strings): string {
  return t.priorities[priority as keyof Strings["priorities"]] ?? priority.toLowerCase();
}

export function localizedCategory(category: string, t: Strings): string {
  return t.categories[category as keyof Strings["categories"]] ?? category;
}

export function localizedAuditAction(action: string, t: Strings): string {
  return t.audit[action as keyof Strings["audit"]] ?? action.replaceAll("_", " ").toLowerCase();
}

export function localizedEvidenceType(type: string, t: Strings): string {
  return t.evidenceTypes[type as keyof Strings["evidenceTypes"]] ?? type;
}
