# URL Shortener Main Components

This document summarizes the main components of the project, what each one is responsible for, and how they interact.

## System Overview

The project is organized as a small distributed system rather than a single application. It has:

- a public URL shortener frontend
- a backend API responsible for URL creation and redirect resolution
- a separate analytics pipeline and analytics dashboard
- shared infrastructure for caching, messaging, databases, and observability

At a high level:

- users create short URLs through the frontend
- the backend stores canonical URL mappings
- redirect requests are resolved quickly through Redis and a replica database
- click analytics are sent asynchronously through RabbitMQ
- the analytics service persists reporting data in a dedicated analytics database
- Prometheus and Grafana monitor the running services

## Main Application Components

### Frontend

Path: `frontend/`

Responsibilities:

- provides the public UI for creating short URLs
- sends `POST /shorten` requests to the backend
- displays the generated short URL and original URL

Technical notes:

- built with React and Vite
- in Docker, served by Nginx
- in development, Vite proxies `/shorten` and `/health` to the backend

Why it exists:

- keeps the user-facing experience separate from backend logic
- makes the backend reusable for API clients, not only the browser UI

### Backend API

Path: `backend/`

Responsibilities:

- exposes the public API and redirect routes
- validates and normalizes submitted URLs
- creates short codes
- resolves short codes to original URLs
- enforces IP-based rate limiting
- publishes click events for analytics
- exposes `/health` and `/metrics`

Main endpoints:

- `GET /health`
- `GET /metrics`
- `POST /shorten`
- `GET /:code`

Why it exists:

- it is the core application service
- it owns correctness for URL creation and redirect behavior

### URL Repository Logic

Path: `backend/src/features/urls/`

Responsibilities:

- generates deterministic codes from URLs
- handles duplicate submissions and hash collisions
- writes new URLs into the primary database
- syncs data into the replica
- uses Redis as a read-through/write-through cache for URL lookups

Important behavior:

- new URL writes go to the primary PostgreSQL database first
- successful writes are copied into the replica database
- Redis is populated after writes and after replica read misses
- redirect lookups use Redis first and the replica second

Why it exists:

- centralizes the business rules for URL persistence and lookup
- isolates storage concerns from routing code

### Rate Limiter

Path: `backend/src/rateLimit/`

Responsibilities:

- enforces a shared request quota per IP address
- stores counters in Redis so both backend instances enforce the same limit
- skips rate limiting for `/health` and `/metrics`
- fails open if Redis is unavailable

Why it exists:

- protects the public backend from abuse
- keeps the system available even when cache infrastructure has problems

## Analytics Components

### Analytics Publisher

Path: `backend/src/queue/`

Responsibilities:

- builds a `url.clicked` event during redirects
- publishes that event to RabbitMQ
- retries publish attempts when transient failures occur

Why it exists:

- keeps analytics out of the synchronous redirect path
- allows redirects to remain fast even if analytics processing is slow

### Analytics Service

Path: `analytics-service/`

Responsibilities:

- consumes click events from RabbitMQ
- stores raw click events and reporting aggregates
- serves analytics API endpoints for the dashboard
- exposes `/health` and `/metrics`

Main endpoints:

- `GET /health`
- `GET /metrics`
- `GET /analytics/overview`
- `GET /analytics/:code/summary`
- `GET /analytics/:code/daily`
- `GET /analytics/:code/referrers`

Why it exists:

- separates operational analytics from the main redirect workload
- makes reporting queries independent from the core URL database

### Analytics Consumer

Path: `analytics-service/src/analytics/consumer.js`

Responsibilities:

- reads messages from the analytics queue
- writes click data into the analytics database
- retries failed events through a retry queue
- moves permanently failing messages to a failed queue

Why it exists:

- provides resilience for analytics ingestion
- prevents temporary analytics failures from losing events immediately

### Analytics UI

Path: `analytics-ui/`

Responsibilities:

- provides a dashboard for traffic and usage insights
- loads summary, daily, and referrer data from the analytics service
- renders charts for top URLs, recent volume, and top referrers

Technical notes:

