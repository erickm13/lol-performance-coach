# Diseño: Detección de debilidades y plan de entrenamiento semanal

**Fecha:** 2026-09-18
**Estado:** Aprobado para implementación

## 1. Contexto y objetivo

`docs/propuesta.md` define como objetivo específico 3: "Construir un motor de detección de debilidades recurrentes basado en reglas, y un componente de generación de recomendaciones explicadas mediante un modelo de lenguaje, ancladas a las métricas calculadas." Es el núcleo de valor del proyecto — hoy las tablas `weaknesses`, `training_plans`, `training_plan_items` y `plan_progress` existen en el schema pero no las llena nada, y el dashboard solo muestra texto de relleno ("Cuando vincules tu cuenta, vamos a analizar...").

Este documento diseña ese motor.

## 2. Decisiones ya tomadas (con el usuario)

- **LLM:** Gemini (API key gratuita de la universidad), no Claude como decía la propuesta original — decisión justificada por costo real (el usuario no tiene tarjeta para la API de Anthropic). El rol arquitectónico es el mismo: el LLM solo redacta la explicación en lenguaje natural, anclada a métricas ya calculadas por el motor de reglas. El motor de reglas nunca depende de Gemini para decidir qué está mal.
- **Muertes tempranas (`deaths_before_10`):** se implementa de verdad, agregando una llamada nueva al endpoint de timeline de Riot durante la ingesta (hasta ahora ese campo quedaba siempre `null`).
- **Disparo de detección:** automático, dentro de `syncRiotAccount`/`linkRiotAccount`, inmediatamente después de ingerir partidas. Barato — solo lee datos ya guardados, no llama a Riot ni a Gemini.
- **Disparo de generación de plan:** manual, vía botón/endpoint aparte. Si ya existe un plan `active` para la semana actual, no se regenera — se devuelve el existente.
- **Mínimo de partidas:** 10 (el máximo que el sistema guarda hoy). Con menos, la detección no corre.
- **Sin cola de trabajos:** el diagrama original de arquitectura proponía Redis/BullMQ para el análisis en background, pero el código real nunca lo conectó (`ingestMatches` ya corre síncrono dentro del request). Este feature sigue el mismo patrón: todo síncrono dentro del request de sync/generación de plan, sin infraestructura nueva.

## 3. Motor de reglas (`backend/src/analysis/weaknesses.ts`)

Función pura: recibe las filas de `match_participants` + `match_metrics` de una cuenta (últimas 10 partidas) y devuelve las debilidades detectadas. No llama a Riot ni a Gemini — 100% determinístico y testeable con fixtures.

Cinco reglas, una por cada valor del enum `category` que ya define `modelo-entidad-relacion.md`:

| category | Métrica evaluada | Se dispara si (promedio de las 10 partidas) | Severidad |
|---|---|---|---|
| `farming` | `cs_per_min` | < 6.0 | alta <4.0, media <5.0, baja <6.0 |
| `vision` | `vision_score_per_min` | < 0.8 | alta <0.4, media <0.6, baja <0.8 |
| `consistency` | coeficiente de variación del KDA (`stddev(kda)/mean(kda)`) | > 0.6 | alta >1.0, media >0.8, baja >0.6 |
| `objectives` | `kill_participation` | < 0.5 | alta <0.3, media <0.4, baja <0.5 |
| `early_game` | `deaths_before_10` | > 1.0 | alta >2.0, media >1.5, baja >1.0 |

Para cada regla que se dispara:
- `description`: texto en español generado por plantilla, citando el valor real (ej. "Tu CS/min promedio es 5.2, por debajo del umbral recomendado de 6.0").
- `evidence`: los `match_metrics.id` de las 3 peores partidas para esa métrica (no las 10 — la evidencia debe ser específica, no "todas").
- `severity`: según la tabla de arriba.

**Semántica de re-detección:** cada corrida de detección **reemplaza** las filas de `weaknesses` de esa cuenta (`delete` + `insert`) — una debilidad es "el estado actual", no un historial acumulado. Esto coincide con cómo el modelo de datos la describe: "un patrón a través de varias partidas", reevaluado en cada ventana.

## 4. Timeline de Riot y `deaths_before_10`

`backend/src/riot/client.ts` gana una función nueva:

```ts
getMatchTimeline(matchId: string, fetchFn = fetch): Promise<RiotMatchTimeline>
```

Llama a `GET /lol/match/v5/matches/{matchId}/timeline` (ruteo continental, igual que match detail). La respuesta trae `info.frames[].events[]`; los eventos `CHAMPION_KILL` tienen `victimId` (el `participantId` 1-10 dentro de esa partida, no el `puuid`) y `timestamp` en milisegundos.

`RiotMatchParticipant` (el tipo ya existente) gana el campo `participantId: number` — ya viene en el JSON crudo de Riot, solo faltaba declararlo. En `ingestMatches`, después de identificar `participant` (nuestro jugador) por `puuid`, se guarda su `participantId`, se pide el timeline, y se cuentan los eventos `CHAMPION_KILL` con `victimId === participant.participantId` y `timestamp < 600_000`.

**Manejo de errores:** si el timeline de una partida puntual falla (404, rate limit, lo que sea), esa partida sigue guardándose con `deaths_before_10: null` — igual que el resto del pipeline ya tolera fallos parciales por partida sin abortar todo el sync. No se reintenta.

