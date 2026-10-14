import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-5xl flex items-center justify-between py-4 mb-12">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 bg-teal"
            style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
          />
          <span className="font-display text-sm tracking-wide">LoL Performance Coach</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/login" className="rune-link text-sm">
            Iniciar sesión
          </Link>
          <Link href="/register" className="rune-btn text-sm">
            Registrarme
          </Link>
        </div>
      </div>

      <div className="rune-stagger flex flex-col items-center gap-5 text-center max-w-2xl mb-16">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          Mejorá tu rango con datos reales de tus partidas
        </h1>
        <p className="text-mist text-base leading-relaxed">
          Vinculá tu cuenta de Riot y dejá que analicemos tus partidas recientes para encontrar
          los patrones que te están frenando — con un plan de entrenamiento semanal hecho a tu
          medida.
        </p>
        <div className="flex items-center gap-5 mt-2">
          <Link href="/register" className="rune-btn">
            Crear cuenta gratis
          </Link>
          <Link href="/login" className="rune-link text-sm">
            Ya tengo cuenta
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl mb-16">
        <section className="rune-panel p-6 flex flex-col gap-3">
          <span
            className="h-8 w-8 bg-teal"
            style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
          />
          <h2 className="font-display font-semibold">Debilidades detectadas</h2>
          <p className="text-mist text-sm leading-relaxed">
            Identificamos automáticamente los patrones que más te cuestan — muertes tempranas,
            visión baja, farmeo inconsistente — con evidencia de tus propias partidas.
          </p>
        </section>
        <section className="rune-panel p-6 flex flex-col gap-3">
          <span
            className="h-8 w-8 bg-teal"
            style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
          />
          <h2 className="font-display font-semibold">Plan de entrenamiento semanal</h2>
          <p className="text-mist text-sm leading-relaxed">
            Un plan concreto y explicado, generado a partir de tus debilidades, con seguimiento
            de qué completaste cada semana.
          </p>
        </section>
        <section className="rune-panel p-6 flex flex-col gap-3">
          <span
            className="h-8 w-8 bg-teal"
            style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
          />
          <h2 className="font-display font-semibold">Seguimiento de tu progreso</h2>
          <p className="text-mist text-sm leading-relaxed">
            Mirá tu rango, tu KDA y tus métricas clave evolucionar partida a partida, sin tener
            que armar tu propia planilla.
          </p>
        </section>
      </div>

      <div className="w-full max-w-5xl flex flex-col gap-6 mb-12">
        <div>
          <h2 className="font-display text-xl font-semibold">Antes de vincular tu cuenta</h2>
          <p className="text-mist text-sm mt-1">
            Esto es lo primero que vas a ver al registrarte, mientras todavía no conectaste tu
            cuenta de Riot.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rune-panel p-6 flex flex-col gap-2">
            <h3 className="font-display font-semibold">Próximos pasos</h3>
            <p className="text-mist text-sm leading-relaxed">
              1. Vinculá tu cuenta de Riot para ver tus partidas
              <br />
              2. Revisá tu rango y tu historial reciente
              <br />
              3. Automáticamente vamos a detectar tus debilidades y armar tu plan de
              entrenamiento semanal
            </p>
          </section>
          <section className="rune-panel p-6 flex flex-col gap-2">
            <h3 className="font-display font-semibold">Qué vas a poder hacer acá</h3>
            <p className="text-mist text-sm leading-relaxed">
              LoL Performance Coach analiza tus partidas recientes para detectar patrones de
              juego, mostrarte métricas clave y armar un plan de entrenamiento semanal
              personalizado.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
