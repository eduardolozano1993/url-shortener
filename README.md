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

## Infrastructure

Run PostgreSQL primary, PostgreSQL replica, and Redis with Docker Compose:

```bash
docker compose up -d
```

That command starts:

- `db-primary` on `5432`
- `db-replica` on `5433`
- `redis` on `6379`

## Notes

- Reads use Redis first, then the replica database on cache miss.
- Writes go to the primary database first, then sync to the simulated replica, then populate Redis.
- Duplicate and collision checks stay on the primary database for correctness.
- Set `REPLICA_SYNC_DELAY_MS` above `0` if you want to simulate eventual consistency.
