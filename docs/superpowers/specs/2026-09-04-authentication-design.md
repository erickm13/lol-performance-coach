# Diseño: autenticación (registro, login, verificación de email, recuperación de contraseña)

> Contexto de producto (alcance, objetivos, riesgos): [docs/propuesta.md](../../propuesta.md)
> Arquitectura lógica y flujo end-to-end: [docs/arquitectura.md](../../arquitectura.md)
> Modelo de datos completo: [docs/modelo-entidad-relacion.md](../../modelo-entidad-relacion.md)
> Scaffolding del repo (ya implementado): [2026-09-04-repo-scaffolding-design.md](2026-09-04-repo-scaffolding-design.md)

Esta es la primera feature de negocio real construida sobre el walking skeleton. `docs/arquitectura.md` ya preveía `POST /auth/register` y `POST /auth/login`; este documento cubre el diseño completo de auth: esos dos endpoints más logout, verificación de email y recuperación de contraseña.

## Objetivo

Un usuario puede registrarse con email/contraseña, verificar su email, iniciar y cerrar sesión, y recuperar su contraseña si la olvida. Esto habilita todo lo que depende de "hay un usuario logueado" (vincular cuenta de Riot, ver su dashboard, etc.), que queda fuera de este documento.

## Decisiones y justificación

### Sesión: JWT en cookie httpOnly

Se evaluó frente a sesiones con estado en Redis. Se eligió JWT porque no requiere código nuevo de sesión en Redis (hoy el contenedor existe pero nada lo usa) y el backend se mantiene sin estado. La cookie es `httpOnly` (el frontend nunca toca el token directamente, mitiga XSS), `secure` solo en producción (en dev es HTTP plano), y `sameSite=lax`. Expira a las 2 horas; sin "recordarme" persistente en esta entrega.

**Trade-off aceptado:** al no haber estado en el servidor, un JWT emitido antes de un cambio de contraseña sigue siendo válido hasta que expire (máximo 2 horas). Se documenta como limitación conocida, no se resuelve ahora — resolverlo requeriría una lista de invalidación (Redis) o volver a sesiones con estado, que es más alcance del que esta entrega necesita.

### Tokens de verificación/recuperación: tabla `auth_tokens`

Se evaluó frente a tokens autocontenidos (JWT firmados, sin persistencia). Se prefirió una tabla porque de todos modos hace falta trackear "usado" para que un link no se pueda reusar, así que el ahorro de no tener tabla es ilusorio; con la tabla además se pueden invalidar tokens viejos cuando se pide uno nuevo del mismo tipo.

### Hash de contraseñas: bcryptjs

Se prefirió sobre `bcrypt` nativo porque este último requiere compilación de bindings nativos, lo cual ya causó problemas de compatibilidad en el Dockerfile del frontend durante el scaffolding (SIGSEGV en Alpine, resuelto agregando `libc6-compat`). `bcryptjs` es una implementación pura en JavaScript, sin ese riesgo, a costa de ser más lenta — aceptable para el volumen de usuarios de este proyecto.

### Envío de email: Resend

El usuario ya tiene una cuenta creada. Se usa el dominio de pruebas `onboarding@resend.dev` (sin necesidad de verificar un dominio propio) para los dos correos transaccionales: verificación de email y recuperación de contraseña.

### CORS: de `*` a origen explícito con credentials

El middleware CORS del backend (`backend/src/app.ts`) hoy permite cualquier origen (`cors()` sin config, agregado para resolver el bug de la demo de `/health`). Cookies cross-origin requieren `credentials: true` en el server, lo cual es incompatible con `origin: '*'`. Se cambia a `origin: <URL del frontend>, credentials: true`.

## Cambios de esquema (Drizzle)

- `users`: se agrega columna `email_verified` (`boolean`, `not null`, `default(false)`).
- Tabla nueva `auth_tokens`:
  | Columna | Tipo | Notas |
  |---|---|---|
  | `id` | `uuid` PK | `defaultRandom()` |
  | `user_id` | `uuid` FK → `users.id` | `not null` |
  | `type` | `text` | `'email_verification'` \| `'password_reset'` |
  | `token` | `text` | único, random (32 bytes, base64url) |
  | `expires_at` | `timestamp with tz` | `not null` |
  | `used_at` | `timestamp with tz` | nullable |
  | `created_at` | `timestamp with tz` | `defaultNow()` |

Al generar un token nuevo de un `type` para un `user_id`, se marcan `used_at = now()` los tokens previos de ese mismo `type` y usuario que sigan sin usar — evita que queden varios links "vivos" a la vez.

`docs/modelo-entidad-relacion.md` se actualiza para documentar esta tabla y columna nuevas (extiende las 10 tablas originales, no las modifica).

## Endpoints del backend

Todos bajo `backend/src/routes/auth.ts`, montados en `app.ts` con prefijo `/auth`.

