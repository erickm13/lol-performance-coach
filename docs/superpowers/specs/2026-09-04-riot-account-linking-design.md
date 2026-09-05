# Diseño: vinculación de cuenta de Riot + últimas partidas en el dashboard

> Contexto de producto (alcance, objetivos, riesgos): [docs/propuesta.md](../../propuesta.md)
> Arquitectura lógica y flujo end-to-end: [docs/arquitectura.md](../../arquitectura.md)
> Modelo de datos completo: [docs/modelo-entidad-relacion.md](../../modelo-entidad-relacion.md)
> Autenticación (ya implementada): [2026-09-04-authentication-design.md](2026-09-04-authentication-design.md)

Segunda feature de negocio real, construida sobre auth. Un usuario logueado vincula su cuenta de League of Legends (Riot ID `gameName#tagLine`) y ve sus últimas partidas en el dashboard. Las tablas `riot_accounts`, `ingestion_jobs`, `matches`, `match_participants` y `match_metrics` ya existen en el MER original pero ningún código las usa todavía — este documento es el primero en darles uso real.

## Objetivo

Un usuario puede escribir su Riot ID, el sistema busca la cuenta en la API de Riot, guarda la vinculación, trae sus últimas 10 partidas, calcula métricas básicas por partida, y las muestra en el dashboard. También puede volver a sincronizar sin re-vincular.

## Decisiones y justificación

### Sin verificación de dueño (no Riot Sign-On)

Vincular es simplemente: el usuario escribe un Riot ID, buscamos el PUUID por `account-v1`, lo guardamos. **No verifica que quien vincula sea realmente el dueño de esa cuenta de Riot** — cualquiera podría escribir el Riot ID de otra persona. La verificación real requiere Riot Sign-On (OAuth), ya fuera de alcance en `arquitectura.md`. Mitigación parcial: `riot_accounts.puuid` es único a nivel de toda la tabla (no por usuario), así que una vez que un PUUID está vinculado a un usuario, ningún otro usuario puede "robárselo" — pero el primero en vincularlo no necesariamente es su dueño real. Limitación conocida, aceptada para esta entrega.

### Ingesta síncrona, no por cola

`ingestion_jobs` sugiere un patrón de cola (`pending`→`running`→`done`/`error`), y `arquitectura.md` menciona Redis/BullMQ para esto. Para esta entrega se ejecuta todo **sincrónicamente dentro del mismo request** de vincular/sincronizar — no se monta infraestructura de cola nueva. Igual se crea una fila real en `ingestion_jobs` (arranca en `running`, termina en `done` o `error` al final del mismo request) para que la tabla tenga uso real y el enganche a una cola futura sea reemplazar una llamada directa por un `enqueue(...)`, no un cambio de arquitectura. Con ~10 partidas son ~13 llamadas a Riot por vinculación — muy por debajo de los límites de la key de desarrollo (20 req/1s, 100 req/2min), así que no hace falta un limitador de tasa real, solo llamadas secuenciales (no en paralelo).

### Solo la fila del jugador vinculado, no los 10 participantes

El MER original modela `match_participants` con las 10 filas por partida (`matches ||--o{ match_participants : "contiene 10"`). Para esta entrega se guarda **solo la fila del usuario vinculado** por partida — es lo único necesario para "tus últimas partidas". Guardar los 10 jugadores completos (necesario para comparaciones individual-vs-equipo futuras) queda para cuando se construya la ingesta real con más alcance. `match_participants.riot_account_id` es nullable precisamente para permitir cargar después las otras 9 filas sin dueño identificado.

### `deaths_before_10` queda nullable, sin calcular todavía

Esa métrica requiere el endpoint de **timeline** de la partida (`/lol/match/v5/matches/{matchId}/timeline`), una llamada adicional por partida con parseo de eventos `CHAMPION_KILL` contra el timestamp de los primeros 10 minutos — duplicaría casi las llamadas a Riot por vinculación. Se pospone: la columna `match_metrics.deaths_before_10` pasa de `not null` a nullable (migración pequeña), y queda `null` hasta que se implemente la ingesta real con timeline. El resto de métricas (KDA, cs/min, visión/min, oro/min, daño/min, kill participation) se calculan igual desde el resumen de la partida, sin timeline.

### Región fija: LAN (`la1`)

Se acota a una sola plataforma para esta entrega — el usuario juega en LAN. `account-v1` y `match-v5` usan el routing continental `americas` (el mismo para LAN/LAS/NA); solo `summoner-v4` necesita el routing de plataforma (`la1`), que queda hardcodeado como constante. Agregar más regiones después es agregar un mapeo de plataforma→continente y un selector en el form, no un cambio de arquitectura.

### Un solo módulo para el cliente de Riot

