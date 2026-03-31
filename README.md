# URL Shortener

Phase 5 implementation of a minimal URL shortener with Redis caching and simulated read/write separation.

## What this includes

- Single Node.js service
- PostgreSQL primary for writes
- PostgreSQL replica for reads
- Redis cache layer using cache-aside
- `POST /shorten` to create a short URL
- `GET /:code` to redirect to the original URL

## Setup

1. Create a `.env` file.
2. Make sure primary PostgreSQL is reachable on port `5432`.
3. Make sure replica PostgreSQL is reachable on port `5433`.
4. Make sure Redis is reachable on port `6379`.
5. Install dependencies with `npm install`.
6. Run migrations with `npm run db:migrate`.
7. Start the app with `npm run dev`.

Recommended `.env`:

```bash
PORT=4000
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

## Primary, Replica, and Redis with Docker

Run the primary DB, replica DB, and Redis with Docker Compose:

```bash
docker compose up -d
```

That command starts:

- `db-primary` on `5432`
- `db-replica` on `5433`
- `redis` on `6379`

## API

### Health

- `GET /health`

### Create short URL

- `POST /shorten`

Request body:

```json
{
  "originalUrl": "https://example.com"
}
```

Response:

```json
{
  "code": "abc12345",
  "originalUrl": "https://example.com/",
  "shortUrl": "http://localhost:4000/abc12345"
}
```

### Redirect

- `GET /:code`

Example:

```bash
curl -i http://localhost:4000/abc12345
```

That request returns a redirect to the stored `originalUrl`.

## Database

The `urls` table stores:

- `id`
- `code`
- `original_url`
- `created_at`

The migration lives in `src/db/migrations/001_create_urls_table.sql`.

## Notes

- Reads use Redis first, then the replica database on cache miss.
- Writes go to the primary database first, then sync to the simulated replica, then populate Redis.
- Duplicate and collision checks stay on the primary database for correctness.
- Set `REPLICA_SYNC_DELAY_MS` above `0` if you want to simulate eventual consistency.
- The app logs each request flow step in the console, including Redis hits and misses, primary DB writes, replica DB reads, and replica syncs.
