# ===========================================
# ATLASP2P NODES MAP - MAKEFILE
# ===========================================

.PHONY: help dev down down-volumes logs ps restart shell \
        setup-docker setup-cloud setup-fork \
        docker-dev docker-down docker-logs \
        cloud-dev cloud-down cloud-logs \
        prod-docker prod-docker-no-caddy prod-cloud prod-cloud-no-caddy \
        prod-down prod-logs prod-restart \
        docker-clean config-reload config-check \
        migrate migrate-file migrate-create migrate-reset \
        db-shell db-backup db-restore \
        crawler crawler-logs crawler-local geoip \
        logs-web logs-db logs-crawler logs-auth \
        build-images build-web build-crawler rebuild \
        lint typecheck test format build \
        clean clean-cache clean-volumes clean-all reset \
        sync-upstream check status

# Colors
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

.DEFAULT_GOAL := help

# ===========================================
# COMPOSE FILE COMBINATIONS
# ===========================================
COMPOSE_DOCKER := -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_CLOUD := -f docker-compose.cloud.yml -f docker-compose.cloud-dev.yml
COMPOSE_PROD_DOCKER := -f docker-compose.yml -f docker-compose.prod.yml
COMPOSE_PROD_CLOUD := -f docker-compose.cloud.yml -f docker-compose.cloud-prod.yml

# ===========================================
# HELP
# ===========================================

help: ## Show this help
	@echo ""
	@echo "$(CYAN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(CYAN)║      ATLASP2P NODES MAP COMMANDS      ║$(RESET)"
	@echo "$(CYAN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Quick Start:$(RESET)"
	@echo "  make setup-fork && make dev"
	@echo ""
	@echo "$(YELLOW)Common Workflows:$(RESET)"
	@echo "  make dev          Start development"
	@echo "  make logs         View all logs"
	@echo "  make rebuild      Rebuild images + restart"
	@echo "  make down         Stop everything"
	@echo ""
	@echo "$(YELLOW)After Dockerfile Changes:$(RESET)"
	@echo "  make rebuild      Rebuild ALL images"
	@echo "  make build-web    Rebuild web only"
	@echo "  make build-crawler Rebuild crawler only"
	@echo ""

# ===========================================
# QUICK COMMANDS (Most Used)
# ===========================================

dev: docker-dev ## Start development environment

down: ## Stop all services
	@docker compose $(COMPOSE_DOCKER) down 2>/dev/null || true
	@docker compose $(COMPOSE_CLOUD) down 2>/dev/null || true
	@docker compose $(COMPOSE_PROD_DOCKER) down 2>/dev/null || true
	@docker compose $(COMPOSE_PROD_CLOUD) down 2>/dev/null || true
	@echo "$(GREEN)✓ All services stopped$(RESET)"

down-volumes: ## Stop and remove volumes (DELETES ALL DATA!)
	@echo "$(YELLOW)⚠️  WARNING: This will delete all data!$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to cancel, or wait 5 seconds...$(RESET)"
	@sleep 5
	@docker compose $(COMPOSE_DOCKER) down -v 2>/dev/null || true
	@docker compose $(COMPOSE_CLOUD) down -v 2>/dev/null || true
	@docker compose $(COMPOSE_PROD_DOCKER) down -v 2>/dev/null || true
	@docker compose $(COMPOSE_PROD_CLOUD) down -v 2>/dev/null || true
	@echo "$(GREEN)✓ Containers stopped and volumes removed$(RESET)"

clean-volumes: ## Remove anonymous Docker volumes (safe cleanup)
	@echo "$(CYAN)Removing anonymous volumes...$(RESET)"
	@docker volume prune -f
	@echo "$(GREEN)✓ Anonymous volumes removed$(RESET)"

clean-cache: ## Remove Docker build cache
	@echo "$(CYAN)Removing Docker build cache...$(RESET)"
	@docker builder prune -f
	@echo "$(GREEN)✓ Build cache removed$(RESET)"