**Costo:** duplica las llamadas a Riot por partida nueva (antes 1 por partida — el detalle —, ahora 2 — detalle + timeline). Con el máximo de 10 partidas por sync, son hasta 20 llamadas adicionales, dentro de los límites de una API key de desarrollo personal.

## 5. Generación del plan (`backend/src/analysis/trainingPlan.ts`)

Input: las `weaknesses` actuales de la cuenta (ya detectadas) + `championStats` (la agregación que ya existe de la feature de Champion Stats).

1. Calcula `week_start`/`week_end` de la semana actual (lunes a domingo, hora del servidor).
2. Si ya hay un `training_plans` con `status = 'active'` cuyo rango cubre hoy → lo devuelve tal cual, no genera nada nuevo.
3. Si no hay plan activo para esta semana:
   - Toma hasta 3 debilidades ordenadas por severidad (alta primero). Por cada una, arma un ítem `focus_area` (qué patrón trabajar) y un ítem `drill` (ejercicio concreto — plantilla fija por categoría, ej. para `vision`: "Practicá colocar wards de control cada vez que vuelvas a base durante 3 partidas normales").
   - Mira `championStats`: si hay un campeón con ≥3 partidas y winrate <45%, agrega un ítem `champion_avoid`; si hay uno con ≥3 partidas y winrate ≥55%, agrega `champion_priority`. Máximo 1 de cada uno.
   - Si no se detectó ninguna debilidad (cuenta con buen desempeño): el plan se arma solo con los ítems de campeón si existen; si tampoco hay eso, no se crea plan — la API devuelve `{ plan: null, message: "No se detectaron patrones para mejorar esta semana." }`.
4. Para cada ítem, se le pide a Gemini que redacte `llm_explanation`: un prompt por ítem, con el `description`/métricas de esa debilidad puntual como único contexto permitido, instruyendo explícitamente a no inventar causas fuera de esos datos.
5. **Si Gemini falla (sin key, error de red, timeout, respuesta vacía) en cualquier ítem del plan:** todo el plan cae a modo solo-reglas — `llm_explanation` de cada ítem pasa a ser la misma `description` de la debilidad (sin redacción adicional), y `training_plans.generated_by = 'rules'` en vez de `'llm'`. Es todo-o-nada por plan, para no mezclar ítems con y sin IA en el mismo plan.
6. Inserta `training_plans` + `training_plan_items`.

### Cliente de Gemini (`backend/src/analysis/gemini.ts`)

Mismo patrón de inyección de dependencias que `riot/client.ts` (`fetchFn = fetch` como parámetro, para poder testear sin red). Llama a la API de Google Generative Language (`generativelanguage.googleapis.com`, modelo `gemini-2.0-flash` configurable) vía `GEMINI_API_KEY`. Si la variable de entorno no está seteada, la función lanza y el llamador cae al fallback descrito arriba — mismo patrón que `RIOT_API_KEY`/`RESEND_API_KEY` ya usan.

## 6. Endpoints nuevos (`backend/src/routes/training.ts`)

Archivo nuevo (separa las preocupaciones: `riot.ts` sigue siendo solo vinculación/sync de la cuenta; `training.ts` es análisis/plan). Se monta en `app.ts` bajo el mismo prefijo que ya usa todo lo demás:

```ts
app.route("/riot", riotRoutes);
app.route("/riot", trainingRoutes); // mismo prefijo, archivo separado
```

Seguimos la convención ya establecida (`/riot/...`, autenticación por cookie de sesión, sin IDs de cuenta en la URL):

- `GET /riot/weaknesses` → `{ weaknesses: [...] }`
- `GET /riot/training-plan` → `{ plan: {...} | null, items: [...] }`
- `POST /riot/training-plan` → genera (o devuelve el existente) — mismo shape que el GET
- `POST /riot/training-plan/items/:itemId/progress` → body `{ selfRating?, note? }`, inserta en `plan_progress`, devuelve el ítem actualizado

## 7. Testing

- `weaknesses.test.ts`: cada regla con fixtures (partidas que sí/no disparan cada categoría, casos límite de severidad).
- `trainingPlan.test.ts`: generación con Gemini mockeado (camino feliz y fallback), idempotencia (no duplica plan si ya hay uno activo), caso sin debilidades.
- `gemini.test.ts`: cliente con `fetchFn` inyectado, sin llamadas reales.
- Tests de las rutas nuevas siguiendo el patrón de `ai.test.ts` (auth requerida, shape de la respuesta).

## 8. Frontend

Dos páginas nuevas reales (dejan de ser maqueta): `/dashboard/debilidades` y `/dashboard/plan`, mismo sistema visual hextech ya establecido. El Dashboard recupera los dos teasers ("Debilidad más urgente" / "Plan de esta semana") que se habían sacado antes, ahora con datos reales, enlazando a estas páginas. La página de plan tiene checkboxes reales conectados a `POST /riot/training-plan/items/:itemId/progress`.

## 9. Fuera de alcance de esta entrega

- Reevaluación automática de un plan a mitad de semana.
- Autoevaluación (`self_rating`)/nota como UI dedicada — el endpoint los acepta, pero la UI inicial solo marca completado/no completado.
- Comparación reglas vs. LLM vs. ML propio (explícitamente fuera de alcance en la propuesta).
