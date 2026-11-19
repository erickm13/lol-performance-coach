# Modelo Entidad-Relación

> Alcance: solo League of Legends, motor de reglas + LLM. Ver [propuesta.md](propuesta.md) y [arquitectura.md](arquitectura.md) para el contexto completo.

## Diagrama

```mermaid
erDiagram
    users ||--o| player_profiles : "personaliza"
    users ||--o{ riot_accounts : "vincula"
    users ||--o{ auth_tokens : "genera"
    users ||--o| live_draft_connections : "conecta el cliente"
    riot_accounts ||--o{ ingestion_jobs : "dispara"
    riot_accounts ||--o{ training_plans : "recibe"
    riot_accounts ||--o{ weaknesses : "acumula"
    matches ||--o{ match_participants : "participantes vinculados"
    match_participants ||--o| match_metrics : "tiene"
    match_participants ||--o{ match_teammates : "jugó con"
    riot_accounts ||--o{ match_participants : "identifica cuál es el jugador seguido"
    training_plans ||--o{ training_plan_items : "contiene"
    training_plan_items ||--o{ plan_progress : "se marca"

    users {
        uuid id PK
        text email UK "normalizado: sin espacios y en minúsculas"
        text password_hash
        boolean email_verified
        timestamptz created_at
    }
    player_profiles {
        uuid user_id PK,FK
        text primary_role
        text secondary_role
        jsonb champions
        text experience
        jsonb improvement_areas
        jsonb target_roles
        int weekly_minutes "nullable"
        text university_name "nullable"
        text university_key "nullable"
        boolean ranking_visible "false por defecto"
        boolean onboarding_completed
        timestamptz updated_at
    }
    auth_tokens {
        uuid id PK
        uuid user_id FK
        text type "email_verification|password_reset"
        text token UK
        timestamptz expires_at
        timestamptz used_at "nullable, null = sin usar"
        timestamptz created_at
    }
    riot_accounts {
        uuid id PK
        uuid user_id FK
        text puuid UK "id único de Riot"
        text summoner_name
        text tag_line
        text region
        text primary_role "opcional, acota alcance"
        text analysis_version
        int profile_icon_id "nullable"
        int summoner_level "nullable"
        text solo_tier "nullable, null = sin rango Solo/Dúo"
        text solo_rank "nullable, I-IV"
        int solo_lp "nullable"
        int solo_wins "nullable"
        int solo_losses "nullable"
        timestamptz rank_updated_at "nullable"
        timestamptz linked_at
    }
    ingestion_jobs {
        uuid id PK
        uuid riot_account_id FK
        text status "pending|running|done|error"
        int matches_requested
        int matches_ingested
        timestamptz started_at
        timestamptz finished_at
        text error
    }
    matches {
        uuid id PK
        text riot_match_id UK
        text patch_version
        int queue_id
        timestamptz game_creation "clave para analisis por horario"
        int game_duration_seconds
        jsonb raw_detail "caché del detalle Match-V5"
        jsonb raw_timeline "caché del timeline Match-V5"
    }
    match_participants {
        uuid id PK
        uuid match_id FK
        uuid riot_account_id FK "null si es un teammate/rival no vinculado"
        text puuid
        text champion
        text role
        int team_id
        bool win
        int kills
        int deaths
        int assists
        int cs_total
        int vision_score
        int gold_total
        int damage_total
        jsonb raw_stats "resto de campos crudos de la API, por si se necesitan despues"
    }
    match_teammates {
        uuid id PK
        uuid match_participant_id FK
        text puuid
        text summoner_name
        int profile_icon_id "nullable"
        bool win
    }
    match_metrics {
        uuid id PK
        uuid match_participant_id FK,UK
        float cs_per_min
        float kda
        float vision_score_per_min
        int deaths_before_10
        float gold_per_min
        float damage_per_min
        float kill_participation
        jsonb extra "metricas nuevas y caché del análisis del mapa"
    }
    weaknesses {
        uuid id PK
        uuid riot_account_id FK
        text category "early_game|vision|farming|objectives|consistency"
        text description
        text severity "low|medium|high"
        jsonb evidence "ids de match_participants que sustentan el hallazgo"
        timestamptz detected_at
    }
    training_plans {
        uuid id PK
        uuid riot_account_id FK
        date week_start
        date week_end
        text status "active|closed"
        text generated_by "rules|llm"
    }
    training_plan_items {
        uuid id PK
        uuid training_plan_id FK
        int position "orden de presentación, 0-indexado"
        text type "focus_area|drill|champion_priority|champion_avoid"
        text title
        text description
        text llm_explanation "texto generado por el LLM (Groq + Gemini), anclado a evidence"
        jsonb evidence_metric_refs
    }
    plan_progress {
        uuid id PK
        uuid training_plan_item_id FK
        timestamptz completed_at
        int self_rating "1-5, opcional"
        text note
    }
    live_draft_connections {
        uuid user_id PK,FK
        text token_hash UK "hash del token del cliente, nunca el token"
        timestamptz expires_at
        timestamptz received_at "nullable, última instantánea recibida"
        jsonb snapshot "nullable, selección de campeones en vivo"
    }
```