`backend/src/riot/client.ts` agrupa las 4 llamadas necesarias (cuenta por Riot ID, invocador por puuid, ids de últimas partidas, detalle de partida), mismo patrón que `backend/src/email/resend.ts` (un archivo por integración externa). `backend/src/riot/ingest.ts` separado contiene la lógica de orquestación/mapeo a la base — mantiene el cliente HTTP libre de lógica de negocio, testeable por separado.

### Verificación de forma real de la API antes de escribir el mapeo

Este documento describe la forma esperada de las respuestas de Riot a partir de su documentación pública, pero el plan de implementación debe incluir un paso temprano que haga una llamada real contra la API (con la key del usuario) e imprima la respuesta cruda, para confirmar nombres de campo exactos antes de escribir el código de mapeo — la documentación de terceros puede quedar desactualizada y un nombre de campo mal supuesto fallaría silenciosamente (`undefined` en vez de un error claro).

## Cambios de esquema (Drizzle)

Un solo cambio: `match_metrics.deaths_before_10` pasa de `integer(...).notNull()` a `integer(...)` (nullable). Ninguna otra tabla cambia — todo lo demás ya existe tal cual en el MER original.

## Endpoints del backend

Todos bajo `backend/src/routes/riot.ts`, montados en `app.ts` con prefijo `/riot`. Todos requieren sesión activa (mismo mecanismo de cookie que `/auth/me`).

```
POST /riot/link   { gameName, tagLine }   → 201 { account, matches } | 400 | 404 | 409 | 502
POST /riot/sync                            → 200 { account, matches } | 404 (no vinculado) | 502
GET  /riot/account                         → 200 { account: null } | 200 { account, matches }
```

**`POST /riot/link`:** valida `gameName`/`tagLine` no vacíos (400 si faltan). Valida que el usuario no tenga ya una cuenta vinculada (409 si sí — un usuario, una cuenta de Riot, en esta entrega). Busca el PUUID vía `account-v1`. Si no existe, 404. Si el PUUID ya está vinculado a otro usuario, 409. Si todo bien: busca invocador (ícono/nivel) vía `summoner-v4`, inserta `riot_accounts`, crea fila `ingestion_jobs` (`status="running"`, `matches_requested=10`), trae las últimas 10 partidas y las guarda (ver "Flujo de ingesta" abajo), marca el job `done` (o `error` con el mensaje si algo falla a mitad de camino — pero conserva las partidas que sí se llegaron a guardar). Responde con la cuenta vinculada y las partidas guardadas.

**`POST /riot/sync`:** igual que `link` pero sin el paso de buscar cuenta/invocador — usa el `puuid` ya guardado en `riot_accounts` para este usuario. 404 si el usuario no tiene cuenta vinculada. Trae las últimas 10 partidas de nuevo; las que ya existen (`riot_match_id` único) no se duplican — se actualiza su `match_participants`/`match_metrics` si cambió algo, se insertan las nuevas.

**`GET /riot/account`:** de solo lectura, no llama a Riot — devuelve lo que ya está guardado (`account: null` si no hay vinculación). Es lo que el dashboard consulta al cargar.

**Errores de Riot mapeados a respuestas propias:**
- Riot devuelve 404 (Riot ID no existe) → nuestra API responde 404 con `{ error: "No encontramos esa cuenta de Riot" }`.
- Riot devuelve 403 (API key inválida o vencida — las keys de desarrollo expiran cada 24hs) → nuestra API responde 502 con `{ error: "No pudimos conectar con Riot. La clave de API puede haber expirado." }`.
- Riot devuelve 429 (rate limit) → se corta la ingesta ahí, se guardan las partidas ya obtenidas, el job queda `error` con un mensaje que indica cuántas partidas se alcanzaron a guardar, y la respuesta al frontend es 502 con ese detalle.

## Flujo de ingesta (`riot/ingest.ts`)

