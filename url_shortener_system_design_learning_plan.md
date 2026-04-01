# URL Shortener System Design Learning Plan

## Goal

Build a scalable URL shortener step by step, starting from a simple local setup and progressively adding components like caching, replication, queues, and analytics.

---

## Tech Stack (Suggested)

- Backend: Node.js (Express or NestJS)
- Database: PostgreSQL (start simple)
- Cache: Redis
- Queue: Kafka (later)
- ID Generation: Custom service (later)

---

# Phase 6 — Add Load Balancer (Simulated)

## Objective

Scale horizontally.

## Add

- Multiple app instances
- Simple load balancer (NGINX or Docker round-robin)

## What You Learn

- Stateless services
- Horizontal scaling

---

# Phase 7 — Introduce Message Queue (Kafka)

## Objective

Decouple analytics and async processing.

## Add

- Kafka (or simpler: RabbitMQ)

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

# Suggested Learning Flow

Do NOT rush. Only move forward when:

- You can explain the system
- You can debug it
- You understand tradeoffs

---
