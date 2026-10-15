import { notFound, redirect } from "next/navigation";
import {
  ACADEMY,
  ACADEMY_GLOSSARY,
  academyArticle,
} from "../../../lib/academy";
import {
  AcademyArticleView,
  AcademyGlossaryView,
} from "../../../components/AcademyView";
export function generateStaticParams() {
  return [
    ...new Set([
      ...ACADEMY.map((article) => article.slug),
      ...ACADEMY_GLOSSARY.map((term) => term.id),
    ]),
  ].map((slug) => ({ slug }));
}
export default function Page({ params }: { params: { slug: string } }) {
  const aliases: Record<string, string> = {
    kiteo: "kiting",
    "control-de-oleadas": "wave-management",
    gankeo: "gank",
  };
  if (aliases[params.slug]) {
    redirect(`/dashboard/academia/${aliases[params.slug]}`);
  }
  const article = academyArticle(params.slug);
  if (article) return <AcademyArticleView article={article} />;
  const term = ACADEMY_GLOSSARY.find((item) => item.id === params.slug);
  if (!term) notFound();
  return <AcademyGlossaryView term={term} />;
}
