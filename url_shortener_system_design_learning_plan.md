# URL Shortener System Design Learning Plan

## Goal

Build a scalable URL shortener step by step, starting from a simple local setup and progressively adding components like caching, replication, queues, and analytics.

---

## Tech Stack (Suggested)

- Backend: Express - Node.js
- Database: PostgreSQL
- Cache: Redis
- Queue: Kafka (later)
- ID Generation: Custom service (later)

---

# Phase 7 — Introduce Message Queue (RabbitMQ)

## Objective

Decouple analytics and async processing.

## Add

- RabbitMQ

## Flow

- On redirect:
  - Send event to queue
  - Process asynchronously

## What You Learn

- Event-driven architecture
- Async processing

---

# Phase 8 — Analytics Service

## Objective

Track usage without slowing main system.

## Add

- Separate analytics service

## Features

- Count clicks
- Store metrics

## What You Learn

- Microservices separation
- Data pipelines

---

# Phase 9 — ID Generation Service

## Objective

Decouple ID creation.

## Add

- Dedicated service for unique IDs

## Optional

- Use ZooKeeper-like coordination (conceptual)

## What You Learn

- Distributed coordination
- Service boundaries

---

# Phase 10 — Advanced Scaling

## Add

- Sharding DB
- CDN (conceptual)
- Rate limiting
- Monitoring (Prometheus/Grafana)

## What You Learn

- Real-world production concerns

---
