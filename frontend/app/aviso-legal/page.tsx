import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo";
import { LegalNoticeText } from "../components/LegalNotice";

export const metadata: Metadata = { title: "Aviso legal · Diff" };

export default function LegalNoticePage() {
  return (
    <main className="not-found-page">
      <Link className="brand" href="/">
        <BrandLogo variant="wordmark" />
      </Link>
      <section className="rune-panel legal-page">
        <span className="teaser-label">RIOT GAMES</span>
        <h1>Aviso legal</h1>
        <LegalNoticeText />
        <Link className="rune-link" href="/dashboard">Volver al dashboard →</Link>
      </section>
    </main>
  );
}