1. Buscar últimas 10 `matchId` vía `match-v5` (`/matches/by-puuid/{puuid}/ids?count=10`).
2. Para cada `matchId` (secuencial, no en paralelo):
   a. Si ya existe una fila en `match_participants` para este `matchId` y este `riotAccountId`, saltar esta partida — ya está guardada (esto es lo que evita duplicar al sincronizar).
   b. Si no, pedir el detalle vía `match-v5` (`/matches/{matchId}`) — siempre se pide, incluso si la fila en `matches` ya existe (creada por otra vinculación que comparte esta partida), porque igual hace falta el detalle completo para extraer el participante de este usuario.
   c. Si no existe una fila en `matches` con ese `riot_match_id`, insertarla (`riotMatchId`, `patchVersion` = `info.gameVersion`, `queueId` = `info.queueId`, `gameCreation` = `new Date(info.gameCreation)`, `gameDurationSeconds` = `info.gameDuration`); si ya existe, reutilizar su `id`.
   d. Encontrar el participante cuyo `puuid` coincide con el de la cuenta vinculada dentro de `info.participants`.
   e. Insertar `match_participants`: `champion` = `championName`, `role` = `teamPosition`, `teamId`, `win`, `kills`, `deaths`, `assists`, `csTotal` = `totalMinionsKilled + neutralMinionsKilled`, `visionScore`, `goldTotal` = `goldEarned`, `damageTotal` = `totalDamageDealtToChampions`, `rawStats` = el objeto participante completo (jsonb, red de seguridad para agregar métricas futuras sin volver a pedirle a Riot).
   f. Calcular e insertar `match_metrics`: `csPerMin` = `csTotal / (gameDurationSeconds/60)`, `kda` = `(kills+assists) / max(deaths,1)`, `visionScorePerMin` = `visionScore / (gameDurationSeconds/60)`, `goldPerMin` = `goldTotal / (gameDurationSeconds/60)`, `damagePerMin` = `damageTotal / (gameDurationSeconds/60)`, `killParticipation` = calculado manualmente (kills+assists del jugador ÷ kills totales de su equipo en la partida, sumando los `kills` de todos los participantes de ese `teamId` en `info.participants` — no depender de un campo `challenges.*` de Riot sin confirmar antes que existe con ese nombre exacto), `deathsBefore10` = `null`.
3. Si Riot devuelve 429 a mitad del loop: cortar ahí, devolver lo ya guardado con un contador de cuántas partidas se procesaron.

## Frontend

**`RiotAccountCard`** (nuevo componente, vive en el dashboard):
- Al montar, llama `GET /riot/account`.
- Si `account` es `null`: muestra un form (`gameName` + `tagLine`, dos inputs o uno solo separado por `#`) que llama `POST /riot/link`. Mientras corre (puede tardar unos segundos por las 10 llamadas a Riot), muestra estado de carga explícito ("Buscando tus partidas..."), no un spinner genérico sin texto.
- Si `account` existe: muestra ícono de invocador + nivel + `gameName#tagLine` + región, y debajo la lista de últimas partidas (campeón, victoria/derrota, KDA, cs/min) más un botón "Actualizar partidas" que llama `POST /riot/sync`.
- El ítem "Vincular tu cuenta de Riot Games" de la sección "Próximos pasos" existente se marca como cumplido una vez que hay cuenta vinculada (chequeo visual, sin quitar el ítem).

**Manejo de errores:** igual que las pantallas de auth — la petición a `/riot/link`/`/riot/sync` va en `try/catch/finally`, un fallo de red muestra el mismo tipo de mensaje genérico que ya usan los otros forms.

## Variables de entorno nuevas

```
RIOT_API_KEY=
```

Real, secreta, gitignorada — igual que `RESEND_API_KEY`. A diferencia de esa, las keys de desarrollo de Riot **expiran cada 24 horas**; se documenta en el README que hay que regenerarla periódicamente durante el desarrollo.

## Testing

**Backend:** el cliente de Riot (`riot/client.ts`) recibe el `fetch` inyectado (mismo patrón de dependencia que `AuthEmailDeps` en las rutas de auth) para que los tests no dependan de la red real ni de una key válida. Casos a cubrir en `riot/ingest.ts`: vinculación exitosa con partidas nuevas, Riot ID inexistente (404), puuid ya vinculado a otro usuario (409), 403 de Riot (key inválida/vencida) mapeado a 502, 429 a mitad de la ingesta (se guarda lo parcial), sync no duplica partidas ya guardadas. Rutas: un test de integración por status code igual que en `auth.test.ts`.

**Frontend:** `RiotAccountCard` con fetch mockeado — sin vincular (muestra el form), vinculado con partidas (muestra la lista), error de vinculación (Riot ID no encontrado), fallo de red.

## Definición de "hecho" para esta entrega

- `POST /riot/link`, `POST /riot/sync`, `GET /riot/account` responden según lo descrito, con tests pasando (cliente de Riot mockeado).
- Migración aplicada para `match_metrics.deaths_before_10` nullable.
- El dashboard muestra el form de vinculación si no hay cuenta, o la cuenta + últimas partidas si ya está vinculada, con el botón de actualizar funcionando.
- Verificación manual con la key real del usuario: vincular una cuenta real de LAN, confirmar que las partidas guardadas coinciden con las del cliente de LoL o op.gg.

## Fuera de alcance de este documento

- Riot Sign-On / verificación de dueño real de la cuenta.
- Soporte multi-región (solo LAN por ahora).
- Guardar los 10 participantes por partida (solo la fila del usuario vinculado).
- `deaths_before_10` vía timeline.
- Motor de reglas, detección de debilidades, plan de entrenamiento, cohortes — todo lo que consume estas métricas queda para entregas futuras.
- Cola de ingesta real (Redis/BullMQ) — la ejecución es síncrona dentro del request.
- Rate limiting propio — se confía en que el volumen (una vinculación a la vez, ~13 llamadas) queda cómodo bajo los límites de la key de desarrollo.
