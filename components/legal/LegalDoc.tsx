"use client";

import { useState } from "react";
import Link from "next/link";

// Bilingual wrapper for the legal pages. German is the default and the
// authoritative version: the Impressum obligation arises from German law
// (§ 5 DDG), so the German text is the one that has to be correct.
//
// Both language bodies are passed in as props from the server component and
// rendered inside a `lang` boundary, so screen readers and translation tools
// announce each in the right language.
export function LegalDoc({
  titleDe,
  titleEn,
  de,
  en,
  updated,
}: {
  titleDe: string;
  titleEn: string;
  de: React.ReactNode;
  en: React.ReactNode;
  updated: string;
}) {
  const [lang, setLang] = useState<"de" | "en">("de");

  const tab = (value: "de" | "en") =>
    `rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition ${
      lang === value
        ? "bg-coral text-white"
        : "border border-line bg-card text-teal-800 hover:border-coral"
    }`;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm font-semibold text-teal-600 hover:text-coral"
        >
          ← Regulatory Sidekick
        </Link>
        <div
          className="flex gap-2"
          role="group"
          aria-label="Sprache / Language"
        >
          <button
            type="button"
            onClick={() => setLang("de")}
            className={tab("de")}
            aria-pressed={lang === "de"}
          >
            Deutsch
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={tab("en")}
            aria-pressed={lang === "en"}
          >
            English
          </button>
        </div>
      </div>

      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        {lang === "de" ? titleDe : titleEn}
      </h1>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {lang === "de" ? "Stand" : "Last updated"}: {updated}
      </p>

      <div className="legal mt-4">
        {lang === "de" ? (
          <div lang="de">{de}</div>
        ) : (
          <div lang="en">{en}</div>
        )}
      </div>

      {lang === "en" && (
        <p className="mt-10 border-t border-line pt-5 text-xs leading-relaxed text-muted">
          This English text is a convenience translation. The German version is
          the legally binding one.
        </p>
      )}
    </main>
  );
}
