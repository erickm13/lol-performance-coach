import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.0";
import {
  DEFAULT_GEMINI_MODEL,
  generateExplanation as gemini,
} from "../src/analysis/gemini.ts";
import { explainMapMoments } from "../src/analysis/matchMap.ts";
import { createExplanationGenerator, LlmError } from "../src/analysis/llm.ts";

async function withKeys(keys: Record<string, string>, fn: () => Promise<void>) {
  const names = ["GROQ_API_KEY", "GEMINI_API_KEY", "GEMINI_MODEL"];
  const saved = names.map((name) => Deno.env.get(name));
  for (const name of names) {
    Deno.env.delete(name);
    if (keys[name] !== undefined) Deno.env.set(name, keys[name]);
  }
  try {
    await fn();
  } finally {
    names.forEach((name, i) => {
      if (saved[i] === undefined) Deno.env.delete(name);
      else Deno.env.set(name, saved[i]!);
    });
  }
}
const BOTH = { GROQ_API_KEY: "test-groq", GEMINI_API_KEY: "test-gemini" };
const success = (text = "Respuesta") =>
  Response.json({
    choices: [{ finish_reason: "stop", message: { content: text } }],
  });
const limited = (retry?: string) =>
  new Response("private provider error", {
    status: 429,
    headers: retry === undefined ? {} : { "Retry-After": retry },
  });

Deno.test("Gemini: Authorization, esquema estricto, tuteo, razonamiento y límite adaptado", async () => {
  await withKeys({
    GEMINI_API_KEY: "test-gemini",
    GEMINI_MODEL: "custom-flash",
  }, async () => {
    const schema = {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
      additionalProperties: false,
    };
    const fetchFn: typeof fetch = (url, init) => {
      assertEquals(
        String(url),
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      );
      assertEquals(
        new Headers(init?.headers).get("Authorization"),
        "Bearer test-gemini",
      );
      assertEquals(init?.method, "POST");
      assertEquals(init?.signal instanceof AbortSignal, true);
      const body = JSON.parse(String(init?.body));
      assertEquals(body.model, "custom-flash");
      assertEquals(body.response_format, {
        type: "json_schema",
        json_schema: { name: "review", schema, strict: true },
      });
      assertEquals(body.reasoning_effort, "low");
      assertEquals(body.max_tokens, 4096);
      assertEquals(body.max_completion_tokens, undefined);
      assertStringIncludes(body.messages[0].content, "tuteo");
      assertEquals(body.messages[1], { role: "user", content: "datos" });
      return Promise.resolve(success("  explicación  "));
    };
    assertEquals(
      await gemini("datos", fetchFn, {
        jsonSchema: { name: "review", schema },
        reasoningEffort: "low",
        maxCompletionTokens: 4096,
      }),
      "explicación",
    );
  });
});

Deno.test("Gemini usa Flash predeterminado sin modelo configurable", async () => {
  await withKeys({ GEMINI_API_KEY: "test" }, async () => {
    await gemini("datos", (_url, init) => {
      assertEquals(JSON.parse(String(init?.body)).model, DEFAULT_GEMINI_MODEL);
      return Promise.resolve(success());
    });
  });
});

Deno.test("Gemini sin clave falla como configuración sin tocar la red", async () => {
  await withKeys({}, async () => {
    const error = await assertRejects(() =>
      gemini("datos", () => {
        throw new Error("No debe llamar");
      }), LlmError);
    assertEquals(error.code, "configuration");
  });
});

