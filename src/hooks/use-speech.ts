"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Text-to-speech output for the agent's replies (browser speechSynthesis),
 * with barge-in support (cancel when the user starts talking).
 *
 * `lang` is a BCP-47 code (e.g. "af-ZA", "fr-FR") from the user's preferred
 * language. A matching voice is picked automatically. English ALWAYS uses
 * Iris's original US-English voice (unchanged from day one), and languages
 * with no system voice fall back to the best English voice available.
 */
export function useSpeech({ lang = "en-ZA" }: { lang?: string } = {}) {
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const enabledRef = useRef(true);
  const langRef = useRef(lang);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoicesReady(true);
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const normalize = (l: string) => l.toLowerCase().replace("_", "-");
    const code = normalize(langRef.current); // e.g. "af-za"
    const base = code.split("-")[0];

    // English keeps Iris's ORIGINAL voice from day one: a US-English natural
    // voice (Google US English / Samantha / Aria…). English recognition still
    // uses en-ZA — only the spoken voice keeps its familiar accent. Without
    // this branch an en-ZA or UK voice would hijack the pick on many systems.
    if (base === "en") {
      return (
        voices.find((v) => /en[-_]US/i.test(v.lang) && /natural|google|samantha/i.test(v.name)) ||
        voices.find((v) => /en[-_]US/i.test(v.lang)) ||
        voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
        voices[0]
      );
    }

    // 1. Exact regional match (af-ZA, fr-FR, …)
    const exact = voices.find((v) => normalize(v.lang) === code);
    if (exact) return exact;

    // 2. Any voice of the same base language, preferring natural/neural ones.
    //    Sorted by name first: getVoices() order is arbitrary across systems
    //    and sessions, so a stable order keeps Iris sounding consistent.
    const sameLang = voices
      .filter((v) => normalize(v.lang) === base || normalize(v.lang).startsWith(base + "-"))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (sameLang.length) {
      return (
        sameLang.find((v) => /natural|neural|google|premium|enhanced/i.test(v.name)) ||
        sameLang[0]
      );
    }

    // 3. Best English fallback (the agent still speaks, with an accent)
    return (
      voices.find((v) => /en[-_]US/i.test(v.lang) && /natural|google|samantha/i.test(v.name)) ||
      voices.find((v) => /en[-_]US/i.test(v.lang)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
      voices[0]
    );
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (!enabledRef.current || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        text.replace(/\s+/g, " ").trim().slice(0, 600)
      );
      const voice = pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = langRef.current;
      }
      utterance.rate = 1.02;
      utterance.pitch = 1.0;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [pickVoice]
  );

  return { enabled, setEnabled, speaking, speak, cancel, voicesReady };
}