## Diccionario de datos

### `users`
Cuenta de la aplicación (no confundir con la cuenta de Riot).

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| email | text, único | Login. Se guarda sin espacios y en minúsculas; al registrarse se valida el formato y que el dominio tenga servidor de correo (MX) |
| password_hash | text | Hash de contraseña (nunca texto plano) |
| email_verified | boolean | Si confirmó su email vía el link de verificación |
| created_at | timestamptz | Alta del usuario |

### `player_profiles`
Preferencias del jugador para personalizar el coaching y su participación en el ranking. Relación 1 a 1 con `users` (`ON DELETE CASCADE`).

| Campo | Tipo | Descripción |
|---|---|---|
| user_id | uuid, PK, FK → users.id | Dueño del perfil |
| primary_role / secondary_role | text, nullable | Roles declarados |
| champions | jsonb | Campeones habituales |
| experience | text, nullable | Experiencia autodeclarada |
| improvement_areas | jsonb | Objetivos de mejora elegidos |
| target_roles | jsonb | Roles que quiere practicar |
| weekly_minutes | int, nullable | Tiempo semanal disponible para practicar |
| university_name / university_key | text, nullable | Universidad declarada y su clave normalizada (filtro del ranking) |
| ranking_visible | boolean | Si acepta aparecer en el ranking; empieza en falso |
| onboarding_completed | boolean | Si terminó el cuestionario inicial |
| updated_at | timestamptz | Última modificación |

### `auth_tokens`
Tokens de un solo uso para verificación de email y recuperación de contraseña. Al generar uno nuevo de un `type` para un usuario, se invalidan (`used_at = now()`) los anteriores del mismo `type` que sigan sin usar.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| user_id | uuid, FK → users.id | Dueño del token |
| type | text | `email_verification` \| `password_reset` |
| token | text, único | Valor random enviado por email |
| expires_at | timestamptz | A partir de cuándo deja de ser válido |
| used_at | timestamptz, nullable | Cuándo se consumió (null = todavía válido) |
| created_at | timestamptz | Cuándo se generó |

### `riot_accounts`
Cuenta de League of Legends vinculada a un usuario. Un usuario podría vincular más de una (multi-cuenta), por eso es una tabla aparte y no columnas en `users`.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| user_id | uuid, FK → users.id | Dueño de la cuenta vinculada |
| puuid | text, único | Identificador estable de Riot (no cambia si el jugador cambia de nombre) |
| summoner_name / tag_line | text | Nombre visible actual |
| region | text | Servidor (LAN, NA, etc.) — necesario para las llamadas a la API |
| primary_role | text, nullable | Rol principal declarado, usado para acotar el alcance de análisis |
| analysis_version | text | Versión de las reglas con que se calcularon sus debilidades; si cambia, se recalculan |
| profile_icon_id / summoner_level | int, nullable | Icono y nivel de invocador, para mostrarlos |
| solo_tier / solo_rank / solo_lp | text/text/int, nullable | Rango Solo/Dúo (liga, división y LP); null si no tiene rango en esa cola |
| solo_wins / solo_losses | int, nullable | Victorias y derrotas de la temporada en Solo/Dúo |
| rank_updated_at | timestamptz, nullable | Cuándo se consultó el rango a Riot por última vez |
| linked_at | timestamptz | Fecha de vinculación |

