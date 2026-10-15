import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found-page">
      <Link className="brand" href="/">
        <span className="brand-mark" />
        <span className="brand-name">LOL PERFORMANCE COACH</span>
      </Link>
      <section className="rune-panel not-found-panel">
        <span className="not-found-code">404</span>
        <span className="teaser-label">FUERA DEL MAPA</span>
        <h1>Esta pantalla no existe en la Grieta</h1>
        <p>Revisa la dirección o vuelve a un lugar conocido del mapa.</p>
        <Link className="rune-btn" href="/dashboard">Volver al dashboard</Link>
        <Link className="rune-link" href="/">Ir al inicio →</Link>
      </section>
    </main>
  );
}
