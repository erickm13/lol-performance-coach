import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(sourceDir, "../..");
const destination = path.join(repoDir, "frontend/app/comparacion-modelos/snapshot.json");
const relative = (file) => path.relative(repoDir, file).split(path.sep).join("/");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const read = async (file) => readFile(file, "utf8");
const required = (value, label) => {
  if (value === undefined || value === null || value === "") throw new Error(`Campo de fuente faltante: ${label}`);
  return value;
};

async function oneFile(files, suffix, label) {
  const matches = files.filter((file) => file.endsWith(suffix));
  assert.equal(matches.length, 1, `Se esperaba una fuente ${label}; encontradas: ${matches.length}`);
  return matches[0];
}

function reportedLine(answer, label, pattern) {
  const line = answer.split(/\r?\n/).find((candidate) => pattern.test(candidate));
  assert.ok(line, `No se encontró la línea ${label} en la respuesta`);
  const normalized = line.replace(/[\u00a0\u202f]/g, " ");
  const match = pattern.exec(normalized);
  const value = normalized.slice(match.index + match[0].length).match(/\b\d+\.\d+\b/);
  assert.ok(value, `No se encontró el valor de ${label} en: ${line}`);
  return { value: Number(value[0]), excerpt: line.trim() };
}

function auditAnswer(answer) {
  const cs = reportedLine(answer, "CS/min", /CS\s*(?:_min|\/\s*min|por minuto)/i);
  const kp = reportedLine(answer, "KP", /(?:KP\s*(?:_pct|%)|participaci[oó]n\s+en\s+kills|KP\s+por\s+minuto)/i);
  const kda = reportedLine(answer, "KDA", /KDA(?:\s+por partida)?/i);
  const deathsLine = answer.split(/\r?\n/).find((line) => /muertes antes del minuto/i.test(line));
  assert.ok(deathsLine, "No se encontró la línea de muertes tempranas en la respuesta");
  const deathsValue = deathsLine.match(/\b\d+\.\d+\b/);
  assert.ok(deathsValue, `No se encontró el promedio de muertes tempranas en: ${deathsLine}`);
  const known = deathsLine.match(/\bn\s*(?:conocido)?\s*[=:]\s*(\d+)/i)
    ?? deathsLine.match(/\|\s*(\d+)\s*\(con datos conocidos\)/i);
  assert.ok(known, `No se encontró el denominador de muertes tempranas en: ${deathsLine}`);
  return {
    csMin: cs.value,
    kpPct: kp.value,
    kda: kda.value,
    earlyDeathsMean: Number(deathsValue[0]),
    earlyDeathsKnown: Number(known[1]),
    excerpts: {
      csMin: cs.excerpt,
      kpPct: kp.excerpt,
      kda: kda.excerpt,
      earlyDeaths: deathsLine.trim(),
    },
  };
}

async function loadRun(files, provider, format, metricsFileOverride) {
  const metricsFile = metricsFileOverride ?? await oneFile(files, `-${provider}-${format}-metricas.json`, `${provider}/${format}/métricas`);
  const rawMetrics = await read(path.join(sourceDir, "resultados-api", metricsFile));
  const metrics = JSON.parse(rawMetrics);
  assert.equal(metrics.provider, provider, `${metricsFile}: provider inesperado`);
  assert.equal(metrics.format, format, `${metricsFile}: format inesperado`);
  required(metrics.requestedModel, `${metricsFile}: requestedModel`);
  required(metrics.status, `${metricsFile}: status`);
  required(metrics.request, `${metricsFile}: request`);
  assert.equal(metrics.request.stream, false, `${metricsFile}: stream debe ser false`);
  assert.equal(metrics.request.temperature, 0, `${metricsFile}: temperature debe ser 0`);
  assert.equal(metrics.request.outputLimit, 4096, `${metricsFile}: outputLimit debe ser 4096`);
  required(metrics.inputSha256, `${metricsFile}: inputSha256`);
  required(metrics.dataSha256, `${metricsFile}: dataSha256`);
  if (provider === "ollama") {
    required(metrics.ollama, `${metricsFile}: ollama`);
    assert.equal(typeof metrics.ollama.load_duration, "number", `${metricsFile}: ollama.load_duration debe ser numérico`);
  }

  const stem = metricsFile.replace(/-metricas\.json$/, "");
  const answerFile = files.find((file) => file === `${stem}-respuesta.txt`);
  let answer = null;
  let audit = null;
  if (answerFile) {
    answer = await read(path.join(sourceDir, "resultados-api", answerFile));
    if (metrics.status === "complete") audit = auditAnswer(answer);
  }
  if (metrics.status === "complete") {
    assert.ok(answer?.length, `${metricsFile}: respuesta completa ausente`);
    for (const field of ["inputTokens", "outputTokens", "requestElapsedWallMs"]) {
      assert.equal(typeof metrics[field], "number", `${metricsFile}: ${field} debe ser numérico`);
    }
  }

  return {
    id: `${provider}-${format}${provider === "gemini" ? `-${metricsFile.slice(0, 19)}` : ""}`,
    provider,
    format,
    requestedModel: metrics.requestedModel,
    returnedModel: metrics.returnedModel,
    status: metrics.status,
    error: metrics.error,
    httpStatus: metrics.httpStatus ?? null,
    finishReason: metrics.finishReason,
    truncated: metrics.truncated,
    request: metrics.request,
    requestElapsedWallMs: metrics.requestElapsedWallMs ?? null,
    inputTokens: metrics.inputTokens ?? null,
    outputTokens: metrics.outputTokens ?? null,
    inputSha256: metrics.inputSha256,
    dataSha256: metrics.dataSha256,
    metrics,
    sources: {
      metrics: relative(path.join(sourceDir, "resultados-api", metricsFile)),
      answer: answerFile ? relative(path.join(sourceDir, "resultados-api", answerFile)) : null,
    },
    answer,
    audit,
  };
}

