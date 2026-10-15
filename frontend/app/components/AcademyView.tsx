"use client";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import {
  ACADEMY,
  ACADEMY_GLOSSARY,
  type AcademyArticle,
  type AcademyResource,
  GLOSSARY_CATEGORIES,
  relatedLessons,
} from "../lib/academy";
import type { AcademyTerm } from "../lib/academyTerms";
import { academyVideo } from "../lib/academyVideo";
import { AcademyPostView } from "./AcademyPostView";
import { type AcademyPostBlock, articlePost } from "../lib/academyPosts";
import { ScrollRevealRoot } from "./ScrollRevealRoot";

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const topicTone = (topic: string) =>
  ({
    "Mecánicas": "mechanics",
    "Línea": "lane",
    "Jungla y mapa": "map",
    "Fases": "phases",
    "Preparación": "preparation",
  })[topic] ?? "map";
function ReadingIcon(
  { kind = "book" }: { kind?: "book" | "clock" | "play" | "search" | "arrow" },
) {
  const paths = {
    book: (
      <>
        <path d="M12 5v15M3 4.5c4-1 6-.5 9 1.5 3-2 5-2.5 9-1.5V19c-4-1-6-.5-9 1.5C9 18.5 7 18 3 19Z" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    play: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m10 9 5 3-5 3Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}
function videoCount(resources: AcademyResource[]) {
  return new Set(resources.flatMap((resource) => {
    const video = resource.kind === "video" ? academyVideo(resource.url) : null;
    return video ? [video.id] : [];
  })).size;
}
function readingMinutes(text: string) {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 180));
}
function articleMinutes(article: AcademyArticle) {
  return readingMinutes(
    [
      article.definition,
      article.when,
      ...article.steps,
      ...article.pitfalls,
      article.exercise,
      article.check,
    ].join(" "),
  );
}
function TopicBadge({ children }: { children: ReactNode }) {
  return <span className="academy-topic-badge">{children}</span>;
}