clean-all: down clean-volumes clean-cache ## Nuclear option: remove everything
	@echo "$(YELLOW)Removing all Docker images...$(RESET)"
	@docker system prune -a -f
	@echo "$(GREEN)✓ Complete cleanup done$(RESET)"

logs: ## Show all logs (follow mode)
	@docker compose $(COMPOSE_DOCKER) logs -f 2>/dev/null || docker compose $(COMPOSE_CLOUD) logs -f

ps: ## Show running containers
	@docker compose $(COMPOSE_DOCKER) ps 2>/dev/null || docker compose $(COMPOSE_CLOUD) ps

restart: down dev ## Restart development environment

shell: ## Open shell in web container
	@docker exec -it atlasp2p-web sh

# ===========================================
# SETUP
# ===========================================

setup-docker: ## Setup for Local Docker (full stack)
	@echo "$(CYAN)Setting up for Local Docker...$(RESET)"
	@if [ ! -f .env ]; then \
		cp .env.docker.example .env; \
		echo "$(GREEN)✓ Created .env$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ .env already exists$(RESET)"; \
	fi
	@if [ ! -f config/project.config.yaml ]; then \
		cp config/project.config.yaml.example config/project.config.yaml; \
		echo "$(GREEN)✓ Created config/project.config.yaml$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ config/project.config.yaml already exists$(RESET)"; \
	fi
	@pnpm install
	@mkdir -p data/geoip apps/web/public/avatars
	@echo ""
	@echo "$(GREEN)✓ Setup complete!$(RESET)"
	@echo "$(CYAN)Next: make dev$(RESET)"

setup-cloud: ## Setup for Cloud Supabase (managed DB)
	@echo "$(CYAN)Setting up for Cloud Supabase...$(RESET)"
	@if [ ! -f .env ]; then \
		cp .env.cloud.example .env; \
		echo "$(GREEN)✓ Created .env$(RESET)"; \
		echo "$(YELLOW)⚠ Edit .env with your Supabase credentials!$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ .env already exists$(RESET)"; \
	fi
	@if [ ! -f config/project.config.yaml ]; then \
		cp config/project.config.yaml.example config/project.config.yaml; \
		echo "$(GREEN)✓ Created config/project.config.yaml$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ config/project.config.yaml already exists$(RESET)"; \
	fi
	@pnpm install
	@mkdir -p data/geoip apps/web/public/avatars
	@echo ""
	@echo "$(YELLOW)Next steps:$(RESET)"
	@echo "  1. Edit .env with Supabase credentials"
	@echo "  2. Edit config/project.config.yaml"
	@echo "  3. make cloud-dev"

setup-fork: setup-docker ## Setup for forking (same as setup-docker)
	@echo ""
	@echo "$(CYAN)Fork ready!$(RESET)"
	@echo ""
	@echo "$(YELLOW)Next steps:$(RESET)"
	@echo "  1. Edit config/project.config.yaml for your blockchain"
	@echo "  2. Edit .env if needed"
	@echo "  3. make dev"
	@echo "  4. Commit config: git add -f config/project.config.yaml && git commit"

setup-deploy: ## Setup deployment workflow for fork (copy from example)
	@echo "$(CYAN)Setting up deployment workflow...$(RESET)"
	@if [ -f .github/workflows/deploy.yml ]; then \
		echo "$(YELLOW)⚠ deploy.yml already exists, skipping copy$(RESET)"; \
	else \
		cp .github/workflows/deploy.yml.example .github/workflows/deploy.yml; \
		echo "$(GREEN)✓ Created .github/workflows/deploy.yml$(RESET)"; \
	fi
	@echo ""
	@echo "$(YELLOW)Next steps:$(RESET)"
	@echo "  1. Edit .github/workflows/deploy.yml (change branch if needed)"
	@echo "  2. Configure deployment in config/project.config.yaml"
	@echo "  3. Remove deploy.yml from .gitignore:"
	@echo "     sed -i '/.github\/workflows\/deploy.yml/d' .gitignore"
	@echo "  4. Commit workflow:"
	@echo "     git add .github/workflows/deploy.yml && git commit -m 'Add deployment workflow'"
	@echo ""
	@echo "$(CYAN)See docs/CICD.md for complete setup guide$(RESET)"

