# URL Shortener

This repo now has a split app structure:

- `frontend/`: React app with pure CSS UI
- `backend/`: Express API, PostgreSQL access, Redis cache, redirect logic
- `analytics-service/`: Express analytics API plus RabbitMQ consumer
- `analytics-ui/`: React dashboard with a temporary local admin login
- `db-primary`: main PostgreSQL for URLs and core app data
- `db-analytics`: analytics PostgreSQL for click events and reporting tables
- `rabbitmq`: queue broker for async click processing

## Project layout

```text
url-shortener/
  analytics-service/
  analytics-ui/
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
5. Make sure analytics PostgreSQL is reachable on `5434`.
6. Make sure RabbitMQ is reachable on `5672`.
7. Install backend dependencies with `npm install` inside `backend/`.
8. Install analytics service dependencies with `npm install` inside `analytics-service/`.
9. Install frontend dependencies with `npm install` inside `frontend/`.
10. Install analytics UI dependencies with `npm install` inside `analytics-ui/`.
11. Run migrations with `npm run db:migrate` from the repo root.

Recommended `.env`:

```bash
PORT=4000
PUBLIC_BASE_URL=http://localhost:4000/
ANALYTICS_SERVICE_PORT=4100
ANALYTICS_UI_PORT=8081
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
ANALYTICS_PGHOST=localhost
ANALYTICS_PGPORT=5434
ANALYTICS_PGDATABASE=url_shortener_analytics
ANALYTICS_PGUSER=postgres
ANALYTICS_PGPASSWORD=postgres
REPLICA_SYNC_DELAY_MS=0
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TTL_SECONDS=3600
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
ANALYTICS_RETRY_DELAY_MS=5000
ANALYTICS_MAX_RETRIES=3
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

Run the analytics service in a third terminal:

```bash
npm run dev:analytics-service
```

Run the analytics UI in a fourth terminal:

```bash
npm run dev:analytics-ui
```

The main React dev server runs on `http://localhost:5173` and proxies API calls to the backend on `http://localhost:4000`.
The analytics React dev server runs on `http://localhost:5174` and proxies API calls to the analytics service on `http://localhost:4100`.

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
- Analytics UI on `http://localhost:8081`
- NGINX load balancer on `http://localhost:4000`
- Analytics service API on `http://localhost:4100`
- PostgreSQL primary on `localhost:5432` for URLs and core app data
- PostgreSQL replica on `localhost:5433`
- PostgreSQL analytics DB on `localhost:5434` for click events and rollups
- Redis on `localhost:6379`
- RabbitMQ on `localhost:5672`
- RabbitMQ management UI on `http://localhost:15672`
- Prometheus on `http://localhost:9090`
- Grafana on `http://localhost:3001`

Phase 8 adds a separate analytics service and dashboard. Redirect requests now publish a `url.clicked` event from the main app, and the analytics service consumes those events, stores analytics data, and serves reporting endpoints without slowing redirects.

Recommended root `.env` values for Docker:

```bash
FRONTEND_PORT=8080
ANALYTICS_UI_PORT=8081
LOAD_BALANCER_PORT=4000
LOAD_BALANCER_PUBLIC_BASE_URL=http://localhost:4000/
ANALYTICS_SERVICE_PORT=4100
PGDATABASE=url_shortener
PGUSER=postgres
PGPASSWORD=postgres
PGPORT=5432
PGREPLICA_DATABASE=url_shortener
PGREPLICA_USER=postgres
PGREPLICA_PASSWORD=postgres
PGREPLICA_PORT=5433
ANALYTICS_PGDATABASE=url_shortener_analytics
ANALYTICS_PGUSER=postgres
ANALYTICS_PGPASSWORD=postgres
ANALYTICS_PGPORT=5434
REPLICA_SYNC_DELAY_MS=0
REDIS_PORT=6379
REDIS_TTL_SECONDS=3600
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
ANALYTICS_RETRY_DELAY_MS=5000
ANALYTICS_MAX_RETRIES=3
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
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
- `db-analytics`
- `redis`
- `rabbitmq`
- `core-migrator`
- `analytics-migrator`
- `backend-1`
- `backend-2`
- `analytics-service`
- `load-balancer`
- `frontend`
- `analytics-ui`
- `prometheus`
- `grafana`

Useful checks:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f analytics-service
docker compose logs -f analytics-ui
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
- Analytics UI: `http://localhost:8081`
- Load balancer root: `http://localhost:4000`
- Load balancer health: `http://localhost:4000/health`
- Analytics service health: `http://localhost:4100/health`
- RabbitMQ UI: `http://localhost:15672`
- Prometheus UI: `http://localhost:9090`
- Grafana UI: `http://localhost:3001`

Analytics service endpoints:

- `GET /analytics/overview`
- `GET /analytics/:code/summary`
- `GET /analytics/:code/daily`
- `GET /analytics/:code/referrers`

Phase 8 queue and analytics notes:

- NGINX still distributes redirects across `backend-1` and `backend-2`
- Redirects publish `url.clicked` to RabbitMQ and still return the redirect response immediately after URL resolution
- `analytics-service` consumes the queue and writes into `analytics_clicks`
- Aggregates are maintained in `analytics_url_counters`, `analytics_daily_clicks`, and `analytics_referrer_counters`
- Failed analytics writes are retried through a retry queue and eventually moved to a failed queue with error metadata
- `analytics-ui` uses a temporary hardcoded `admin` / `admin` login and proxies API requests to the analytics service

## Monitoring

Prometheus and Grafana are included in the Docker stack and start automatically with `docker compose up --build -d` or `.\scripts\docker.ps1 up`.

Grafana is pre-provisioned with:

- a default Prometheus datasource
- a `URL Shortener Overview` dashboard under the `URL Shortener` folder

Default Grafana credentials:

- username: `admin`
- password: `admin`

Prometheus scrape targets:

- `backend-1:4000/metrics`
- `backend-2:4000/metrics`
- `analytics-service:4100/metrics`
- `prometheus:9090/metrics`

Application metrics exposed by the Node services include:

- total backend HTTP requests by route, method, and status code
- backend request latency histogram
- total shortened URLs created
- redirect outcomes grouped as `found`, `not_found`, or `invalid`
- backend IP rate-limit decisions grouped as `allowed`, `blocked`, or `failed_open`
- analytics API HTTP request counts and latency histogram
- analytics consumer outcomes grouped as `success`, `retry`, or `failed`

If you change Grafana credentials in `.env`, recreate the `grafana` container if the previous admin account has already been initialized inside the Grafana volume.

## Rate Limiting

The backend enforces an IP-based limit of `100` requests per hour using Redis as a shared counter, so the quota is consistent across both backend containers.

Rate limiting behavior:

- applies to backend public traffic such as `/`, `/shorten`, and `/:code`
- does not apply to `/health` or `/metrics`
- returns `429` with `{ "error": "Rate limit exceeded" }` when the quota is exhausted
- includes `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on limited requests
- fails open if Redis is temporarily unavailable so the backend stays reachable

## Notes

- Reads use Redis first, then the replica database on cache miss.
- Writes go to the primary database first, then sync to the simulated replica, then populate Redis.
- Duplicate and collision checks stay on the primary database for correctness.
- The main database stores URLs and core app data only.
- The analytics database stores raw click events and reporting tables only.
- Set `REPLICA_SYNC_DELAY_MS` above `0` if you want to simulate eventual consistency.
