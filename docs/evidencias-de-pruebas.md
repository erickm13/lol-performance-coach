# Evidencias de pruebas — LoL Performance Coach

Este documento recoge la evidencia de que el sistema está cubierto por pruebas
automatizadas y que todas pasan. La suite se ejecuta en cada *push* y *pull
request* mediante integración continua (GitHub Actions).

## Verificación actual: Gemini + Groq (2026-10-15)

- Corrección previa publicada en `ff0431e`: [CI backend y frontend verde](https://github.com/erickm13/lol-performance-coach/actions/runs/38853503068).
- Integración validada localmente: **113 pruebas backend + 46 frontend = 159, sin fallos**. Frontend: lint y build de 96 páginas correctos; backend: lint, tipos, generación de esquema, migraciones y suite completa con PostgreSQL desechable mediante `bash backend/scripts/check-ci.sh`.
- `llm.test.ts`: 17 pruebas sin red para contrato Gemini (Authorization, JSON Schema estricto, razonamiento y límite de salida), errores, orden y respaldo en ambos sentidos, un solo proveedor, ausencia de claves, cuotas simultáneas, espera compartida y recuperación. Incluye el mapa real con eventos sintéticos, rechazo de un lote incompleto y respaldo en Groq.
- Chat y generación del plan incluyen pruebas de integración con respuestas HTTP simuladas: Groq → Gemini ante 429; si ambos agotan cuota, chat mantiene su 429 y el plan conserva sus ítems en modo solo-reglas. Las pruebas de configuración desactivan ambas claves para evitar llamadas externas.
- **Prueba real sintética de Gemini satisfactoria:** `gemini-3.8-flash`, endpoint compatible con OpenAI, Bearer, `response_format: json_schema` con `strict: true`, `reasoning_effort: low` y límite `max_tokens`. Se validó el objeto JSON esperado sin enviar datos de jugadores ni guardar la clave o la respuesta del proveedor.
- Regresión del mapa corregida: respaldo también ante 503/otros 5xx, 408, red y timeout; claves inválidas/HTTP 400 y respuestas inválidas no disparan respaldo. `useMatchInsights.test.ts` comprueba la carga continua y la conservación/reanudación de progreso con caché v5; el frontend ya no rechaza la revisión de preferencias por exigir v4. Verificación real del endpoint de la partida reportada: HTTP 200, versión 5, **24/24 eventos evaluados y análisis completo**, guardado en PostgreSQL.
- Estas pruebas no sustituyen la revisión de partidas reales, el acompañante de Windows ni la validación visual del navegador.

## Referencia histórica anterior

- **Commit evaluado:** `60689b9` (rama `main`).
- **Resultado:** **119 pruebas, 0 fallos** (93 backend + 26 frontend).
- **Ejecución de CI (verde):** https://github.com/erickm13/lol-performance-coach/actions/runs/38645499380

## 1. Integración continua

El workflow `.github/workflows/ci.yml` corre dos trabajos en paralelo:

- **backend:** levanta un PostgreSQL de servicio, y ejecuta `deno task lint`,
  `deno task db:generate`, `deno task db:migrate` y `deno task test`.
- **frontend:** ejecuta `npm install`, `npm run lint`, `npm test` y `npm run build`.

Un *merge* a `main` solo procede si ambos trabajos están en verde.

## 2. Backend — 93 pruebas (Deno)

```
Task test deno test -A
running 5 tests from ./tests/ai.test.ts
running 12 tests from ./tests/auth.test.ts
running 1 test from ./tests/db.test.ts
running 9 tests from ./tests/groq.test.ts
running 3 tests from ./tests/health.test.ts
running 3 tests from ./tests/jwt.test.ts
running 3 tests from ./tests/password.test.ts
running 1 test from ./tests/resend.test.ts
running 4 tests from ./tests/riot-stats.test.ts
running 3 tests from ./tests/riot-timeline.test.ts
running 3 tests from ./tests/schema.test.ts
running 5 tests from ./tests/tokens.test.ts
running 14 tests from ./tests/training-routes.test.ts
running 14 tests from ./tests/trainingPlan.test.ts
running 13 tests from ./tests/weaknesses.test.ts
ok | 93 passed | 0 failed (4s)
```

### Qué cubre cada suite

| Suite | Pruebas | Qué valida |
|---|---|---|
| `auth.test.ts` | 12 | Registro, login, logout, sesión y endpoints protegidos |
| `tokens.test.ts` | 5 | Generación y validación de tokens de verificación/reset |
| `jwt.test.ts` | 3 | Firma y verificación del token de sesión (round-trip, expiración) |
| `password.test.ts` | 3 | Hash y verificación de contraseñas |
| `riot-stats.test.ts` | 4 | Cliente de estadísticas de la Riot API |
| `riot-timeline.test.ts` | 3 | Cliente de timeline y conteo de muertes antes del minuto 10 |
| `weaknesses.test.ts` | 13 | Motor de reglas: detección de debilidades, severidad y selección de evidencia |
| `trainingPlan.test.ts` | 14 | Generación del plan: fallback parcial, presupuestos de ítems, casos vacíos |
| `training-routes.test.ts` | 14 | Endpoints de debilidades/plan y propiedad (ownership) de los recursos |
| `groq.test.ts` | 9 | Cliente del LLM: manejo de errores, timeout, respuesta vacía, fallback |
| `ai.test.ts` | 5 | Endpoint de chat del coach anclado a métricas |
| `resend.test.ts` | 1 | Envío de correos |
| `schema.test.ts` | 3 | Integridad del esquema de base de datos |
| `db.test.ts` | 1 | Conexión y migraciones |
| `health.test.ts` | 3 | Endpoint `/health` |

## 3. Frontend — 26 pruebas (Vitest + Testing Library)

```
 RUN  v2.1.9

 ✓ tests/HealthStatus.test.tsx (1 test)
 ✓ tests/WeaknessesList.test.tsx (2 tests)
 ✓ tests/VerifyEmailStatus.test.tsx (2 tests)
 ✓ tests/DashboardTeasers.test.tsx (2 tests)
 ✓ tests/TrainingPlanView.test.tsx (5 tests)
 ✓ tests/ResetPasswordForm.test.tsx (3 tests)
 ✓ tests/ForgotPasswordForm.test.tsx (2 tests)
 ✓ tests/LoginForm.test.tsx (2 tests)
 ✓ tests/LogoutButton.test.tsx (2 tests)
 ✓ tests/RegisterForm.test.tsx (2 tests)
 ✓ tests/DashboardContent.test.tsx (3 tests)

 Test Files  11 passed (11)
      Tests  26 passed (26)
```

Cubren el renderizado y la interacción de los formularios de autenticación
(registro, login, logout, recuperación y reseteo de contraseña), la
verificación de correo, el estado de salud, y las vistas del dashboard:
debilidades, plan de entrenamiento (incluida la marca de progreso) y los
*teasers*.

### Build de producción del frontend

`npm run build` compila sin errores y genera 12 rutas estáticas:

```
Route (app)
┌ ○ /
├ ○ /dashboard
├ ○ /dashboard/debilidades
├ ○ /dashboard/plan
├ ○ /forgot-password
├ ○ /login
├ ○ /register
├ ○ /reset-password
└ ○ /verify-email
✓ Compiled successfully
```

## 4. Cómo reproducir localmente

```bash
# Backend (requiere un PostgreSQL accesible vía DATABASE_URL)
cd backend
deno task db:migrate
deno task test

# Frontend
cd frontend
npm install
npm test
npm run build
```