# ===========================================
# DEVELOPMENT - DOCKER MODE
# ===========================================

docker-dev: ## Start full stack (DB + Web + Crawler)
	@echo "$(CYAN)Starting development stack...$(RESET)"
	@docker compose $(COMPOSE_DOCKER) up -d
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║         DEVELOPMENT READY             ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Web App:$(RESET)      http://localhost:4000"
	@echo "  $(CYAN)Supabase API:$(RESET) http://localhost:4020"
	@echo "  $(CYAN)Studio:$(RESET)       http://localhost:4022"
	@echo "  $(CYAN)Inbucket:$(RESET)     http://localhost:4023"
	@echo "  $(CYAN)PostgreSQL:$(RESET)   localhost:4021"
	@echo ""
	@echo "$(YELLOW)Useful commands:$(RESET)"
	@echo "  make logs       View all logs"
	@echo "  make logs-web   View web logs"
	@echo "  make down       Stop everything"
	@echo ""

docker-down: ## Stop Docker mode
	@docker compose $(COMPOSE_DOCKER) down

docker-logs: ## Show Docker mode logs
	@docker compose $(COMPOSE_DOCKER) logs -f

# ===========================================
# DEVELOPMENT - CLOUD MODE
# ===========================================

cloud-dev: ## Start cloud mode (Web + Crawler only)
	@echo "$(CYAN)Starting cloud mode...$(RESET)"
	@if [ ! -f .env ]; then \
		echo "$(RED)Error: .env not found. Run: make setup-cloud$(RESET)"; \
		exit 1; \
	fi
	@docker compose $(COMPOSE_CLOUD) up -d
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║       CLOUD MODE READY                ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Web App:$(RESET)  http://localhost:4000"
	@echo "  $(CYAN)Database:$(RESET) Supabase Cloud"
	@echo ""

cloud-down: ## Stop Cloud mode
	@docker compose $(COMPOSE_CLOUD) down

cloud-logs: ## Show Cloud mode logs
	@docker compose $(COMPOSE_CLOUD) logs -f

# ===========================================
# LOGGING (Per-Service)
# ===========================================

logs-web: ## Show web container logs
	@docker compose $(COMPOSE_DOCKER) logs -f web 2>/dev/null || docker compose $(COMPOSE_CLOUD) logs -f web

logs-db: ## Show database logs
	@docker compose $(COMPOSE_DOCKER) logs -f db

logs-crawler: ## Show crawler logs
	@docker compose $(COMPOSE_DOCKER) logs -f crawler 2>/dev/null || docker compose $(COMPOSE_CLOUD) logs -f crawler

logs-auth: ## Show auth (GoTrue) logs
	@docker compose $(COMPOSE_DOCKER) logs -f auth

# ===========================================
# CONFIGURATION
# ===========================================

config-check: ## Validate project.config.yaml
	@node scripts/validate-config.mjs

config-reload: ## Reload config (restart web)
	@echo "$(CYAN)Reloading configuration...$(RESET)"
	@docker compose $(COMPOSE_DOCKER) restart web 2>/dev/null || docker compose $(COMPOSE_CLOUD) restart web
	@echo "$(GREEN)✓ Config reloaded$(RESET)"

# ===========================================
# PRODUCTION
# ===========================================

prod-docker: ## Production - Self-hosted (full stack + Caddy SSL)
	@echo "$(CYAN)Starting production (self-hosted with Caddy)...$(RESET)"
	@if [ -z "$(DOMAIN)" ] && ! grep -q "^DOMAIN=" .env 2>/dev/null; then \
		echo "$(RED)Error: DOMAIN not set in .env$(RESET)"; \
		exit 1; \
	fi
	@docker compose $(COMPOSE_PROD_DOCKER) --profile with-caddy up -d
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║       PRODUCTION READY                ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Website:$(RESET) https://$$(grep ^DOMAIN= .env | cut -d= -f2)"
	@echo ""