### `ingestion_jobs`
Registro de cada corrida de ingesta (para trazabilidad y para que el dashboard muestre progreso/errores).

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador del job |
| riot_account_id | uuid, FK | Cuenta para la que se ingesta |
| status | text | `pending`, `running`, `done`, `error` |
| matches_requested / matches_ingested | int | Control de cuántas partidas se pidieron vs. se lograron procesar |
| started_at / finished_at | timestamptz | Duración del job |
| error | text, nullable | Detalle si falló (rate limit, timeout, etc.) |

### `matches`
Una partida, deduplicada por `riot_match_id` — si dos jugadores vinculados coincidieron en la misma partida, no se duplica la fila.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| riot_match_id | text, único | Identificador de Riot para la partida |
| patch_version | text | Parche en el que se jugó (para versionar heurísticas del motor de reglas) |
| queue_id | int | Tipo de cola (Ranked Solo/Duo, etc.) |
| game_creation | timestamptz | Timestamp de inicio — base para el análisis por horario/día |
| game_duration_seconds | int | Duración de la partida |
| raw_detail | jsonb, nullable | Detalle completo de Riot, incluidos ambos equipos; caché para consulta del detalle |
| raw_timeline | jsonb, nullable | Timeline de Riot; permite consultar eventos sin nuevas llamadas |

### `match_participants`
En esta implementación se guarda una fila por jugador vinculado que haya ingerido la partida, con sus métricas normalizadas. Los demás jugadores se conservan en `matches.raw_detail` para mostrar ambos equipos; `match_teammates` guarda el resumen de los compañeros. El esquema permite agregar participantes sin cuenta vinculada más adelante.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| match_id | uuid, FK | Partida a la que pertenece |
| riot_account_id | uuid, FK, nullable | Si es el jugador seguido por la plataforma; null si es teammate/rival |
| puuid | text | Identificador de Riot de ese participante (aunque no esté vinculado) |
| champion / role / team_id | text/int | Datos de composición |
| win | bool | Resultado de su equipo |
| kills/deaths/assists/cs_total/vision_score/gold_total/damage_total | int | Estadísticas crudas de la API |
| raw_stats | jsonb | Resto de campos que la API devuelve y que hoy no se explotan, por si hacen falta después |

### `match_teammates`
Compañeros de equipo del jugador seguido en cada partida. Alimenta la sección de compañeros recientes del dashboard (con quién juega más y cuánto gana con cada uno) sin tener que leer `matches.raw_detail`.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| match_participant_id | uuid, FK → match_participants.id | Participación del jugador seguido |
| puuid | text | Identificador de Riot del compañero |
| summoner_name | text | Nombre visible del compañero en esa partida |
| profile_icon_id | int, nullable | Icono del compañero |
| win | bool | Resultado de la partida |

### `match_metrics`
KPIs derivados, calculados a partir de `match_participants` — separado de la tabla anterior para no mezclar "dato crudo de la API" con "dato calculado por nosotros" (son ciclos de vida distintos: si cambia una fórmula, se recalcula esta tabla sin re-ingerir nada).

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| match_participant_id | uuid, FK, único | Participante al que pertenece (1 a 1) |
| cs_per_min / kda / vision_score_per_min / deaths_before_10 / gold_per_min / damage_per_min / kill_participation | float/int | KPIs definidos en el objetivo específico 2 |
| extra | jsonb | Métricas nuevas que se agreguen sin migrar el esquema; también guarda la caché del análisis del mapa (`mapInsights`) |

### `weaknesses`
Debilidad recurrente detectada por el motor de reglas, agregada a nivel de cuenta (no de una sola partida).

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| riot_account_id | uuid, FK | Cuenta a la que aplica |
| category | text | `early_game`, `vision`, `farming`, `objectives`, `consistency` |
| description | text | Descripción generada por el motor de reglas |
| severity | text | `low`/`medium`/`high` |
| evidence | jsonb | Lista de `match_participants.id` que sustentan el hallazgo; la API resuelve únicamente evidencia de la cuenta propia |
| detected_at | timestamptz | Cuándo se detectó |

### `training_plans` / `training_plan_items` / `plan_progress`
El plan semanal, sus ítems accionables, y el registro de cumplimiento que cierra el ciclo diagnóstico → plan → práctica → reevaluación.