export function AcademyView() {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("Todas");
  const topics = [...new Set(ACADEMY.map((article) => article.category))];
  const articles = ACADEMY.filter((article) =>
    (category === "Todas" || article.category === category) &&
    normalize([article.title, article.definition, ...article.aliases].join(" "))
      .includes(normalize(search.trim()))
  );
  const glossary = ACADEMY_GLOSSARY.filter((term) =>
    normalize([term.term, term.definition, ...term.aliases].join(" ")).includes(
      normalize(search.trim()),
    )
  );
  return (
    <ScrollRevealRoot className="screen-stack motion-page academy-page academy-forum">
      <header className="academy-community-header" data-reveal="up">
        <div className="academy-community-mark">
          <ReadingIcon />
        </div>
        <div>
          <span className="academy-overline">
            APRENDE · PRACTICA · VUELVE A LA GRIETA
          </span>
          <h1>Academia de la Grieta</h1>
          <p>
            Guías para entender tus jugadas y llevar el siguiente consejo a la
            partida.
          </p>
          <div className="academy-community-stats">
            <span>{ACADEMY.length} guías prácticas</span>
            <span>{ACADEMY_GLOSSARY.length} conceptos</span>
            <span>
              {videoCount(ACADEMY.flatMap((article) => article.resources))}{" "}
              videos
            </span>
          </div>
        </div>
        <Link className="academy-primary-link" href="/dashboard/entrenamiento">
          Mi entrenamiento <ReadingIcon kind="arrow" />
        </Link>
      </header>
      <div className="academy-forum-layout">
        <div className="academy-feed">
          <section
            className="academy-feed-controls"
            aria-label="Buscar publicaciones"
            data-reveal="up"
          >
            <label className="academy-search">
              <span className="sr-only">Buscar publicación o concepto</span>
              <ReadingIcon kind="search" />
              <input
                type="search"
                placeholder="Buscar una guía, técnica o concepto…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="academy-topic-select">
              <span className="sr-only">Filtrar guías por tema</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {["Todas", ...topics].map((topic) => (
                  <option key={topic} value={topic}>
                    {topic === "Todas" ? "Todos los temas" : topic}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <div className="academy-feed-heading">
            <h2>Guías y publicaciones</h2>
            <span role="status">
              {articles.length}{" "}
              {articles.length === 1 ? "resultado" : "resultados"}
            </span>
          </div>
          <div className="academy-feed-list">
            {articles.map((article) => {
              const video = article.resources.map((resource) =>
                academyVideo(resource.url)
              ).find(Boolean);
              const count = videoCount(article.resources);
              return (
                <article
                  key={article.slug}
                  className={`academy-feed-post${video ? " has-preview" : ""}`}
                  data-tone={topicTone(article.category)}
                  data-reveal="up"
                >
                  <div className="academy-feed-copy">
                    <div className="academy-post-byline">
                      <span
                        className="academy-editor-avatar"
                        aria-hidden="true"
                      >
                        <ReadingIcon />
                      </span>
                      <span>Academia de la Grieta</span>
                      <span className="academy-byline-divider">·</span>
                      <span>Publicación</span>
                    </div>
                    <div className="academy-feed-title">
                      <TopicBadge>{article.category}</TopicBadge>
                      <h3>
                        <Link
                          href={`/dashboard/academia/${article.slug}`}
                          className="academy-feed-post-link"
                        >
                          {article.title}
                        </Link>
                      </h3>
                    </div>
                    <p>{article.definition}</p>
                    <footer>
                      <span>
                        <ReadingIcon kind="clock" />
                        {articleMinutes(article)} min de lectura
                      </span>
                      <span>
                        <ReadingIcon kind="play" />
                        {count} {count === 1 ? "video" : "videos"}
                      </span>
                      <span className="academy-read-link">
                        Leer guía <ReadingIcon kind="arrow" />
                      </span>
                    </footer>
                  </div>
                  {video && (
                    <div className="academy-feed-thumbnail">
                      <Image
                        unoptimized
                        fill
                        sizes="(max-width: 600px) 35vw, 180px"
                        src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                        alt=""
                      />
                      <span>
                        <ReadingIcon kind="play" />Guía con video
                      </span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!articles.length && (
            <div className="academy-empty" role="status">
              <ReadingIcon kind="search" />
              <h3>No encontramos una guía con esa búsqueda</h3>
              <p>Prueba otro término o consulta el glosario de abajo.</p>
              <button
                type="button"
                className="rune-link"
                onClick={() => {
                  setSearch("");
                  setCategory("Todas");
                }}
              >
                Restablecer búsqueda →
              </button>
            </div>
          )}
          <section
            className="academy-glossary-panel"
            id="glosario"
            data-reveal="up"
          >
            <header>
              <div>
                <span className="academy-overline">
                  EL VOCABULARIO DE LA GRIETA
                </span>
                <h2>Glosario de la comunidad</h2>
                <p>
                  El término en inglés y sus alias en español y spanglish, en un
                  mismo lugar.
                </p>
              </div>
              <span className="academy-count-pill">
                {glossary.length} conceptos
              </span>
            </header>
            <div className="academy-glossary-list">
              {glossary.map((term) => (
                <Link key={term.id} href={`/dashboard/academia/${term.id}`}>
                  <span>
                    <strong>{term.term}</strong>
                    <small>{GLOSSARY_CATEGORIES[term.category]}</small>
                  </span>
                  <p>{term.definition}</p>
                  <ReadingIcon kind="arrow" />
                </Link>
              ))}
            </div>
            {!glossary.length && (
              <p className="academy-empty" role="status">
                No hay conceptos para esta búsqueda.
              </p>
            )}
          </section>
        </div>
        <aside className="academy-feed-sidebar">
          <section className="academy-side-panel">
            <span className="academy-overline">EXPLORA LA ACADEMIA</span>
            <h2>Encuentra tu tema</h2>
            <nav aria-label="Temas de las publicaciones">
              {["Todas", ...topics].map((topic) => (
                <button
                  type="button"
                  key={topic}
                  aria-pressed={category === topic}
                  onClick={() => setCategory(topic)}
                >
                  <span>{topic === "Todas" ? "Todas las guías" : topic}</span>
                  <span>
                    {topic === "Todas"
                      ? ACADEMY.length
                      : ACADEMY.filter((article) => article.category === topic)
                        .length}
                  </span>
                </button>
              ))}
            </nav>
          </section>
          <section className="academy-side-panel academy-side-practice">
            <ReadingIcon />
            <h2>Del consejo a la práctica</h2>
            <p>
              Elige un concepto, prueba un ejercicio y revisa cómo lo aplicaste
              en tu próxima partida.
            </p>
            <Link href="/dashboard/entrenamiento" className="rune-link">
              Ir a mi entrenamiento →
            </Link>
          </section>
          <a href="#glosario" className="academy-side-glossary">
            <span>¿Una palabra nueva?</span>
            <strong>
              Consulta el glosario <ReadingIcon kind="arrow" />
            </strong>
            <small>{ACADEMY_GLOSSARY.length} términos y sus alias</small>
          </a>
        </aside>
      </div>
    </ScrollRevealRoot>
  );
}

export function AcademyArticleView({ article }: { article: AcademyArticle }) {
  const related = ACADEMY.filter((item) => article.related.includes(item.slug));
  return <AcademyPostView post={articlePost(article, related)} />;
}

export function AcademyGlossaryView({ term }: { term: AcademyTerm }) {
  const lessons = relatedLessons(term.category);
  const seen = new Set<string>();
  const resources = lessons.flatMap((lesson) => lesson.resources).filter(
    (resource) => {
      const key = academyVideo(resource.url)?.id ?? resource.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  );
  const blocks: AcademyPostBlock[] = [];
  if (term.aliases.length) {
    blocks.push({
      type: "paragraph",
      text: `También puedes encontrarlo como ${term.aliases.join(", ")}.`,
    });
  }
  if (term.patchSensitive) {
    blocks.push({
      type: "paragraph",
      text:
        "Este concepto puede cambiar con el parche. Comprueba en el cliente la disponibilidad, los tiempos y las recompensas actuales.",
    });
  }
  return (
    <AcademyPostView
      post={{
        title: term.term,
        category: GLOSSARY_CATEGORIES[term.category],
        author: "Academia de la Grieta",
        summary: term.definition,
        blocks,
        resources,
        resourceNote:
          "Estos recursos permiten profundizar en el tema; no todos cubren este término concreto. Los ejemplos pueden pertenecer a parches anteriores.",
        related: lessons.map((lesson) => ({
          title: lesson.title,
          href: `/dashboard/academia/${lesson.slug}`,
        })),
      }}
    />
  );
}
