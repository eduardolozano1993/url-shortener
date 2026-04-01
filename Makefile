.PHONY: up down restart logs ps build reset

DOCKER ?= docker
COMPOSE = $(DOCKER) compose

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) down
	$(COMPOSE) up --build -d

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

build:
	$(COMPOSE) build

reset:
	$(COMPOSE) down -v
	$(COMPOSE) up --build -d
