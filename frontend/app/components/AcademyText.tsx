"use client";
import Link from "next/link";
import { Fragment, useContext } from "react";
import { ACADEMY, ACADEMY_GLOSSARY } from "../lib/academy";
import { AcademyNavigationContext } from "./AcademyNavigationContext";
const aliases = new Map<
  string,
  { alias: string; article: { slug: string; definition: string } }
>();
for (const article of ACADEMY) {
  for (const alias of article.aliases) {
    aliases.set(alias.toLowerCase(), { alias, article });
  }
}
// The existing glossary owns its stable IDs and English community names.
for (const term of ACADEMY_GLOSSARY) {
  for (const alias of [term.term, ...term.aliases]) {
    aliases.set(alias.toLowerCase(), {
      alias,
      article: { slug: term.id, definition: term.definition },
    });
  }
}
const terms = [...aliases.values()].sort((a, b) =>
  b.alias.length - a.alias.length
);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${
    terms.map((term) => escape(term.alias)).join("|")
  })(?![\\p{L}\\p{N}_])`,
  "giu",
);
export function AcademyText({ text }: { text: string }) {
  const onNavigate = useContext(AcademyNavigationContext);
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
        const entry = terms.find((term) =>
          term.alias.toLocaleLowerCase("es") === part.toLocaleLowerCase("es")
        );
        return entry
          ? (
            <Link
              key={index}
              className="academy-term"
              href={`/dashboard/academia/${entry.article.slug}`}
              title={`${entry.article.definition} · Abrir Academia`}
              onClick={onNavigate ?? undefined}
            >
              {part}
            </Link>
          )
          : <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
