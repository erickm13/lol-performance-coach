# Plataforma de análisis y entrenamiento personalizado — League of Legends

Proyecto de Seminario Profesional 2. Ver el contexto completo en:

- [docs/propuesta.md](docs/propuesta.md) — objetivos, alcance y justificación
- [docs/arquitectura.md](docs/arquitectura.md) — arquitectura lógica y flujo end-to-end
- [docs/modelo-entidad-relacion.md](docs/modelo-entidad-relacion.md) — modelo de datos completo

## Requisitos

- Docker y Docker Compose
- Deno >= 2.0 (solo para correr el backend fuera de Docker)
- Node.js >= 20 (solo para correr el frontend fuera de Docker)

## Levantar el proyecto localmente

```bash
cp .env.example .env
docker compose up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000/health

Para bajar todo: `docker compose down`

## Desarrollo sin Docker

### Backend

```bash
cd backend
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5433/lol_analytics
deno task db:generate
deno task db:migrate
deno task dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend && deno task test
cd frontend && npm test
```
