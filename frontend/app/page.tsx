import Link from "next/link";
import Image from "next/image";
import { ScrollRevealRoot } from "./components/ScrollRevealRoot";
import { CoachIcon } from "./components/CoachIcon";
const features = [
  {
    number: "01",
    title: "Descubre tus patrones",
    text:
      "Farmeo, visión, juego temprano y consistencia: identifica qué mejorar con evidencia de tus propias partidas.",
    symbol: "◎",
  },
  {
    number: "02",
    title: "Entrena con un plan",
    text:
      "Objetivos y ejercicios semanales basados en tus debilidades, con explicaciones claras y seguimiento de cumplimiento.",
    symbol: "◇",
  },
  {
    number: "03",
    title: "Revisa cada partida",
    text:
      "Consulta tu historial, compara métricas y explora los equipos y eventos de tus partidas para preparar la siguiente.",
    symbol: "↗",
  },
];
export default function Home() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Navegación principal">
        <Link className="brand" href="/">
          <span className="brand-mark" />
          <span className="brand-name">LOL PERFORMANCE COACH</span>
        </Link>
        <div>
          <Link className="rune-link" href="/login">Iniciar sesión</Link>
          <Link className="rune-btn btn-sm" href="/register">Registrarme</Link>
        </div>
      </nav>
      <section className="landing-hero">
        <div className="hero-kicker">
          <span />DE TUS PARTIDAS A TU PRÓXIMO OBJETIVO
        </div>
        <h1>
          Tu próxima mejora<br />empieza con <em>datos reales.</em>
        </h1>
        <p>
          Vincula tu cuenta de Riot, descubre los patrones de tus partidas y
          conviértelos en un plan de entrenamiento hecho a tu medida.
        </p>
        <div className="hero-actions">
          <Link className="rune-btn" href="/register">
            Crear cuenta gratis <span aria-hidden="true">→</span>
          </Link>
          <Link className="rune-link" href="/login">Ya tengo cuenta</Link>
        </div>
        <div className="hero-meta">
          <span>League of Legends</span>
          <span>API oficial de Riot</span>
          <span>Coach personalizado</span>
        </div>
        <div className="hero-rune hero-rune-one" aria-hidden="true" />
        <div className="hero-rune hero-rune-two" aria-hidden="true" />
      </section>
      <ScrollRevealRoot className="landing-sections motion-page">
        <section
          className="landing-product-preview"
          data-reveal="up"
          aria-labelledby="product-preview-heading"
        >
          <figure>
            <Image
              src="/previews/match-analysis.png"
              width={1142}
              height={726}
              alt="Captura real del mapa de análisis de una partida, con errores en rojo, aciertos en azul y alternativas en amarillo"
            />
            <figcaption>
              Vista real del mapa de análisis de una partida.
            </figcaption>
          </figure>
          <div>
            <span className="teaser-label">ASÍ SE VE TU REVISIÓN</span>
            <h2 id="product-preview-heading">
              Entiende la jugada y prepara la siguiente.
            </h2>
            <p>
              Explora momentos de tus partidas con explicaciones del coach y
              consulta los datos que sustentan cada consejo.
            </p>
            <ul>
              <li>Rojo: errores señalados y su explicación.</li>
              <li>Azul: buenas decisiones para repetir.</li>
              <li>Amarillo: alternativas para practicar.</li>
            </ul>
          </div>
        </section>
        <section
          className="landing-features"
          aria-label="Cómo te ayuda el coach"
        >
          {features.map((feature) => (
            <article
              key={feature.number}
              className="rune-panel landing-feature"
              data-reveal="up"
            >
              <div className="feature-top">
                <span className="feature-symbol" aria-hidden="true">
                  {feature.symbol}
                </span>
                <span>{feature.number}</span>
              </div>
              <h2>{feature.title}</h2>
              <p>{feature.text}</p>
            </article>
          ))}
        </section>
        <section className="rune-panel landing-onboarding" data-reveal="up">
          <div>
            <span className="teaser-label">TU PRIMERA SESIÓN</span>
            <h2>Entra a la Grieta con un foco claro.</h2>
            <p>
              El coach explica tus métricas y te ayuda a decidir qué practicar.
              Tú llevas el plan a la partida.
            </p>
          </div>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Crea tu cuenta</strong>
                <p>Regístrate y verifica tu correo.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Vincula Riot</strong>
                <p>Usa tu Riot ID para sincronizar tus partidas.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Elige tu próximo objetivo</strong>
                <p>Revisa tus debilidades y genera tu plan semanal.</p>
              </div>
            </li>
          </ol>
        </section>
        <section className="landing-final" data-reveal="up">
          <CoachIcon />
          <h2>Cada partida es una oportunidad para aprender.</h2>
          <Link className="rune-btn" href="/register">
            Empezar mi entrenamiento →
          </Link>
        </section>
      </ScrollRevealRoot>
      <footer className="landing-footer">
        <span>LoL Performance Coach</span>
        <p>
          Proyecto independiente. No está afiliado ni respaldado por Riot Games.
        </p>
        <Link href="/login" className="rune-link">Iniciar sesión →</Link>
      </footer>
    </main>
  );
}
