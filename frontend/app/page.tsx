import { HealthStatus } from "./components/HealthStatus";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Plataforma de análisis para League of Legends
      </h1>
      <div className="text-mist">
        <HealthStatus />
      </div>
    </main>
  );
}