prod-docker-no-caddy: ## Production - Self-hosted WITHOUT container Caddy (use host proxy)
	@echo "$(CYAN)Starting production (self-hosted, no container Caddy)...$(RESET)"
	@docker compose $(COMPOSE_PROD_DOCKER) up -d
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║       PRODUCTION READY                ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Web Port:$(RESET) $$(grep ^WEB_PORT= .env 2>/dev/null | cut -d= -f2 || echo 4000)"
	@echo "  $(YELLOW)Configure your host reverse proxy to forward to port above$(RESET)"
	@echo ""

prod-cloud: ## Production - Cloud DB + Docker app + Caddy SSL
	@echo "$(CYAN)Starting production (cloud mode with Caddy)...$(RESET)"
	@if [ -z "$(DOMAIN)" ] && ! grep -q "^DOMAIN=" .env 2>/dev/null; then \
		echo "$(RED)Error: DOMAIN not set in .env$(RESET)"; \
		exit 1; \
	fi
	@docker compose $(COMPOSE_PROD_CLOUD) --profile with-caddy up -d
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║       PRODUCTION READY                ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Website:$(RESET) https://$$(grep ^DOMAIN= .env | cut -d= -f2)"
	@echo ""

prod-cloud-no-caddy: ## Production - Cloud DB WITHOUT container Caddy (use host proxy)
	@echo "$(CYAN)Starting production (cloud mode, no container Caddy)...$(RESET)"
	@docker compose $(COMPOSE_PROD_CLOUD) up -d
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║       PRODUCTION READY                ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Web Port:$(RESET) $$(grep ^WEB_PORT= .env 2>/dev/null | cut -d= -f2 || echo 4000)"
	@echo "  $(YELLOW)Configure your host reverse proxy to forward to port above$(RESET)"
	@echo ""

prod-down: ## Stop production
	@docker compose $(COMPOSE_PROD_DOCKER) down 2>/dev/null || true
	@docker compose $(COMPOSE_PROD_CLOUD) down 2>/dev/null || true

prod-logs: ## Show production logs
	@docker compose $(COMPOSE_PROD_DOCKER) logs -f 2>/dev/null || docker compose $(COMPOSE_PROD_CLOUD) logs -f

prod-restart: ## Restart production
	@echo "$(CYAN)Restarting production...$(RESET)"
	@docker compose $(COMPOSE_PROD_DOCKER) up -d --force-recreate 2>/dev/null || \
		docker compose $(COMPOSE_PROD_CLOUD) up -d --force-recreate
	@echo "$(GREEN)✓ Production restarted$(RESET)"

# ===========================================
# DATABASE
# ===========================================

