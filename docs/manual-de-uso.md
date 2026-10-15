# Manual de uso — LoL Performance Coach

Guía para instalar, levantar y usar la plataforma de análisis de rendimiento y
generación de planes de entrenamiento para League of Legends.

## 1. Requisitos previos

| Herramienta | Versión | Para qué |
|---|---|---|
| Docker + Docker Compose | reciente | Levantar todo (postgres + backend + frontend) |
| Deno | >= 2.0 | Solo si corres el backend fuera de Docker |
| Node.js | >= 20 | Solo si corres el frontend fuera de Docker |

Además necesitas estas credenciales externas:

| Variable | Dónde obtenerla | Obligatoria |
|---|---|---|
| `RIOT_API_KEY` | Portal de desarrolladores de Riot Games (https://developer.riotgames.com) | Sí, para ingesta de partidas |
| `GROQ_API_KEY` | Consola de Groq (https://console.groq.com) | Sí, para la explicación del plan por LLM |
| `RESEND_API_KEY` | Resend (https://resend.com) | Sí, para enviar correos de verificación/reset |
| `JWT_SECRET` | Cadena aleatoria larga que generas tú | Sí, firma las sesiones |

> Si el LLM falla o no hay `GROQ_API_KEY`, el plan **igual se genera** en modo solo-reglas (sin la explicación en lenguaje natural).

## 2. Configuración

Desde la raíz del repositorio:

```bash
cp .env.example .env
```

Edita `.env` y completa las claves vacías (`GROQ_API_KEY`, `RIOT_API_KEY`,
`JWT_SECRET`, `RESEND_API_KEY`). Las demás variables ya traen valores válidos
para desarrollo local.

## 3. Levantar el proyecto con Docker (recomendado)

```bash
docker compose up -d --build
```

Esto levanta cuatro servicios: `postgres`, `redis`, `backend` y `frontend`.

- **Frontend:** http://localhost:3000
- **Backend (health check):** http://localhost:8000/health → `{"status":"ok","db":"connected"}`

Para detener todo:

```bash
docker compose down
```

## 4. Levantar sin Docker (desarrollo)

### Backend

```bash
cd backend
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5433/lol_analytics
deno task db:generate   # genera migraciones desde el schema
deno task db:migrate    # aplica migraciones
deno task dev           # arranca en modo watch
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 5. Recorrido de usuario (flujo completo)

1. **Registro.** Abre http://localhost:3000, ve a *Registrarse* y crea una cuenta con correo y contraseña.
2. **Verificación de correo.** Recibes un correo (vía Resend) con un enlace; al abrirlo se confirma tu cuenta en la pantalla *verify-email*.
3. **Inicio de sesión.** Entra con tus credenciales. La sesión se mantiene con una cookie firmada (JWT).
4. **Vincular cuenta de Riot.** En el dashboard, en la tarjeta de cuenta de Riot, introduce tu Riot ID. Al vincular, el sistema ejecuta la **ingesta inicial** de tus partidas recientes de forma síncrona.
5. **Dashboard.** Verás tus partidas recientes y los *teasers* de debilidades y del plan.
6. **Debilidades detectadas** (`/dashboard/debilidades`). El motor de reglas lista tus debilidades recurrentes ordenadas por severidad (p. ej. muertes antes del minuto 10, CS bajo, visión).
7. **Plan de entrenamiento semanal** (`/dashboard/plan`). A partir de las debilidades, el sistema genera un plan con focos de mejora, drills y campeones a priorizar o limitar. Cada ítem trae una explicación en lenguaje natural generada por el LLM y anclada a la métrica concreta que la sustenta.
8. **Marcar progreso.** Marca los ítems del plan que vas cumpliendo; el progreso se guarda y persiste entre recargas.
9. **Re-sincronizar.** Cuando juegues más partidas, usa *sincronizar* para traer las nuevas y reevaluar debilidades y plan.
10. **Chat de coach (IA).** El widget de chat flotante responde preguntas sobre tu rendimiento, anclado a tus métricas reales.

## 6. Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `/health` devuelve `db: disconnected` | Postgres no está listo | Espera unos segundos o revisa `docker compose logs postgres` |
| No llegan los correos | Falta o es inválida `RESEND_API_KEY` | Revisa la clave en `.env` |
| El plan no trae explicación en texto | `GROQ_API_KEY` ausente/ inválida o el LLM falló | El plan funciona igual en modo solo-reglas; revisa la clave para recuperar la explicación |
| La ingesta falla | `RIOT_API_KEY` vencida (las de desarrollo caducan cada 24 h) o Riot ID inválido | Renueva la clave en el portal de Riot |

## 7. Pruebas

```bash
cd backend && deno task test     # 93 tests
cd frontend && npm test          # 26 tests
```

Ver el detalle en [evidencias-de-pruebas.md](evidencias-de-pruebas.md).
