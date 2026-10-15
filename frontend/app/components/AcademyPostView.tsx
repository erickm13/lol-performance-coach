"use client";
import Link from "next/link";
import {
  type AcademyPost,
  type AcademyPostBlock,
  postReadingMinutes,
} from "../lib/academyPosts";
import { AcademyResources } from "./AcademyResources";
import { ScrollRevealRoot } from "./ScrollRevealRoot";

function PostBlock({ block }: { block: AcademyPostBlock }) {
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return (
      <List data-reveal="up">
        {block.items.map((item, index) => <li key={index}>{item}</li>)}
      </List>
    );
  }
  if (block.type === "heading") return <h2 data-reveal="up">{block.text}</h2>;
  if (block.type === "quote") {
    return (
      <blockquote data-reveal="up">
        <p>{block.text}</p>
      </blockquote>
    );
  }
  return <p data-reveal="up">{block.text}</p>;
}

export function AcademyPostView({ post }: { post: AcademyPost }) {
  const date = post.publishedAt ? new Date(post.publishedAt) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  return (
    <ScrollRevealRoot className="screen-stack motion-page academy-page academy-publication academy-simple-publication">
      <nav className="academy-simple-back" aria-label="Volver a la Academia">
        <Link href="/dashboard/academia">← Todas las publicaciones</Link>
      </nav>
      <article className="academy-simple-post">
        <header className="academy-simple-header" data-reveal="up">
          <span className="academy-simple-category">{post.category}</span>
          <h1>{post.title}</h1>
          <div className="academy-simple-byline">
            <span className="academy-simple-avatar" aria-hidden="true">
              {post.author.trim().charAt(0).toUpperCase()}
            </span>
            <span className="academy-simple-author">{post.author}</span>
            <span aria-hidden="true">·</span>
            <span>{postReadingMinutes(post)} min de lectura</span>
            {validDate && (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={validDate.toISOString()}>
                  {validDate.toLocaleDateString("es", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
              </>
            )}
          </div>
        </header>
        <div className="academy-simple-copy">
          {post.summary && (
            <p className="academy-simple-lead" data-reveal="up">
              {post.summary}
            </p>
          )}
          {post.blocks.map((block, index) => (
            <PostBlock key={index} block={block} />
          ))}
        </div>
        {!!post.resources?.length && (
          <section
            className="academy-simple-resources"
            aria-labelledby="post-resources-title"
            data-reveal="up"
          >
            <header>
              <h2 id="post-resources-title">Para profundizar</h2>
              <p>Videos y lecturas sobre este tema.</p>
            </header>
            <AcademyResources resources={post.resources}>
              {post.resourceNote && (
                <p className="resource-note">{post.resourceNote}</p>
              )}
            </AcademyResources>
          </section>
        )}
        {!!post.related?.length && (
          <footer className="academy-simple-related">
            <h2>También te puede interesar</h2>
            <div>
              {post.related.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.title}
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </footer>
        )}
      </article>
    </ScrollRevealRoot>
  );
}
