import { type AcademyArticle, type AcademyResource } from "./academy";

// Presentation accepts free-form content; an editor can produce these blocks
// without requiring a lesson-specific set of sections.
export type AcademyPostBlock =
  | { type: "paragraph" | "heading" | "quote"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean };

export type AcademyPost = {
  title: string;
  category: string;
  author: string;
  summary?: string;
  publishedAt?: string;
  blocks: AcademyPostBlock[];
  resources?: AcademyResource[];
  resourceNote?: string;
  related?: { title: string; href: string }[];
};

export function postReadingMinutes(post: AcademyPost) {
  const text = [
    post.summary ?? "",
    ...post.blocks.map((block) =>
      block.type === "list" ? block.items.join(" ") : block.text
    ),
  ].join(" ");
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 180));
}

export function articlePost(
  article: AcademyArticle,
  related: AcademyArticle[],
): AcademyPost {
  const blocks: AcademyPostBlock[] = [{
    type: "paragraph",
    text: article.when,
  }];
  if (article.steps.length) blocks.push({ type: "list", items: article.steps });
  if (article.pitfalls.length) {
    blocks.push(
      {
        type: "paragraph",
        text: "Hay algunos errores que conviene tener presentes:",
      },
      { type: "list", items: article.pitfalls },
    );
  }
  if (article.exercise) {
    blocks.push(
      { type: "heading", text: "Para tu próxima sesión" },
      { type: "paragraph", text: article.exercise },
    );
  }
  if (article.check) blocks.push({ type: "quote", text: article.check });
  return {
    title: article.title,
    category: article.category,
    author: "Academia de la Grieta",
    summary: article.definition,
    blocks,
    resources: article.resources,
    resourceNote:
      "Los videos enseñan fundamentos. Los objetos, valores y tiempos pueden pertenecer a parches anteriores; consulta el catálogo actual para preparar tus compras.",
    related: related.map((item) => ({
      title: item.title,
      href: `/dashboard/academia/${item.slug}`,
    })),
  };
}