async function buildSnapshot() {
  const apiDir = path.join(sourceDir, "resultados-api");
  const files = await readdir(apiDir);
  const inputSpecs = {
    json: "10-partidas.json",
    csv: "10-partidas.csv",
  };
  const inputs = {};
  for (const [format, name] of Object.entries(inputSpecs)) {
    const text = await read(path.join(sourceDir, name));
    if (format === "json") {
      const matches = JSON.parse(text);
      assert.equal(matches.length, 10, "10-partidas.json debe contener 10 partidas");
      assert.equal(Object.keys(matches[0]).length, 13, "10-partidas.json debe contener 13 campos");
    } else {
      const rows = text.trim().split(/\r?\n/);
      assert.equal(rows.length, 11, "10-partidas.csv debe contener cabecera y 10 filas");
      assert.ok(rows.every((row) => row.split(",").length === 13), "10-partidas.csv debe contener 13 columnas en cada fila");
    }
    inputs[format] = { path: relative(path.join(sourceDir, name)), sha256: digest(text), text };
  }
  const promptText = await read(path.join(sourceDir, "prompt-comun.txt"));
  const runs = [];
  const attempts = [];
  for (const provider of ["groq", "ollama", "gemini"]) {
    for (const format of ["json", "csv"]) {
      const metricFiles = files.filter((file) => file.endsWith(`-${provider}-${format}-metricas.json`));
      if (!metricFiles.length) continue;
      for (const metricFile of metricFiles) {
        const loaded = await loadRun(files, provider, format, provider === "gemini" ? metricFile : undefined);
        if (loaded.status === "complete" && provider !== "gemini") runs.push(loaded);
        else attempts.push(loaded);
      }
    }
  }

  for (const format of ["json", "csv"]) {
    const paired = runs.filter((run) => run.format === format);
    assert.equal(paired.length, 2, `Se esperaban dos ejecuciones completas para ${format}`);
    assert.equal(new Set(paired.map((run) => run.inputSha256)).size, 1, `${format}: hash de prompt no coincide`);
    assert.equal(new Set(paired.map((run) => run.dataSha256)).size, 1, `${format}: hash de datos no coincide`);
    assert.equal(paired[0].dataSha256, inputs[format].sha256, `${format}: hash de datos no coincide con el archivo fuente`);
  }
  for (const run of [...runs, ...attempts]) {
    const runnerInput = `${promptText.replace(/(?:\r?\n)*$/, "")}\n\n${inputs[run.format].text}`;
    assert.equal(run.inputSha256, digest(runnerInput), `${run.sources.metrics}: inputSha256 no coincide con el prompt y datos actuales`);
    assert.equal(run.dataSha256, inputs[run.format].sha256, `${run.sources.metrics}: dataSha256 no coincide con los datos actuales`);
  }
  assert.equal(runs.length, 4, "Se esperaban cuatro ejecuciones completas principales");
  assert.ok(attempts.some((run) => run.status === "failed" && run.httpStatus === 503), "Falta el intento Gemini con HTTP 503");
  assert.ok(attempts.some((run) => run.status === "incomplete" && run.truncated), "Falta el intento Gemini truncado");

  const reductions = Object.fromEntries(["groq", "ollama"].map((provider) => {
    const json = runs.find((run) => run.provider === provider && run.format === "json");
    const csv = runs.find((run) => run.provider === provider && run.format === "csv");
    return [provider, Number(((1 - csv.inputTokens / json.inputTokens) * 100).toFixed(1))];
  }));
  return {
    source: {
      prompt: { path: relative(path.join(sourceDir, "prompt-comun.txt")), text: promptText },
      inputs,
      reference: relative(path.join(sourceDir, "referencia-resultados.md")),
    },
    referenceMetrics: {
      csMin: 5.41,
      kpPct: 49.1,
      kdaPerMatch: 3.13,
      earlyDeathsMean: 1.5,
      earlyDeathsKnown: 8,
    },
    runs,
    attempts,
    inputTokenReductionPct: reductions,
  };
}

const snapshot = await buildSnapshot();
if (process.argv.includes("--check")) {
  const expected = {
    "groq-json": { csMin: 5.41, kpPct: 49.1, kda: 3.13, earlyDeathsMean: 1.5, earlyDeathsKnown: 8 },
    "groq-csv": { csMin: 5.41, kpPct: 49.1, kda: 3.13, earlyDeathsMean: 1.5, earlyDeathsKnown: 8 },
    "ollama-json": { csMin: 5.31, kpPct: 48.1, kda: 3.09, earlyDeathsMean: 1.5, earlyDeathsKnown: 8 },
    "ollama-csv": { csMin: 4.92, kpPct: 49.9, kda: 2.84, earlyDeathsMean: 1.67, earlyDeathsKnown: 9 },
  };
  for (const run of snapshot.runs) assert.deepEqual(run.audit && Object.fromEntries(Object.entries(run.audit).filter(([key]) => key !== "excerpts")), expected[run.id], `${run.id}: extracción de resumen cambió`);
  assert.deepEqual(snapshot.inputTokenReductionPct, { groq: 49.4, ollama: 52.8 });
  assert.deepEqual(JSON.parse(await read(destination)), snapshot, "snapshot desactualizado; vuelve a ejecutar el generador");
  console.log("OK: 4 ejecuciones, hashes pareados, estados Gemini y resúmenes reportados verificados.");
} else {
  await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Snapshot generado: ${relative(destination)} (${snapshot.runs.length} ejecuciones completas, ${snapshot.attempts.length} intentos incompletos)`);
}
