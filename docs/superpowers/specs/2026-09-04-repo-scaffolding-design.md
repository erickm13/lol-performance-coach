# Diseño: scaffolding inicial del repositorio

> Contexto de producto (alcance, objetivos, riesgos): [docs/propuesta.md](../../propuesta.md)
> Arquitectura lógica y flujo end-to-end: [docs/arquitectura.md](../../arquitectura.md)
> Modelo de datos completo: [docs/modelo-entidad-relacion.md](../../modelo-entidad-relacion.md)

Este documento cubre únicamente las decisiones de **scaffolding**: cómo se organiza el repositorio, qué herramientas concretas se usan, y qué se considera "hecho" para la primera entrega de código. No repite las decisiones de producto/arquitectura ya acordadas en los documentos de arriba.

## Objetivo

Levantar un **esqueleto funcional** (walking skeleton): la estructura del monorepo, el tooling de cada parte, y un circuito mínimo verificable de punta a punta (frontend → backend → base de datos) antes de construir features reales. Esto prueba que la arquitectura decidida realmente conecta, en vez de descubrir problemas de integración después de haber construido varias features sobre una base rota.

## Decisiones y justificación

### Monorepo

Un solo repositorio con `/frontend` y `/backend`. Se prefirió sobre repos separados porque el equipo es chico, el proyecto se despliega como una unidad (docker-compose en una sola instancia EC2), y separar repos solo agrega fricción de sincronización sin beneficio real a este alcance. Nada impide partir el backend a otro repo más adelante si hiciera falta.

### Backend: Deno + Hono + Drizzle

- **Deno**: ya decidido en `arquitectura.md` (sin dependencia de un stack ML pesado en Python para esta entrega, TypeScript de punta a punta con el frontend).
- **Hono** como framework HTTP: se evaluó frente a Oak (el framework "clásico" de Deno, estilo Express) y se prefirió Hono por ser más liviano, tener mejor inferencia de tipos en rutas/params/body, y ser portable entre runtimes (Deno/Node/Bun/Cloudflare Workers) — útil si más adelante cambia el destino de despliegue.
- **Drizzle ORM** sobre PostgreSQL: se evaluó frente a SQL crudo (`deno-postgres`) y Prisma. SQL crudo pierde chequeo de tipos y obliga a mantener migraciones a mano. Prisma corre su motor como binario nativo/WASM aparte, lo que históricamente da fricción bajo Deno. Drizzle es un query builder tipado (si conocen SQL, ya saben usar Drizzle), el esquema se define como código TypeScript que mapea 1:1 con las tablas de `modelo-entidad-relacion.md`, y `drizzle-kit` genera migraciones SQL revisables y versionadas — evidencia útil para el documento técnico.

### Frontend: Next.js (App Router) + TypeScript + Tailwind

Ya decidido en `arquitectura.md`. Tailwind se agrega ahora como decisión de scaffolding: es el estándar de facto para un dashboard construido con Next.js, y evita tener que diseñar un sistema de estilos desde cero para una entrega de curso.

### Orquestación local: Docker Compose

Cuatro servicios: `postgres`, `redis`, `backend`, `frontend`. Cada uno con su propio `Dockerfile` dentro de su carpeta; `docker-compose.yml` en la raíz del repo los levanta juntos. Esto es deliberadamente lo mismo que se usaría en la instancia EC2 de producción — desarrollar con el mismo compose que se despliega reduce sorpresas de "funciona en mi máquina".

### CI: GitHub Actions

Un workflow que en cada push/PR corre lint + test de frontend y backend. Sin despliegue automático todavía — se agrega cuando exista la instancia EC2 y se decida el mecanismo de entrega (fuera del alcance de este documento).

### Testing

- Backend: `deno test` (nativo, sin dependencia extra).
- Frontend: Vitest + React Testing Library.
- Ambos con un test mínimo cada uno que valide el circuito de salud (ver "Definición de hecho" abajo) — no se escriben tests de features que todavía no existen.

## Estructura de carpetas

```
/
├── frontend/
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx          # home — fetch a /health, único contenido del scaffolding
│   │   └── globals.css
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── Dockerfile
│   └── tests/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── db/               # esquema Drizzle + migraciones
│   │   ├── services/
│   │   └── workers/
│   ├── deno.json
│   ├── Dockerfile
│   └── tests/
├── docs/
│   ├── propuesta.md
│   ├── arquitectura.md
│   ├── modelo-entidad-relacion.md
│   └── superpowers/specs/
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .env.example
├── .gitignore
└── README.md
```

### Ejemplo de cómo crecería `frontend/app/` (referencia futura, no parte de este scaffolding)

Cuando se implementen las pantallas reales del alcance (fuera de este documento), `app/` seguiría el file-based routing de Next.js con una ruta por pantalla, por ejemplo:

```
frontend/app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── dashboard/
│   ├── page.tsx                    # historial + tendencias
│   ├── plan/page.tsx                # plan semanal actual
│   └── matches/[matchId]/page.tsx   # detalle de una partida
└── ...
```

Se incluye aquí solo como referencia de hacia dónde crece la estructura — no se scaffoldea todavía, ver "Fuera de alcance" abajo.

## Definición de "hecho" para este scaffolding

- `docker-compose up` levanta los 4 servicios sin error.
- El esquema Drizzle de las 10 tablas del MER está definido y la migración inicial corre contra Postgres al levantar el backend.
- `GET /health` en el backend responde 200 y confirma conexión activa a Postgres.
- La página principal del frontend hace `fetch` a `/health` del backend y muestra el estado en pantalla.
- `deno test` en backend y `vitest` en frontend corren y pasan (aunque sea un solo test cada uno, el que valida lo anterior).
- El workflow de CI corre esos mismos comandos en push/PR y pasa en verde.
- `README.md` explica cómo levantar el proyecto localmente (requisitos, `cp .env.example .env`, `docker-compose up`).

## Fuera de alcance de este documento

- Cualquier endpoint o pantalla de negocio real (auth, ingesta, métricas, planes) — eso son features posteriores, cada una con su propio ciclo de diseño/implementación si hace falta.
- Despliegue a EC2 — se abordará cuando el equipo tenga la instancia lista.
- Definición de roles/campeones acotados para el alcance del análisis — decisión de producto pendiente, no bloquea el scaffolding.
