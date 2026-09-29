"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { getStrings, languageCode } from "./index";

/**
 * Provides the user's preferred language to every component in the app shell.
 * Value is the account's preferredLanguage (e.g. "isiZulu") — components
 * read translated strings + the BCP-47 speech code through useT().
 */
const LanguageContext = createContext<string>("English");

export function LanguageProvider({
  language,
  children,
}: {
  language: string;
  children: ReactNode;
}) {
  useEffect(() => {
    // Keep the document language in sync for screen readers and the browser.
    document.documentElement.lang = languageCode(language);
  }, [language]);

  return (
    <LanguageContext.Provider value={language || "English"}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const lang = useContext(LanguageContext);
  return { t: getStrings(lang), lang, langCode: languageCode(lang) };
}
