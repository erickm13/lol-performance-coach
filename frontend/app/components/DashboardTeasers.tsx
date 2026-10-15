"use client";
import Link from "next/link";
import { useResource } from "../lib/useResource";
import {
  CATEGORIES,
  itemTitle,
  type PlanData,
  SEVERITIES,
  trainingCopy,
  type WeaknessData,
} from "../lib/training";
import { ProgressMeter } from "./ProgressMeter";
import { CountUp } from "./CountUp";
export function DashboardTeasers() {
  const weaknesses = useResource<WeaknessData>("/riot/weaknesses");
  const plan = useResource<PlanData>("/riot/training-plan");
  if (weaknesses.error || plan.error) {
    return (
      <div className="screen-notice" role="alert">
        <p>No pudimos cargar tu próxima práctica.</p>
        <button
          className="rune-link"
          onClick={() => {
            weaknesses.reload();
            plan.reload();
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (!weaknesses.data || !plan.data) {
    return (
      <p className="page-sub" role="status">Preparando tu próxima práctica…</p>
    );
  }
  if (weaknesses.data.linked === false) return null;
  const urgent = weaknesses.data.weaknesses[0];
  const drills = plan.data.items.filter((item) => item.type === "drill");
  const done = drills.filter((item) => item.completed).length;
  const next = drills.find((item) => !item.completed);
  const progress = drills.length ? Math.round(done / drills.length * 100) : 0;
  return (
    <div className="teaser-grid">
      <Link
        href="/dashboard/debilidades"
        className="rune-panel teaser-card hover:bg-panel-line/20 transition-colors"
      >
        <span className="teaser-label">Tu foco de mejora</span>
        <h3>
          {urgent
            ? `${CATEGORIES[urgent.category] ?? urgent.category} · Prioridad ${
              SEVERITIES[urgent.severity] ?? urgent.severity
            }`
            : "Explora tus patrones"}
        </h3>
        <p className="desc">
          {urgent?.description ??
            "Revisa la muestra de tus partidas y descubre qué puedes trabajar."}
        </p>
        <span className="rune-link text-sm">Ver debilidades y evidencia →</span>
      </Link>
      <Link
        href={next
          ? `/dashboard/entrenamiento#exercise-${next.id}`
          : "/dashboard/entrenamiento"}
        className="rune-panel teaser-card hover:bg-panel-line/20 transition-colors"
      >
        <span className="teaser-label">Tu próxima práctica</span>
        <h3>
          {next
            ? itemTitle(next)
            : plan.data.plan && drills.length
            ? "Ejercicios de la semana completados"
            : "Prepara tu plan semanal"}
        </h3>
        <p className="desc">
          {next
            ? trainingCopy(next.description)
            : "Convierte tus patrones en un objetivo y ejercicios para tu siguiente partida."}
        </p>
        {!!drills.length && (
          <>
            <ProgressMeter
              value={progress}
              label="Cumplimiento de ejercicios del plan semanal"
            />
            <p className="page-sub">
              <CountUp value={done} startOnView /> de{" "}
              <CountUp value={drills.length} startOnView />{" "}
              ejercicios completados
            </p>
          </>
        )}
        <span className="rune-link text-sm">
          {plan.data.plan
            ? "Continuar entrenamiento"
            : "Crear mi entrenamiento"} →
        </span>
      </Link>
    </div>
  );
}
