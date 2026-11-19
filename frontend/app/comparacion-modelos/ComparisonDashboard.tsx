"use client";

import { useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { BrandLogo } from "../components/BrandLogo";
import snapshot from "./snapshot.json";

type Format = "json" | "csv";
type Run = (typeof snapshot.runs)[number];
const runs = snapshot.runs as Run[];
const providers = ["groq", "ollama"] as const;
const formatNames: Record<Format, string> = { json: "JSON", csv: "CSV" };
const providerNames: Record<(typeof providers)[number], string> = { groq: "Groq · API", ollama: "Ollama · local" };
const fmt = (value: number, digits = 2) => value.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const runFor = (provider: string, format: Format) => runs.find((run) => run.provider === provider && run.format === format)!;

function Switch<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="comparison-switch" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BarChart({ title, unit, metric, max, valueFor }: {
  title: string;
  unit: string;
  metric: string;
  max: number;
  valueFor: (run: Run) => number;
}) {
  return (
    <figure className="chart-card">
      <figcaption>
        <span className="eyebrow">MEDICIÓN OBSERVADA</span>
        <strong>{title}</strong>
        <span className="chart-unit">{unit}</span>
      </figcaption>
      <div className="chart-rows" role="img" aria-label={`${title}: ${runs.map((run) => `${run.provider} ${formatNames[run.format as Format]}, ${fmt(valueFor(run), metric === "time" ? 3 : 0)} ${unit}`).join("; ")}`}>
        {runs.map((run) => {
          const value = valueFor(run);
          const width = Math.max(1, (value / max) * 100);
          return (
            <div className="chart-row" key={run.id} aria-label={`${providerNames[run.provider as keyof typeof providerNames]}, ${formatNames[run.format as Format]}: ${fmt(value, metric === "time" ? 3 : 0)} ${unit}`}>
              <span className="chart-label"><i className={`provider-dot ${run.provider}`} />{run.provider === "groq" ? "Groq" : "Ollama"} <b>{formatNames[run.format as Format]}</b></span>
              <span className="chart-track" aria-hidden="true">
                <span className={`chart-bar ${run.provider}`} style={{ width: `${width}%` } as CSSProperties} />
              </span>
              <strong className="chart-value">{metric === "time" ? fmt(value, 3) : value.toLocaleString("es-ES")}</strong>
            </div>
          );
        })}
      </div>
      <div className="chart-scale"><span>0</span><span>Escala común · máx. {max.toLocaleString("es-ES")} {unit}</span></div>
    </figure>
  );
}

function SourceDetails({ run }: { run: Run }) {
  const audit = run.audit!;
  return (
    <details className="source-details">
      <summary>Fuentes y extractos · {run.provider === "groq" ? "Groq" : "Ollama"} {formatNames[run.format as Format]}</summary>
      <div className="source-grid">
        <div>
          <span className="eyebrow">ARCHIVOS ORIGINALES</span>
          <p><b>Métricas:</b> <code>{run.sources.metrics}</code></p>
          <p><b>Respuesta:</b> <code>{run.sources.answer}</code></p>
          <p><b>SHA-256 del prompt:</b> <code>{run.inputSha256}</code></p>
          <p><b>SHA-256 de datos:</b> <code>{run.dataSha256}</code></p>
        </div>
        <div>
          <span className="eyebrow">RESUMEN TAL COMO SE REPORTÓ</span>
          <blockquote>{audit.excerpts.csMin}</blockquote>
          <blockquote>{audit.excerpts.kpPct}</blockquote>
          <blockquote>{audit.excerpts.kda}</blockquote>
          <blockquote>{audit.excerpts.earlyDeaths}</blockquote>
        </div>
      </div>
    </details>
  );
}

function ComparisonDashboard() {
  const [format, setFormat] = useState<Format>("json");
  const [inputView, setInputView] = useState<"prompt" | "data">("prompt");
  const groqJson = runFor("groq", "json");
  const groqCsv = runFor("groq", "csv");
  const ollamaJson = runFor("ollama", "json");
  const ollamaCsv = runFor("ollama", "csv");
  const ollamaLoadNs = ollamaJson.metrics.ollama?.load_duration;
  if (typeof ollamaLoadNs !== "number") throw new Error("Falta el tiempo de carga registrado para Ollama JSON.");
  const elapsedMax = Math.max(...runs.map((run) => run.requestElapsedWallMs ?? 0)) / 1000;
  const tokenMax = Math.max(...runs.map((run) => run.inputTokens ?? 0));
  const currentAttempts = snapshot.attempts;

  return (
    <main className="comparison-page">
      <header className="comparison-header">
        <Link href="/" aria-label="Diff, inicio"><BrandLogo variant="wordmark" mobileVariant="symbol" /></Link>
        <div className="header-context"><span>LABORATORIO DE MODELOS</span><span>Diff / análisis comparativo</span></div>
        <span className="header-status"><i /> DEMO REPRODUCIBLE</span>
      </header>

      <div className="comparison-content">
        <section className="comparison-hero">
          <div className="hero-copy">
            <div className="kicker"><span>01</span> PRUEBA DE FORMATO · 30 OCT 2026</div>
            <h1>Una misma tarea.<br /><em>Dos formatos</em> de entrada.</h1>
            <p>Qué cambia cuando 10 partidas sintéticas de TOP y un mismo prompt llegan como JSON o CSV a dos modelos.</p>
            <div className="hero-tags"><span>10 partidas</span><span>1 solicitud por condición</span><span>Temperatura 0</span></div>
          </div>
          <aside className="hero-sample" aria-label="Modelos comparados">
            <div className="sample-heading"><span>CONDICIONES COMPLETAS</span><span>n = 1 c/u</span></div>
            <div className="model-pair"><span className="provider-symbol groq">G</span><div><b>Groq</b><small>openai/gpt-oss-20b · API</small></div><span className="live-mark">COMPLETO</span></div>
            <div className="model-pair"><span className="provider-symbol ollama">O</span><div><b>Ollama</b><small>gemma4:e4b · local</small></div><span className="live-mark">COMPLETO</span></div>
            <div className="sample-foot">Mismo prompt por formato · sin repeticiones por condición</div>
          </aside>
        </section>

        <section className="metrics-section" aria-labelledby="observed-title">
          <div className="section-heading"><div><span className="eyebrow">MEDICIONES</span><h2 id="observed-title">La entrada se acorta. El tiempo depende del contexto.</h2></div><span className="section-index">02 / 06</span></div>
          <div className="chart-grid">
            <BarChart title="Tiempo por solicitud" unit="s" metric="time" max={elapsedMax} valueFor={(run) => (run.requestElapsedWallMs ?? 0) / 1000} />
            <BarChart title="Tokens de entrada" unit="tokens" metric="tokens" max={tokenMax} valueFor={(run) => run.inputTokens ?? 0} />
          </div>
          <div className="finding-strip">
            <span className="finding-mark">↘</span>
            <p><b>Menos tokens de entrada al usar CSV:</b> {fmt(snapshot.inputTokenReductionPct.groq, 1)}% en Groq y {fmt(snapshot.inputTokenReductionPct.ollama, 1)}% en Ollama, frente a JSON en cada proveedor.</p>
            <span className="finding-caveat">Los tokenizadores varían.</span>
          </div>
          <p className="timing-note"><b>Lectura del tiempo:</b> Ollama JSON tardó {fmt(ollamaJson.requestElapsedWallMs / 1000, 2)} s e incluyó {fmt(ollamaLoadNs / 1e9, 2)} s de carga del modelo; Ollama CSV tardó {fmt(ollamaCsv.requestElapsedWallMs / 1000, 2)} s con carga casi nula. Son observaciones de una ejecución, no un efecto causal del formato ni una comparación de velocidad general.</p>
        </section>

        <section className="runs-section" aria-labelledby="runs-title">
          <div className="section-heading"><div><span className="eyebrow">REGISTRO DE EJECUCIONES</span><h2 id="runs-title">Cada condición, sin promediar entre modelos</h2></div><span className="section-index">03 / 06</span></div>
          <div className="table-scroll">
            <table className="runs-table">
              <thead><tr><th>Proveedor / modelo exacto</th><th>Formato</th><th>Entrada</th><th>Salida</th><th>Tiempo</th><th>Estado</th></tr></thead>
              <tbody>{runs.map((run) => (
                <tr key={run.id}>
                  <td><b>{run.provider === "groq" ? "Groq · API" : "Ollama · local"}</b><small>{run.requestedModel}</small></td>
                  <td><span className={`format-pill ${run.format}`}>{formatNames[run.format as Format]}</span></td>
                  <td>{run.inputTokens?.toLocaleString("es-ES")} <small>tokens</small></td>
                  <td>{run.outputTokens?.toLocaleString("es-ES")} <small>tokens</small></td>
                  <td>{fmt((run.requestElapsedWallMs ?? 0) / 1000, 3)} <small>s</small></td>
                  <td><span className="status-pill"><i /> Completo</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="table-note">Cada cifra corresponde a una solicitud. Los tokens de salida incluyen respuestas con distinta extensión y razonamiento; no son una medida directa de coste.</p>
        </section>

        <section className="audit-section" aria-labelledby="audit-title">
          <div className="section-heading"><div><span className="eyebrow">COMPROBACIÓN NUMÉRICA</span><h2 id="audit-title">Qué resumen devolvió cada respuesta</h2></div><span className="section-index">04 / 06</span></div>
          <p className="section-intro">La misma referencia aritmética se contrasta con los valores extraídos de cada respuesta guardada. Es una comprobación de aritmética, no de calidad de coaching.</p>
          <div className="table-scroll audit-scroll">
            <table className="audit-table">
              <thead><tr><th>Métrica reportada</th><th>Referencia</th><th>Groq · JSON</th><th>Groq · CSV</th><th>Ollama · JSON</th><th>Ollama · CSV</th></tr></thead>
              <tbody>
                {([
                  ["CS/min", "csMin", "5,41"],
                  ["KP medio", "kpPct", "49,1%"],
                  ["KDA por partida", "kda", "3,13"],
                  ["Muertes antes del min 10", "earlyDeathsMean", "1,50 · n=8"],
                ] as const).map(([label, key, reference]) => (
                  <tr key={key}><th scope="row">{label}</th><td className="ref-value">{reference}</td>{[groqJson, groqCsv, ollamaJson, ollamaCsv].map((run) => {
                    const value = run.audit![key];
                    const displayed = key === "earlyDeathsMean" ? `${fmt(value as number)} · n=${run.audit!.earlyDeathsKnown}` : `${fmt(value as number)}${key === "kpPct" ? "%" : ""}`;
                    const referenceValue = key === "kda" ? snapshot.referenceMetrics.kdaPerMatch : snapshot.referenceMetrics[key as keyof typeof snapshot.referenceMetrics];
                    const isMismatch = key === "earlyDeathsMean" ? run.audit!.earlyDeathsKnown !== snapshot.referenceMetrics.earlyDeathsKnown || value !== snapshot.referenceMetrics.earlyDeathsMean : value !== referenceValue;
                    return <td key={run.id} className={isMismatch ? "audit-mismatch" : "audit-match"}>{displayed}<small>{isMismatch ? "Revisar" : "Coincide"}</small></td>;
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="audit-findings">
            <article><span>01</span><p><b>Ollama JSON:</b> CS 5,31, KP 48,10 y KDA 3,09 no coinciden con la referencia 5,41 / 49,1 / 3,13.</p></article>
            <article><span>02</span><p><b>Ollama CSV:</b> reporta muertes tempranas con n=9; hay 8 valores conocidos en los datos.</p></article>
            <article><span>03</span><p><b>Groq JSON:</b> su prioridad cuenta 3 partidas por encima de 1 muerte temprana; la referencia encuentra 4/8.</p></article>
          </div>
          <p className="audit-reference">Referencia interna calculada sobre 10 partidas sintéticas · fuente: <code>{snapshot.source.reference}</code>. No son umbrales oficiales de rango.</p>
          <div className="source-details-list">{runs.map((run) => <SourceDetails key={run.id} run={run} />)}</div>
        </section>

        <section className="responses-section" aria-labelledby="responses-title">
          <div className="section-heading response-heading"><div><span className="eyebrow">LECTURA DE FUENTES</span><h2 id="responses-title">Prompt y respuestas originales</h2></div><span className="section-index">05 / 06</span></div>
          <div className="response-controls">
            <div><span className="control-label">FORMATO DE ENTRADA</span><Switch label="Formato de entrada" value={format} options={[{ value: "json", label: "JSON" }, { value: "csv", label: "CSV" }]} onChange={setFormat} /></div>
            <div><span className="control-label">MATERIAL DE ENTRADA</span><Switch label="Material de entrada" value={inputView} options={[{ value: "prompt", label: "Prompt común" }, { value: "data", label: `Datos ${formatNames[format]}`}]} onChange={setInputView} /></div>
          </div>
          <article className="input-source">
            <div className="source-title"><div><span className="eyebrow">{inputView === "prompt" ? "PROMPT COMÚN" : `DATOS ${formatNames[format]} ENVIADOS`}</span><strong>{inputView === "prompt" ? snapshot.source.prompt.path : snapshot.source.inputs[format].path}</strong></div><span className="source-badge">FUENTE ORIGINAL</span></div>
            <pre>{inputView === "prompt" ? snapshot.source.prompt.text : snapshot.source.inputs[format].text}</pre>
            {inputView === "data" && <div className="hash-line">SHA-256 · <code>{snapshot.source.inputs[format].sha256}</code></div>}
          </article>
          <div className="answer-grid">
            {providers.map((provider) => {
              const run = runFor(provider, format);
              return <article className={`answer-card ${provider}`} key={provider}>
                <header><div><span className={`provider-dot ${provider}`} /><span className="eyebrow">{providerNames[provider]}</span><h3>{run.requestedModel}</h3></div><span className="format-pill">{formatNames[format]}</span></header>
                <div className="answer-meta"><span>{run.sources.answer}</span><span>{run.outputTokens?.toLocaleString("es-ES")} tokens de salida</span></div>
                <pre className="answer-text">{run.answer}</pre>
              </article>;
            })}
          </div>
        </section>

        <section className="method-section" aria-labelledby="method-title">
          <div className="section-heading"><div><span className="eyebrow">ALCANCE Y MÉTODO</span><h2 id="method-title">Una muestra pequeña, límites visibles</h2></div><span className="section-index">06 / 06</span></div>
          <div className="method-grid">
            <article><span className="method-number">A</span><h3>Mismos datos por formato</h3><p>Los hashes del prompt coinciden dentro de cada formato y los dos proveedores recibieron el mismo archivo JSON o CSV. Solicitudes sin repeticiones: n=1 por condición.</p></article>
            <article><span className="method-number">B</span><h3>Configuración registrada</h3><p>Temperatura 0, streaming desactivado y límite de salida 4096. Los tokenizadores y las respuestas varían; no se estima coste monetario.</p></article>
            <article><span className="method-number">C</span><h3>Sin ganador global</h3><p>El tiempo observado depende de carga y entorno. No se midieron hardware, energía ni calidad global. Los datos son sintéticos, de 10 partidas TOP.</p></article>
          </div>
          <div className="attempts-box"><div><span className="eyebrow">INTENTOS FUERA DE LA COMPARACIÓN PRINCIPAL</span><h3>Gemini quedó sin una respuesta completa</h3><p>Un intento JSON terminó en HTTP 503; el segundo quedó truncado por límite de salida. No hubo ejecución CSV.</p></div>
            <div className="attempt-pills">{currentAttempts.map((run) => <span key={run.id} className={run.status === "failed" ? "attempt-failed" : "attempt-partial"}>{run.status === "failed" ? `HTTP ${run.httpStatus} · fallido` : "JSON · incompleto / truncado"}<small>{run.requestElapsedWallMs ? `${fmt(run.requestElapsedWallMs / 1000, 3)} s` : ""}{run.outputTokens ? ` · ${run.outputTokens} tokens salida` : ""}</small></span>)}</div>
          </div>
          <details className="attempt-details"><summary>Ver archivos y respuesta parcial de Gemini</summary><div className="attempt-detail-grid">{currentAttempts.map((run) => <article key={run.id}><b>{run.status === "failed" ? `Fallido · HTTP ${run.httpStatus}` : "JSON · truncado"}</b><code>{run.sources.metrics}</code>{run.sources.answer && <><code>{run.sources.answer}</code><pre>{run.answer}</pre></>}</article>)}</div></details>
          <p className="scope-note">Se excluyen dos capturas locales anteriores porque no permiten emparejar modelo e hash de entrada con estas cuatro ejecuciones.</p>
          <details className="provenance-details"><summary>Ver hashes y métricas originales completas</summary><div className="provenance-list">{runs.map((run) => <div key={run.id}><b>{run.provider} / {run.format}</b><code>{run.sources.metrics}</code><pre>{JSON.stringify(run.metrics, null, 2)}</pre></div>)}</div></details>
        </section>

        <footer className="comparison-footer"><BrandLogo variant="symbol" /><span>Diff · herramienta de análisis experimental</span><Link href="/">Volver a Diff ↗</Link></footer>
      </div>
    </main>
  );
}

export default ComparisonDashboard;