Deno.test("Gemini clasifica configuración, red, timeout, formato y truncamiento sin revelar cuerpos", async () => {
  await withKeys(BOTH, async () => {
    const cases: [() => Promise<Response>, string][] = [
      [
        () => Promise.resolve(new Response("private", { status: 401 })),
        "configuration",
      ],
      [
        () => Promise.resolve(new Response("private", { status: 403 })),
        "configuration",
      ],
      [
        () => Promise.resolve(new Response("private", { status: 404 })),
        "configuration",
      ],
      [
        () =>
          Promise.resolve(
            Response.json({
              error: {
                details: [{ reason: "API_KEY_INVALID" }],
                message: "private",
              },
            }, { status: 400 }),
          ),
        "configuration",
      ],
      [
        () => Promise.resolve(new Response("private", { status: 500 })),
        "upstream",
      ],
      [() => Promise.reject(new TypeError("private")), "upstream"],
      [
        () => Promise.reject(new DOMException("private", "TimeoutError")),
        "timeout",
      ],
      [
        () => Promise.reject(new DOMException("private", "AbortError")),
        "timeout",
      ],
      [() => Promise.resolve(new Response("private")), "invalid_response"],
      [() => Promise.resolve(Response.json(null)), "invalid_response"],
      [
        () => Promise.resolve(Response.json({ choices: [] })),
        "invalid_response",
      ],
      [() => Promise.resolve(success("  ")), "invalid_response"],
      [
        () =>
          Promise.resolve(
            Response.json({
              choices: [{
                finish_reason: "length",
                message: { content: "partial" },
              }],
            }),
          ),
        "invalid_response",
      ],
    ];
    for (const [fetchFn, code] of cases) {
      const error = await assertRejects(
        () => gemini("datos", fetchFn),
        LlmError,
      );
      assertEquals(error.code, code);
      assertEquals(error.message.includes("private"), false);
    }
  });
});

Deno.test("Gemini respeta Retry-After numérico, fecha y espera predeterminada de 60 s", async () => {
  await withKeys(BOTH, async () => {
    for (
      const [header, expected] of [["12.2", 13], [undefined, 60], [
        "invalid",
        60,
      ], ["0", 1]] as const
    ) {
      const error = await assertRejects(
        () => gemini("datos", () => Promise.resolve(limited(header))),
        LlmError,
      );
      assertEquals(error.code, "rate_limit");
      assertEquals(error.retryAfterSeconds, expected);
    }
    const future = new Date(Date.now() + 30_000).toUTCString();
    const error = await assertRejects(
      () => gemini("datos", () => Promise.resolve(limited(future))),
      LlmError,
    );
    assertEquals(
      error.retryAfterSeconds! >= 29 && error.retryAfterSeconds! <= 30,
      true,
    );
  });
});

for (const preferred of ["groq", "gemini"] as const) {
  Deno.test(`Enrutamiento ${preferred}: éxito no consulta al respaldo`, async () => {
    await withKeys(BOTH, async () => {
      const calls: string[] = [];
      assertEquals(
        await createExplanationGenerator()("datos", (url) => {
          calls.push(String(url));
          return Promise.resolve(success());
        }, { preferredProvider: preferred }),
        "Respuesta",
      );
      assertEquals(calls.length, 1);
      assertStringIncludes(
        calls[0],
        preferred === "groq" ? "api.groq.com" : "googleapis.com",
      );
    });
  });
  Deno.test(`Enrutamiento ${preferred}: 429 usa al otro y conserva prompt y esquema`, async () => {
    await withKeys(BOTH, async () => {
      const calls: string[] = [];
      const fetchFn: typeof fetch = (url, init) => {
        calls.push(String(url));
        const body = JSON.parse(String(init?.body));
        assertEquals(body.messages[1].content, "datos verificados");
        assertEquals(body.response_format.json_schema.strict, true);
        assertEquals(body.reasoning_effort, "low");
        assertEquals(body.max_tokens ?? body.max_completion_tokens, 2048);
        return Promise.resolve(
          calls.length === 1 ? limited("30") : success("respaldo"),
        );
      };
      assertEquals(
        await createExplanationGenerator()("datos verificados", fetchFn, {
          preferredProvider: preferred,
          reasoningEffort: "low",
          maxCompletionTokens: 2048,
          jsonSchema: { name: "review", schema: { type: "object" } },
        }),
        "respaldo",
      );
      assertEquals(calls.length, 2);
      assertStringIncludes(
        calls[0],
        preferred === "groq" ? "api.groq.com" : "googleapis.com",
      );
      assertStringIncludes(
        calls[1],
        preferred === "groq" ? "googleapis.com" : "api.groq.com",
      );
    });
  });
}

