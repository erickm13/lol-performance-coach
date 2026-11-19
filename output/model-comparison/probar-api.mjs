import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_LIMIT = 4096;
const DEFAULT_TIMEOUT_MS = 180_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function timeoutFrom(env) {
  const value = env.API_TIMEOUT_MS;
  if (value === undefined || value === "") return DEFAULT_TIMEOUT_MS;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > DEFAULT_TIMEOUT_MS) {
    throw new Error("API_TIMEOUT_MS must be an integer from 1 to 180000");
  }
  return timeout;
}

function ollamaUrl(hostValue) {
  let host = (hostValue || "http://localhost:11434").trim();
  if (!/^https?:\/\//i.test(host)) host = `http://${host}`;
  try {
    const url = new URL(host);
    if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error();
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/api/chat`;
  } catch {
    throw new Error("OLLAMA_HOST must be a valid HTTP(S) host");
  }
}

export function resolveConfig(provider, format, env = process.env) {
  if (!["groq", "gemini", "ollama"].includes(provider)) {
    throw new Error("Provider must be groq, gemini, or ollama");
  }
  if (!["json", "csv"].includes(format)) {
    throw new Error("Format must be json or csv");
  }

  const config = { provider, format, timeoutMs: timeoutFrom(env) };
  if (provider === "groq") {
    if (!env.GROQ_API_KEY?.trim()) throw new Error("GROQ_API_KEY is required for groq");
    return {
      ...config,
      model: "openai/gpt-oss-20b",
      url: "https://api.groq.com/openai/v1/chat/completions",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      tokenParameter: "max_completion_tokens",
    };
  }
  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY is required for gemini");
    return {
      ...config,
      model: env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      headers: { Authorization: `Bearer ${env.GEMINI_API_KEY}` },
      tokenParameter: "max_tokens",
    };
  }
  return {
    ...config,
    model: env.OLLAMA_MODEL?.trim() || "gemma4:e4b",
    url: ollamaUrl(env.OLLAMA_HOST),
  };
}

export function buildRequest(config, prompt) {
  if (config.provider === "ollama") {
    return {
      url: config.url,
      headers: { "Content-Type": "application/json" },
      body: {
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature: 0, num_predict: OUTPUT_LIMIT },
      },
    };
  }
  return {
    url: config.url,
    headers: { ...config.headers, "Content-Type": "application/json" },
    body: {
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      temperature: 0,
      [config.tokenParameter]: OUTPUT_LIMIT,
    },
  };
}

function tokenCount(value) {
  return Number.isFinite(value) ? value : null;
}

function safeProviderStatus(body) {
  const codes = [body?.error?.status, body?.status, body?.error?.code];
  return codes.find((value) => typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(value)) ?? null;
}

function retryAfterSeconds(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const header = value.trim();
  const seconds = /^\d+(?:\.\d+)?$/.test(header)
    ? Number(header)
    : (Date.parse(header) - Date.now()) / 1000;
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(Math.ceil(seconds))) return null;
  return Math.ceil(seconds);
}

function providerLabel(provider) {
  return provider === "groq" ? "Groq" : provider === "gemini" ? "Gemini" : "Ollama";
}

export class ProviderRequestError extends Error {
  constructor({ provider, kind, httpStatus = null, providerStatus = null, retryAfterSeconds = null }) {
    const label = providerLabel(provider);
    const code = providerStatus ? ` (${providerStatus})` : "";
    let message;
    if (httpStatus === 503) {
      const unit = retryAfterSeconds === 1 ? "segundo" : "segundos";
      const wait = retryAfterSeconds === null
        ? "No se informó Retry-After válido; espera 30–60 segundos antes de reintentar manualmente."
        : `Respeta Retry-After y espera ${retryAfterSeconds} ${unit} antes de reintentar manualmente.`;
      message = `${label} temporalmente no disponible (HTTP 503${code}); vuelve a intentar más tarde; este intento no cuenta como respuesta evaluable. ${wait}`;
    } else if (httpStatus !== null) {
      message = `${label} respondió HTTP ${httpStatus}${code}; el intento quedó registrado como fallido y no cuenta como respuesta evaluable.`;
    } else if (kind === "network_or_timeout") {
      message = `${label}: fallo de red o timeout; el intento quedó registrado como fallido y no cuenta como respuesta evaluable.`;
    } else if (kind === "malformed_json") {
      message = `${label} devolvió JSON inválido; el intento quedó registrado como fallido y no cuenta como respuesta evaluable.`;
    } else {
      message = `${label} devolvió una respuesta vacía o malformada; el intento quedó registrado como fallido y no cuenta como respuesta evaluable.`;
    }
    super(message);
    this.name = "ProviderRequestError";
    this.provider = provider;
    this.kind = kind;
    this.httpStatus = httpStatus;
    this.providerStatus = providerStatus;
    this.retryAfterSeconds = retryAfterSeconds;
    this.metricsPath = null;
  }
}

export function parseResponse(provider, body) {
  if (!body || typeof body !== "object") throw new Error("Malformed provider response");
  const message = provider === "ollama" ? body.message : body.choices?.[0]?.message;
  const answer = message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("Provider returned an empty or malformed text answer");
  }

  const finishReason = provider === "ollama"
    ? body.done_reason ?? null
    : body.choices?.[0]?.finish_reason ?? null;
  if (finishReason === "tool_calls") {
    throw new Error("Provider returned tool calls instead of a text answer");
  }
  const truncated = finishReason === "length" || finishReason === "max_tokens" || body.done === false;
  const usage = body.usage && typeof body.usage === "object" ? body.usage : null;
  const ollama = provider === "ollama"
    ? Object.fromEntries([
        "total_duration",
        "load_duration",
        "prompt_eval_count",
        "prompt_eval_duration",
        "eval_count",
        "eval_duration",
      ].filter((key) => body[key] !== undefined).map((key) => [key, body[key]]))
    : null;

  return {
    answer,
    returnedModel: typeof body.model === "string" ? body.model : null,
    finishReason,
    truncated,
    usage,
    ollama,
    inputTokens: provider === "ollama"
      ? tokenCount(body.prompt_eval_count)
      : tokenCount(usage?.prompt_tokens),
    outputTokens: provider === "ollama"
      ? tokenCount(body.eval_count)
      : tokenCount(usage?.completion_tokens),
  };
}

export async function requestAnswer(config, prompt, fetchFn = fetch) {
  const request = buildRequest(config, prompt);
  let response;
  try {
    response = await fetchFn(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    throw new ProviderRequestError({ provider: config.provider, kind: "network_or_timeout" });
  }
  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // Keep provider error bodies out of logs and result files.
    }
    let retryHeader = null;
    try {
      retryHeader = response.headers?.get("retry-after") ?? null;
    } catch {
      // An absent or invalid header means the caller can use the manual wait guidance.
    }
    throw new ProviderRequestError({
      provider: config.provider,
      kind: "http_error",
      httpStatus: Number.isInteger(response.status) ? response.status : null,
      providerStatus: safeProviderStatus(body),
      retryAfterSeconds: retryAfterSeconds(retryHeader),
    });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ProviderRequestError({ provider: config.provider, kind: "malformed_json" });
  }
  try {
    return parseResponse(config.provider, body);
  } catch {
    throw new ProviderRequestError({ provider: config.provider, kind: "invalid_response" });
  }
}

function assemblePrompt(promptText, dataText) {
  return `${promptText.replace(/(?:\r?\n)*$/, "")}\n\n${dataText}`;
}

function runId() {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
}

export async function runComparison({
  provider,
  format,
  env = process.env,
  fetchFn = fetch,
  outputDir = path.join(packageDir, "resultados-api"),
} = {}) {
  const config = resolveConfig(provider, format, env);
  const promptText = await readFile(path.join(packageDir, "prompt-comun.txt"), "utf8");
  const dataText = await readFile(path.join(packageDir, `10-partidas.${format}`), "utf8");
  const prompt = assemblePrompt(promptText, dataText);
  const id = runId();
  const answerPath = path.join(outputDir, `${id}-${provider}-${format}-respuesta.txt`);
  const metricsPath = path.join(outputDir, `${id}-${provider}-${format}-metricas.json`);
  const started = performance.now();
  let result;
  try {
    result = await requestAnswer(config, prompt, fetchFn);
  } catch (error) {
    const requestElapsedWallMs = Math.round(performance.now() - started);
    if (!(error instanceof ProviderRequestError)) throw error;
    const metrics = {
      status: "failed",
      error: error.kind,
      provider,
      format,
      requestedModel: config.model,
      returnedModel: null,
      httpStatus: error.httpStatus,
      providerStatus: error.providerStatus,
      retryAfterSeconds: error.retryAfterSeconds,
      request: {
        stream: false,
        temperature: 0,
        outputLimit: OUTPUT_LIMIT,
        outputLimitParameter: config.tokenParameter || "num_predict",
      },
      requestElapsedWallMs,
      inputTokens: null,
      outputTokens: null,
      usage: null,
      finishReason: null,
      truncated: false,
      inputSha256: sha256(prompt),
      dataSha256: sha256(dataText),
    };
    await mkdir(outputDir, { recursive: true });
    await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
    error.metricsPath = metricsPath;
    throw error;
  }
  const requestElapsedWallMs = Math.round(performance.now() - started);

  const metrics = {
    status: result.truncated ? "incomplete" : "complete",
    error: result.truncated ? "output_truncated" : null,
    provider,
    format,
    requestedModel: config.model,
    returnedModel: result.returnedModel,
    request: {
      stream: false,
      temperature: 0,
      outputLimit: OUTPUT_LIMIT,
      outputLimitParameter: config.tokenParameter || "num_predict",
    },
    requestElapsedWallMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    usage: result.usage,
    finishReason: result.finishReason,
    truncated: result.truncated,
    ollama: result.ollama,
    inputSha256: sha256(prompt),
    dataSha256: sha256(dataText),
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(answerPath, result.answer, "utf8");
  await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  if (result.truncated) {
    throw new Error(`Output was truncated; partial answer and INCOMPLETE metrics saved to ${answerPath} and ${metricsPath}`);
  }
  return { answer: result.answer, answerPath, metricsPath, metrics };
}

function isCli() {
  return process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isCli()) {
  const [provider, format, ...extra] = process.argv.slice(2);
  if (!provider || !format || extra.length) {
    console.error("Usage: node --env-file=.env output/model-comparison/probar-api.mjs <groq|gemini|ollama> <json|csv>");
    process.exitCode = 2;
  } else {
    try {
      const result = await runComparison({ provider, format });
      console.log(result.answer);
      console.log(`\nSaved answer: ${path.relative(process.cwd(), result.answerPath)}`);
      console.log(`Saved metrics: ${path.relative(process.cwd(), result.metricsPath)}`);
      console.log(`Elapsed: ${result.metrics.requestElapsedWallMs} ms; input tokens: ${result.metrics.inputTokens ?? "not reported"}; output tokens: ${result.metrics.outputTokens ?? "not reported"}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Comparison failed");
      if (error instanceof ProviderRequestError && error.metricsPath) {
        console.error(`Métricas de fallo: ${path.relative(process.cwd(), error.metricsPath)}`);
      }
      process.exitCode = 1;
    }
  }
}
