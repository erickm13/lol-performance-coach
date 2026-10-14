import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-col items-center px-6 py-12">
      <div className="flex flex-col items-center gap-2 mb-8">
        <span
          className="h-2.5 w-2.5 bg-teal"
          style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
        />
        <span className="font-display text-sm tracking-wide">LoL Performance Coach</span>
      </div>
      <section className="rune-panel p-8 flex flex-col items-start gap-4 max-w-sm w-full">
        <span className="font-display text-5xl font-bold text-gold">404</span>
        <h1 className="font-display text-xl font-semibold">Esta pantalla no existe en la Grieta</h1>
        <p className="text-mist text-sm leading-relaxed">
          Revisá la URL o volvé a un lugar conocido del mapa.
        </p>
        <Link href="/dashboard" className="rune-btn">
          Volver al dashboard
        </Link>
        <Link href="/login" className="rune-link text-sm">
          Ir a iniciar sesión
        </Link>
      </section>
    </main>
  );
}