Deno.test("Enrutamiento predeterminado de chat/plan prefiere Groq", async () => {
  await withKeys(BOTH, async () => {
    await createExplanationGenerator()("datos", (url) => {
      assertStringIncludes(String(url), "api.groq.com");
      return Promise.resolve(success());
    });
  });
});

Deno.test("Enrutamiento funciona con solo Groq, solo Gemini o sin proveedores", async () => {
  for (const provider of ["groq", "gemini"] as const) {
    await withKeys({
      [provider === "groq" ? "GROQ_API_KEY" : "GEMINI_API_KEY"]: "test",
    }, async () => {
      let calls = 0;
      await createExplanationGenerator()("datos", (url) => {
        calls++;
        assertStringIncludes(
          String(url),
          provider === "groq" ? "api.groq.com" : "googleapis.com",
        );
        return Promise.resolve(success());
      }, { preferredProvider: provider === "groq" ? "gemini" : "groq" });
      assertEquals(calls, 1);
    });
  }
  await withKeys({}, async () => {
    const error = await assertRejects(
      () =>
        createExplanationGenerator()("datos", () => {
          throw new Error("No debe llamar");
        }),
      LlmError,
    );
    assertEquals(error.code, "configuration");
  });
});

Deno.test("Ambas cuotas: espera mínima compartida, sin llamadas durante Retry-After y recuperación", async () => {
  await withKeys(BOTH, async () => {
    let now = 0;
    const generate = createExplanationGenerator(() => now);
    const calls: string[] = [];
    const fetchFn: typeof fetch = (url) => {
      calls.push(String(url));
      return Promise.resolve(
        limited(String(url).includes("groq") ? "60" : "20"),
      );
    };
    const error = await assertRejects(
      () => generate("datos", fetchFn),
      LlmError,
    );
    assertEquals(error.retryAfterSeconds, 20);
    assertEquals(calls.length, 2);
    now = 5000;
    const waiting = await assertRejects(
      () => generate("mapa", fetchFn, { preferredProvider: "gemini" }),
      LlmError,
    );
    assertEquals(waiting.retryAfterSeconds, 15);
    assertEquals(calls.length, 2);
    now = 20_000;
    await generate("datos", (url) => {
      assertStringIncludes(String(url), "googleapis.com");
      return Promise.resolve(success());
    });
    now = 60_000;
    await generate("datos", (url) => {
      assertStringIncludes(String(url), "api.groq.com");
      return Promise.resolve(success());
    });
  });
});

Deno.test("Errores permanentes no disparan respaldo; fallo del respaldo conserva clasificación", async () => {
  await withKeys(BOTH, async () => {
    for (const status of [401, 400]) {
      let calls = 0;
      const error = await assertRejects(
        () =>
          createExplanationGenerator()("datos", () => {
            calls++;
            return Promise.resolve(new Response(null, { status }));
          }),
        LlmError,
      );
      assertEquals(error.code, status === 401 ? "configuration" : "upstream");
      assertEquals(calls, 1);
    }
    let calls = 0;
    const error = await assertRejects(
      () =>
        createExplanationGenerator()("datos", () => {
          calls++;
          return calls === 1
            ? Promise.resolve(limited("60"))
            : Promise.reject(new DOMException("Timeout", "TimeoutError"));
        }),
      LlmError,
    );
    assertEquals(error.code, "timeout");
    assertEquals(calls, 2);
  });
});

