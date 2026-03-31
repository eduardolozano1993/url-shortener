# URL Shortener

Phase 3 implementation of a minimal URL shortener with PostgreSQL and Redis caching.

## What this includes

- Single Node.js service
- Single PostgreSQL database
- Redis cache layer using cache-aside
- `POST /shorten` to create a short URL
- `GET /:code` to redirect to the original URL

## Setup

1. Create a `.env` file.
2. Make sure PostgreSQL is reachable on port `5432`.
3. Make sure Redis is reachable on port `6379`.
4. Install dependencies with `npm install`.
5. Run migrations with `npm run db:migrate`.
6. Start the app with `npm run dev`.

Recommended `.env`:

```bash
PORT=3000
PGHOST=localhost
PGPORT=5432
PGDATABASE=url_shortener
PGUSER=postgres
PGPASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TTL_SECONDS=3600
```

## PostgreSQL and Redis with Docker

```bash
docker run --name url-shortener-db ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=url_shortener ^
  -p 5432:5432 ^
  -d postgres:16
```

Run both services with Docker Compose:

```bash
docker compose up -d
```

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
  "shortUrl": "http://localhost:3000/abc12345"
}
```

### Redirect

- `GET /:code`

Example:

```bash
curl -i http://localhost:3000/abc12345
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

- Reads use the cache-aside pattern: Redis first, then PostgreSQL on miss, then Redis is warmed.
- Writes save to PostgreSQL first and then populate Redis.
- You can confirm cache behavior in server logs by watching `Cache hit`, `Cache miss`, and `DB lookup`.