```
POST /auth/register        { email, password }              → 201
POST /auth/login           { email, password }               → 200, set-cookie
POST /auth/logout                                             → 200, clear-cookie
GET  /auth/me               (requiere cookie)                 → 200 | 401
POST /auth/verify-email    { token }                          → 200 | 400
POST /auth/forgot-password { email }                          → 200 (siempre, exista o no el email)
POST /auth/reset-password  { token, newPassword }              → 200 | 400
```

**Flujo de registro:** crea `users` row (`email_verified=false`, `password_hash` con bcryptjs), genera `auth_tokens` tipo `email_verification`, envía email con link `${FRONTEND_URL}/verify-email?token=...` vía Resend.

**Flujo de login:** valida email/password contra `password_hash`. Si son válidos, firma un JWT (`hono/jwt`, payload `{ sub: userId }`, secret `JWT_SECRET`) y lo setea en cookie. **No bloquea el login si `email_verified=false`** — el response incluye `emailVerified` para que el frontend pueda mostrar un aviso, en vez de trabar el acceso.

**Flujo de verificación:** busca el token en `auth_tokens` con `type='email_verification'`, `used_at IS NULL`, `expires_at > now()`. Si existe, marca `users.email_verified=true` y el token como usado. Si no, 400 con mensaje genérico ("token inválido o expirado").

**Flujo de recuperación:** `forgot-password` genera un token `password_reset` y envía el email — responde 200 exista o no el email, para no permitir enumerar usuarios registrados por este medio. `reset-password` valida el token igual que la verificación, actualiza `password_hash`, marca el token usado.

**Validación de entrada:** email con formato válido, password mínimo 8 caracteres. Se valida en el backend (la única fuente de verdad); el frontend replica la validación solo para dar feedback inmediato, no como control real.

## Frontend (Next.js)

Rutas nuevas bajo `frontend/app/`:

- `/login` — formulario email + password. POST a `/auth/login` con `credentials: 'include'`. Éxito → redirige a `/dashboard`.
- `/register` — formulario email + password + confirmar password. POST a `/auth/register`. Éxito → mensaje "revisá tu correo para verificar tu cuenta" (no loguea automáticamente).
- `/verify-email` — lee `token` de query string, llama a `/auth/verify-email` al montar, muestra éxito o error.
- `/forgot-password` — formulario de email. POST a `/auth/forgot-password`, muestra confirmación genérica siempre.
- `/reset-password` — lee `token` de query string, formulario de nueva contraseña. POST a `/auth/reset-password`.
- `/dashboard` — placeholder protegido. Al montar llama `GET /auth/me` con `credentials: 'include'`; si 401 redirige a `/login`; si 200 muestra `"Hola, {email}"` + botón de logout (`POST /auth/logout` → redirige a `/login`).

La página `/` (home) no cambia — sigue mostrando el `HealthStatus` de la demo del scaffolding, sin relación con auth.

**Estilo:** tarjeta centrada sobre fondo oscuro, un solo formulario por pantalla, sin botones de login social (eso es Riot Sign On, fuera de esta entrega). Reutiliza Tailwind ya configurado.

## Variables de entorno nuevas

`.env.example` se extiende con:

```
JWT_SECRET=
RESEND_API_KEY=
FRONTEND_URL=http://localhost:3000
```

`JWT_SECRET` y `RESEND_API_KEY` son secretos reales — se generan/obtienen fuera del repo y solo viven en `.env` local (gitignorado) y en la configuración de CI/producción cuando corresponda.

## Testing

**Backend** (`deno test`): registro (éxito, email duplicado), login (credenciales válidas/inválidas), `GET /auth/me` (con cookie válida, sin cookie, con JWT expirado), verificación de email (token válido, inválido, ya usado, expirado), forgot-password (email existente, email inexistente — mismo 200 en ambos), reset-password (token válido/inválido, password se actualiza). El envío de email se mockea — los tests no deben depender de la red ni de la cuenta real de Resend.

**Frontend** (Vitest): cada formulario renderiza, valida campos requeridos, y llama al endpoint correcto en submit (fetch mockeado, igual que `HealthStatus.test.tsx` ya hace).

## Definición de "hecho" para esta entrega

- Los 7 endpoints de `/auth/*` responden según lo descrito arriba, con tests pasando.
- Las 5 pantallas de frontend existen y el flujo completo es recorrible a mano: registrarse → recibir email real (vía Resend) → verificar → loguearse → ver `/dashboard` → cerrar sesión → recuperar contraseña → loguearse con la nueva.
- CI (`lint` + `test` + `build`, backend y frontend) sigue en verde.
- `docs/modelo-entidad-relacion.md` documenta `auth_tokens` y `users.email_verified`.

## Fuera de alcance de este documento

- Login social / Riot Sign On.
- Recordarme / sesiones persistentes más allá de 2 horas.
- Invalidación de JWT antes de su expiración natural (ver trade-off aceptado arriba).
- Rate limiting de intentos de login o de reenvío de emails.
- Roles/permisos — todo usuario autenticado tiene el mismo nivel de acceso por ahora.
- Cualquier pantalla o endpoint más allá de auth (dashboard real, vinculación de cuenta de Riot, etc.) — es la siguiente entrega, no esta.