- built with React and Vite
- served by Nginx in Docker
- proxies `/api/*` requests to the analytics service
- currently uses a temporary local `admin` / `admin` login

Why it exists:

- separates operational reporting from the public shortener UI
- gives the analytics pipeline a dedicated consumer-facing interface

## Data Components

### Primary PostgreSQL Database

Service name: `db-primary`

Responsibilities:

- stores the source-of-truth URL records
- receives all write operations for shortened URLs

Why it exists:

- guarantees correctness for inserts, duplicate checks, and collision handling

### Replica PostgreSQL Database

Service name: `db-replica`

Responsibilities:

- serves backend read traffic for short code resolution
- acts as the backend read model

Technical notes:

- this project simulates replication by explicitly upserting rows from the backend
- sync can be delayed with `REPLICA_SYNC_DELAY_MS` to simulate eventual consistency

Why it exists:

- demonstrates read/write separation
- reduces read pressure on the primary database

### Analytics PostgreSQL Database

Service name: `db-analytics`

Responsibilities:

- stores raw click events
- stores aggregate tables used by the analytics API

Why it exists:

- isolates reporting workloads from the core URL database
- supports analytics queries without affecting redirect performance

### Redis

Service name: `redis`

Responsibilities:

- caches short URL lookups
- stores shared rate-limit counters

Why it exists:

- accelerates redirect resolution
- provides shared state across multiple backend instances

### RabbitMQ

Service name: `rabbitmq`

Responsibilities:

- transports click events from the backend to the analytics service
- supports retry and failed-message workflows

Why it exists:

- decouples redirect handling from analytics persistence
- adds durability and retry semantics for asynchronous processing

## Networking and Traffic Components

### Load Balancer

Path: `nginx/`

Responsibilities:

- routes public backend traffic to `backend-1` and `backend-2`
- forwards headers such as `X-Forwarded-For` and `X-Forwarded-Proto`

Why it exists:

- distributes traffic across multiple backend instances
- models a production-style entrypoint for the public API

### Backend Instances

Service names:

- `backend-1`
- `backend-2`

Responsibilities:

- run identical copies of the backend application
- share Redis, RabbitMQ, and database infrastructure

Why they exist:

- provide horizontal scaling for the core application
- demonstrate that the cache and rate-limit design work across instances

## Observability Components

### Prometheus

Path: `monitoring/prometheus/`

Responsibilities:

- scrapes metrics from backend instances, the analytics service, and Prometheus itself

Why it exists:

- collects operational telemetry for the system

### Grafana

Path: `monitoring/grafana/`

Responsibilities:

- visualizes Prometheus metrics
- ships with a pre-provisioned dashboard for the URL shortener system

Why it exists:

- gives operators a quick way to inspect health, throughput, and service behavior

## Supporting Components

### Migrators

Responsibilities:

- apply schema migrations for the core database and analytics database before app services start

Services:

- `core-migrator`
- `analytics-migrator`

Why they exist:

- ensure databases are initialized consistently
- avoid requiring manual schema setup before starting the stack

### Docker Compose

Path: `docker-compose.yml`

Responsibilities:

- defines the full local multi-service environment
- configures ports, dependencies, environment variables, and health checks

Why it exists:

- provides a reproducible way to run the entire system locally

## Component Relationships

The most important relationships in the system are:

- `frontend` depends on the backend entrypoint for URL creation
- `load-balancer` distributes traffic across `backend-1` and `backend-2`
- `backend` writes URL data to `db-primary`
- `backend` syncs read data to `db-replica`
- `backend` uses `redis` for caching and rate limiting
- `backend` publishes click events to `rabbitmq`
- `analytics-service` consumes events from `rabbitmq`
- `analytics-service` stores reporting data in `db-analytics`
- `analytics-ui` reads from `analytics-service`
- `prometheus` scrapes `backend` and `analytics-service`
- `grafana` visualizes Prometheus metrics

## Recommended Reading Order

If you are new to the project, read the components in this order:

1. `frontend`
2. `backend`
3. `backend/src/features/urls/`
4. `backend/src/queue/`
5. `analytics-service`
6. `analytics-ui`
7. `docker-compose.yml`
8. `docs/architecture-diagrams.md`
