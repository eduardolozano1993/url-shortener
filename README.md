# URL Shortener

This repo now has a split app structure:

- `frontend/`: React app with pure CSS UI
- `backend/`: Express API, PostgreSQL access, Redis cache, redirect logic

## Project layout

```text
url-shortener/
  backend/
  frontend/
  docker-compose.yml
  .env
```

## Setup

1. Create the root `.env` file.
2. Make sure PostgreSQL primary is reachable on `5432`.
3. Make sure PostgreSQL replica is reachable on `5433`.
4. Make sure Redis is reachable on `6379`.
5. Install backend dependencies with `npm install` inside `backend/`.
6. Install frontend dependencies with `npm install` inside `frontend/`.
7. Run migrations with `npm run db:migrate` from the repo root.

Recommended `.env`:

```bash
PORT=4000
PUBLIC_BASE_URL=http://localhost:4000/
PGHOST=localhost
PGPORT=5432
PGDATABASE=url_shortener
PGUSER=postgres
PGPASSWORD=postgres
PGREPLICA_HOST=localhost
PGREPLICA_PORT=5433
PGREPLICA_DATABASE=url_shortener
PGREPLICA_USER=postgres
PGREPLICA_PASSWORD=postgres
REPLICA_SYNC_DELAY_MS=0
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TTL_SECONDS=3600
```

## Development

Run the backend:

```bash
npm run dev:backend
```

Run the frontend in a second terminal:

```bash
npm run dev:frontend
```

The React dev server runs on `http://localhost:5173` and proxies API calls to the backend on `http://localhost:4000`.

## Production-style build

Build the frontend:

```bash
npm run build
```

That outputs `frontend/dist`. If that folder exists, the Express backend serves the built frontend at `/`.

## API

- `GET /health`
- `POST /shorten`
- `GET /:code`

Example request:

```json
{
  "originalUrl": "https://example.com"
}
```

Example response:

```json
{
  "code": "abc12345",
  "originalUrl": "https://example.com/",
  "shortUrl": "http://localhost:4000/abc12345"
}
```

## Docker

The Docker setup now runs the full stack:

- Frontend on `http://localhost:8080`
- Backend API on `http://localhost:4000`
- PostgreSQL primary on `localhost:5432`
- PostgreSQL replica on `localhost:5433`
- Redis on `localhost:6379`

The frontend container proxies `/shorten` and `/health` to the backend container, so the current React app works without changing browser-side URLs. The backend still exposes its own direct URL for API access and generated short links.

Recommended root `.env` values for Docker:

```bash
BACKEND_PORT=4000
FRONTEND_PORT=8080
BACKEND_PUBLIC_BASE_URL=http://localhost:4000/
PGDATABASE=url_shortener
PGUSER=postgres
PGPASSWORD=postgres
PGPORT=5432
PGREPLICA_DATABASE=url_shortener
PGREPLICA_USER=postgres
PGREPLICA_PASSWORD=postgres
PGREPLICA_PORT=5433
REPLICA_SYNC_DELAY_MS=0
REDIS_PORT=6379
REDIS_TTL_SECONDS=3600
```

Start everything with:

```bash
docker compose up --build -d
```

On Windows PowerShell, use the included helper script:

```powershell
.\scripts\docker.ps1 up
```

That command starts:

- `db-primary`
- `db-replica`
- `redis`
- `backend`
- `frontend`

Useful checks:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Equivalent PowerShell helper commands:

```powershell
.\scripts\docker.ps1 ps
.\scripts\docker.ps1 logs
.\scripts\docker.ps1 build
.\scripts\docker.ps1 down
.\scripts\docker.ps1 restart
.\scripts\docker.ps1 reset
```

PowerShell command summary:

- `.\scripts\docker.ps1 up`: build images and start the full stack in the background
- `.\scripts\docker.ps1 down`: stop and remove containers
- `.\scripts\docker.ps1 restart`: recreate the stack
- `.\scripts\docker.ps1 logs`: stream Compose logs
- `.\scripts\docker.ps1 ps`: show running services
- `.\scripts\docker.ps1 build`: rebuild images only
- `.\scripts\docker.ps1 reset`: remove containers and volumes, then recreate everything

Optional `make` targets:

- `make up`: build images and start the full stack in the background
- `make down`: stop and remove containers
- `make restart`: recreate the stack
- `make logs`: stream Compose logs
- `make ps`: show running services
- `make build`: rebuild images only
- `make reset`: remove containers and volumes, then recreate everything

On Windows, `make` is not included by default. You do not need it for this repo because `.\scripts\docker.ps1` wraps the same Docker Compose workflow directly.

Open:

- Frontend UI: `http://localhost:8080`
- Backend root: `http://localhost:4000`
- Backend health: `http://localhost:4000/health`

## Notes

- Reads use Redis first, then the replica database on cache miss.
- Writes go to the primary database first, then sync to the simulated replica, then populate Redis.
- Duplicate and collision checks stay on the primary database for correctness.
- Set `REPLICA_SYNC_DELAY_MS` above `0` if you want to simulate eventual consistency.