Deno.test("Mapa integrado prefiere Gemini, rechaza lotes incompletos y respalda en Groq ante cuota", async () => {
  await withKeys(BOTH, async () => {
    const originalFetch = globalThis.fetch;
    const input = {
      teamId: 100,
      durationSeconds: 1200,
      queueId: 420,
      patchVersion: "16.20",
      composition: [],
      champion: "Ahri",
      role: "MIDDLE",
      win: false,
      kills: 1,
      deaths: 1,
      assists: 0,
      metrics: {},
      events: [{
        timestamp: 100000,
        kind: "death" as const,
        position: { x: 5000, y: 5000 },
      }],
    };
    const review = {
      event_0: {
        assessment: "context",
        title: "Revisa tu compra",
        explanation:
          "Antes de disputar, compara tus recursos con los del rival.",
        alternativeTitle: "",
        advice: "",
        action: "none",
      },
    };
    const calls: string[] = [];
    try {
      globalThis.fetch = (url, init) => {
        calls.push(String(url));
        const body = JSON.parse(String(init?.body));
        assertEquals(body.response_format.json_schema.schema.required, [
          "event_0",
        ]);
        assertEquals(body.response_format.json_schema.strict, true);
        return Promise.resolve(success(JSON.stringify(review)));
      };
      const result = await explainMapMoments(input);
      assertStringIncludes(calls[0], "googleapis.com");
      assertEquals(result.observations[0].eventIndex, 0);
      assertEquals(result.progress, { evaluated: 1, total: 1, complete: true });
      globalThis.fetch = () => Promise.resolve(success("{}"));
      await assertRejects(
        () => explainMapMoments(input),
        LlmError,
        "todos los eventos",
      );
      calls.length = 0;
      globalThis.fetch = (url) => {
        calls.push(String(url));
        return Promise.resolve(
          calls.length === 1 ? limited("30") : success(JSON.stringify(review)),
        );
      };
      assertEquals((await explainMapMoments(input)).progress.complete, true);
      assertEquals(calls.length, 2);
      assertStringIncludes(calls[0], "googleapis.com");
      assertStringIncludes(calls[1], "api.groq.com");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

for (const preferred of ["gemini", "groq"] as const) {
  Deno.test(`Respaldo ${preferred}: 503, red y timeout permiten continuar con el otro proveedor`, async () => {
    await withKeys(BOTH, async () => {
      const failures: (() => Promise<Response>)[] = [
        () => Promise.resolve(new Response(null, { status: 503 })),
        () => Promise.resolve(new Response(null, { status: 500 })),
        () => Promise.resolve(new Response(null, { status: 408 })),
        () => Promise.reject(new TypeError("network unavailable")),
        () => Promise.reject(new DOMException("timeout", "TimeoutError")),
      ];
      for (const failure of failures) {
        const calls: string[] = [];
        const result = await createExplanationGenerator()("datos", (url) => {
          calls.push(String(url));
          return calls.length === 1
            ? failure()
            : Promise.resolve(success("respaldo disponible"));
        }, { preferredProvider: preferred });
        assertEquals(result, "respaldo disponible");
        assertEquals(calls.length, 2);
        assertStringIncludes(
          calls[0],
          preferred === "gemini" ? "googleapis.com" : "api.groq.com",
        );
        assertStringIncludes(
          calls[1],
          preferred === "gemini" ? "api.groq.com" : "googleapis.com",
        );
      }
    });
  });
}
Deno.test("503 en ambos proveedores mantiene error recuperable sin llamadas recursivas", async () => {
  await withKeys(BOTH, async () => {
    let calls = 0;
    const error = await assertRejects(
      () =>
        createExplanationGenerator()("datos", () => {
          calls++;
          return Promise.resolve(new Response(null, { status: 503 }));
        }),
      LlmError,
    );
    assertEquals(calls, 2);
    assertEquals(error.code, "upstream");
    assertEquals(error.status, 503);
  });
});