| Tabla | Campo | Tipo | Descripción |
|---|---|---|---|
| training_plans | id | uuid, PK | Identificador del plan |
| training_plans | riot_account_id | uuid, FK | Dueño del plan |
| training_plans | week_start / week_end | date | Ventana que cubre |
| training_plans | status | text | `active`/`closed` |
| training_plans | generated_by | text | `rules`/`llm`, para trazabilidad de qué motor lo generó |
| training_plan_items | id | uuid, PK | Identificador del ítem |
| training_plan_items | training_plan_id | uuid, FK | Plan al que pertenece |
| training_plan_items | position | int | Orden de presentación (0-indexado): cada `drill` queda junto a su `focus_area` y se respeta la prioridad por severidad |
| training_plan_items | type | text | `focus_area`/`drill`/`champion_priority`/`champion_avoid` |
| training_plan_items | title / description | text | Contenido del ítem |
| training_plan_items | llm_explanation | text | Texto generado por el LLM (Groq + Gemini), anclado a `evidence_metric_refs` |
| training_plan_items | evidence_metric_refs | jsonb | Identificadores de participantes heredados de la evidencia del hallazgo |
| plan_progress | id | uuid, PK | Identificador del registro |
| plan_progress | training_plan_item_id | uuid, FK | Ítem que se está marcando |
| plan_progress | completed_at | timestamptz | Cuándo se marcó cumplido |
| plan_progress | self_rating | int, nullable | Autoevaluación 1-5 |
| plan_progress | note | text, nullable | Comentario libre del usuario |

### `live_draft_connections`
Conexión del cliente de escritorio que envía la selección de campeones en vivo (migración 0010). Una por usuario, revocable y con caducidad de 12 horas; al volver a emparejar se reemplaza. No guarda secretos del cliente de LoL.

| Campo | Tipo | Descripción |
|---|---|---|
| user_id | uuid, PK, FK → users.id | Dueño de la conexión (`ON DELETE CASCADE`) |
| token_hash | text, único | Hash del token que usa el cliente; el token en claro solo se muestra al emparejar |
| expires_at | timestamptz | Caducidad del emparejamiento |
| received_at | timestamptz, nullable | Última instantánea recibida; si tiene menos de 20 s se considera conectado |
| snapshot | jsonb, nullable | Última selección recibida, verificada por el servidor |

## Decisiones de normalización

- **`match_participants` vs. `match_metrics` separadas**: dato crudo vs. dato calculado tienen ciclos de vida distintos (recalcular una fórmula no debería requerir re-ingerir la partida).
- **`weaknesses` es independiente de una partida puntual**: una debilidad es un patrón a través de varias partidas, no pertenece a una sola fila de `match_metrics` — por eso referencia varias vía el campo `evidence`.
- **Sin tabla intermedia entre `match_participants` y `riot_accounts`**: es una FK directa nullable, porque la relación es 1 a muchos simple (una cuenta aparece en muchas partidas; un participante de una partida es a lo sumo una cuenta vinculada).
- **Columnas `jsonb` de escape** (`raw_stats`, `extra`, `evidence`, `evidence_metric_refs`) en vez de tablas EAV: para un modelo con un conjunto de métricas conocido y acotado (alcance de un solo juego), columnas fijas + un escape jsonb es más simple de consultar que un modelo Entidad-Atributo-Valor completo, que se justificaría más si soportaran múltiples juegos con métricas muy distintas entre sí.


### Perfil y actualización del rango (migración 0009)

`player_profiles.user_id` es PK y FK a `users.id` con `ON DELETE CASCADE`. El perfil persiste al desvincular Riot y desaparece al eliminar al usuario. Las listas de campeones/objetivos/roles son JSONB acotadas y validadas en el servidor; experiencia es autodeclarada. Universidad normaliza nombres conocidos y admite nombre libre; no se considera verificada. `ranking_visible` controla publicación voluntaria y empieza en falso. No se publican correo, objetivos ni experiencia.

`riot_accounts.analysis_version` permite recalcular referencias por rol de cuentas existentes sin borrar historial. `rank_updated_at` se actualiza cuando Riot devuelve el rango al vincular o sincronizar; no se inventa una fecha para registros antiguos. [Contratos y recorrido](perfil-academia-comunidad.md).