migrate: ## Run database migrations
	@echo "$(CYAN)Running migrations...$(RESET)"
	@if ! docker compose $(COMPOSE_DOCKER) ps db 2>/dev/null | grep -q "Up"; then \
		echo "$(RED)Error: Database not running. Start with: make dev$(RESET)"; \
		exit 1; \
	fi
	@for file in supabase/migrations/*.sql; do \
		echo "  Applying: $$(basename $$file)"; \
		cat $$file | docker compose $(COMPOSE_DOCKER) exec -T db psql -U postgres -d postgres; \
	done
	@echo "$(GREEN)✓ Migrations complete$(RESET)"

migrate-file: ## Run specific migration (FILE=name.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: FILE required$(RESET)"; \
		echo "Usage: make migrate-file FILE=0001_foundation.sql"; \
		exit 1; \
	fi
	@echo "$(CYAN)Running: $(FILE)$(RESET)"
	@cat supabase/migrations/$(FILE) | docker compose $(COMPOSE_DOCKER) exec -T db psql -U postgres -d postgres
	@echo "$(GREEN)✓ Done$(RESET)"

migrate-create: ## Create new migration (NAME=description)
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)Error: NAME required$(RESET)"; \
		echo "Usage: make migrate-create NAME=add_new_table"; \
		exit 1; \
	fi
	@TIMESTAMP=$$(date +%Y%m%d%H%M%S); \
	FILE="supabase/migrations/$${TIMESTAMP}_$(NAME).sql"; \
	echo "-- Migration: $(NAME)" > $$FILE; \
	echo "-- Created: $$(date)" >> $$FILE; \
	echo "" >> $$FILE; \
	echo "$(GREEN)✓ Created: $$FILE$(RESET)"

migrate-reset: ## Reset database (DESTROYS ALL DATA!)
	@echo "$(RED)WARNING: This will DELETE ALL DATA!$(RESET)"
	@read -p "Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		docker compose $(COMPOSE_DOCKER) down -v db; \
		docker compose $(COMPOSE_DOCKER) up -d db; \
		echo "$(CYAN)Waiting for database...$(RESET)"; \
		sleep 10; \
		$(MAKE) migrate; \
	else \
		echo "$(YELLOW)Cancelled$(RESET)"; \
	fi

db-shell: ## PostgreSQL shell
	@docker compose $(COMPOSE_DOCKER) exec db psql -U postgres -d postgres

db-backup: ## Backup database to file
	@BACKUP="backup_$$(date +%Y%m%d_%H%M%S).sql"; \
	docker compose $(COMPOSE_DOCKER) exec -T db pg_dump -U postgres postgres > $$BACKUP; \
	echo "$(GREEN)✓ Saved: $$BACKUP$(RESET)"

db-restore: ## Restore database (FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: FILE required$(RESET)"; \
		echo "Usage: make db-restore FILE=backup_20240101.sql"; \
		exit 1; \
	fi
	@echo "$(CYAN)Restoring from: $(FILE)$(RESET)"
	@docker compose $(COMPOSE_DOCKER) exec -T db psql -U postgres -d postgres < $(FILE)
	@echo "$(GREEN)✓ Restored$(RESET)"

# ===========================================
# CRAWLER
# ===========================================

crawler: ## Start crawler service
	@docker compose $(COMPOSE_DOCKER) up -d crawler
	@echo "$(GREEN)✓ Crawler started$(RESET)"
	@echo "View logs: make logs-crawler"

crawler-local: ## Run crawler locally (not in Docker)
	@cd apps/crawler && python -m src.crawler

geoip: ## Download GeoIP databases
	@echo "$(CYAN)Downloading GeoIP databases...$(RESET)"
	@mkdir -p data/geoip
	@if [ ! -f .env ]; then \
		echo "$(RED)Error: .env not found. Run: make setup-docker$(RESET)"; \
		exit 1; \
	fi
	@if ! docker compose $(COMPOSE_DOCKER) ps crawler 2>/dev/null | grep -q "Up"; then \
		echo "$(YELLOW)Starting crawler container...$(RESET)"; \
		docker compose $(COMPOSE_DOCKER) up -d crawler; \
		sleep 3; \
	fi
	@docker compose $(COMPOSE_DOCKER) exec crawler python -m src.geoip_download /app/data/geoip
	@echo "$(GREEN)✓ GeoIP databases downloaded$(RESET)"

# ===========================================
# DOCKER IMAGE BUILDS
# ===========================================

build-images: ## Rebuild all Docker images (web + crawler)
	@echo "$(CYAN)Rebuilding all Docker images...$(RESET)"
	@docker compose $(COMPOSE_DOCKER) build --no-cache web crawler
	@echo "$(GREEN)✓ Images rebuilt$(RESET)"

build-web: ## Rebuild web image only
	@echo "$(CYAN)Rebuilding web image...$(RESET)"
	@docker compose $(COMPOSE_DOCKER) build --no-cache web
	@echo "$(GREEN)✓ Web image rebuilt$(RESET)"

build-crawler: ## Rebuild crawler image only
	@echo "$(CYAN)Rebuilding crawler image...$(RESET)"
	@docker compose $(COMPOSE_DOCKER) build --no-cache crawler
	@echo "$(GREEN)✓ Crawler image rebuilt$(RESET)"

rebuild: down build-images dev ## Stop, rebuild images, restart

# ===========================================
# CODE QUALITY
# ===========================================

lint: ## Run ESLint
	@pnpm lint

typecheck: ## Run TypeScript check
	@pnpm typecheck

test: ## Run tests
	@pnpm test

format: ## Format code with Prettier
	@pnpm format

build: ## Build for production (pnpm)
	@pnpm build

# ===========================================
# CLEANUP
# ===========================================

clean: ## Clean all build artifacts and node_modules
	@rm -rf node_modules apps/*/node_modules packages/*/node_modules
	@rm -rf apps/web/.next apps/web/.turbo .turbo
	@rm -rf apps/crawler/__pycache__
	@echo "$(GREEN)✓ Cleaned$(RESET)"

docker-clean: ## Remove containers and volumes (DESTROYS DATA!)
	@docker compose $(COMPOSE_DOCKER) down -v --remove-orphans 2>/dev/null || true
	@docker compose $(COMPOSE_CLOUD) down -v --remove-orphans 2>/dev/null || true
	@echo "$(GREEN)✓ Docker cleaned$(RESET)"

reset: clean docker-clean setup-docker ## Full reset (DESTROYS ALL DATA!)

# ===========================================
# UTILITIES
# ===========================================

sync-upstream: ## Pull latest from AtlasP2P upstream
	@echo "$(CYAN)Syncing with upstream...$(RESET)"
	@if ! git remote | grep -q "^upstream$$"; then \
		git remote add upstream https://github.com/RaxTzu/AtlasP2P.git; \
		echo "$(GREEN)✓ Added upstream remote$(RESET)"; \
	fi
	@git fetch upstream
	@git merge upstream/master
	@echo "$(GREEN)✓ Synced with upstream$(RESET)"
	@echo ""
	@echo "$(YELLOW)Next: git push origin master$(RESET)"

check: ## Check system requirements
	@echo "$(CYAN)Checking requirements...$(RESET)"
	@command -v node >/dev/null && echo "$(GREEN)✓ Node.js$(RESET)" || echo "$(RED)✗ Node.js$(RESET)"
	@command -v pnpm >/dev/null && echo "$(GREEN)✓ pnpm$(RESET)" || echo "$(RED)✗ pnpm$(RESET)"
	@command -v docker >/dev/null && echo "$(GREEN)✓ Docker$(RESET)" || echo "$(RED)✗ Docker$(RESET)"
	@command -v python3 >/dev/null && echo "$(GREEN)✓ Python3$(RESET)" || echo "$(RED)✗ Python3$(RESET)"
	@[ -f .env ] && echo "$(GREEN)✓ .env$(RESET)" || echo "$(YELLOW)⚠ .env missing (run: make setup-docker)$(RESET)"
	@[ -f config/project.config.yaml ] && echo "$(GREEN)✓ config$(RESET)" || echo "$(YELLOW)⚠ config missing$(RESET)"

status: ## Show project status
	@echo "$(CYAN)Project Status$(RESET)"
	@echo ""
	@echo "$(YELLOW)Containers:$(RESET)"
	@docker compose $(COMPOSE_DOCKER) ps 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "$(YELLOW)Files:$(RESET)"
	@[ -f .env ] && echo "  $(GREEN)✓$(RESET) .env" || echo "  $(RED)✗$(RESET) .env"
	@[ -f config/project.config.yaml ] && echo "  $(GREEN)✓$(RESET) config/project.config.yaml" || echo "  $(RED)✗$(RESET) config/project.config.yaml"
	@[ -f data/geoip/GeoLite2-City.mmdb ] && echo "  $(GREEN)✓$(RESET) GeoIP database" || echo "  $(YELLOW)⚠$(RESET) GeoIP missing (run: make geoip)"
