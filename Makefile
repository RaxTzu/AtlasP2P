# ===========================================
# ATLASP2P NODES MAP - MAKEFILE
# ===========================================

.PHONY: help setup dev prod build up down logs clean migrate

CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

.DEFAULT_GOAL := help

# Compose file combinations
COMPOSE_DOCKER := -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_CLOUD := -f docker-compose.cloud.yml
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
	@echo "$(YELLOW)🐳 Local Docker (Full Stack):$(RESET)"
	@echo "  1. make setup-docker   # Setup for local Supabase"
	@echo "  2. make docker-dev     # Start everything in Docker"
	@echo ""
	@echo "$(YELLOW)☁️  Cloud Supabase (Managed DB):$(RESET)"
	@echo "  1. make setup-cloud    # Setup for Supabase Cloud"
	@echo "  2. make cloud-dev      # Start web + crawler only"
	@echo ""
	@echo "$(YELLOW)🚀 Production:$(RESET)"
	@echo "  • make prod-docker     # Self-hosted (all in Docker)"
	@echo "  • make prod-cloud      # Hybrid (cloud DB + Docker app)"
	@echo ""
	@echo "$(YELLOW)🔄 Fork Maintenance:$(RESET)"
	@echo "  • make sync-upstream   # Pull latest from AtlasP2P"
	@echo ""

# ===========================================
# SETUP
# ===========================================

setup-docker: ## Setup for Local Docker (full stack)
	# Creates .env from .env.docker.example for local Supabase in Docker
	# Use this when: You want full control and local database
	# Services: PostgreSQL, Kong, GoTrue, PostgREST, Studio, Web, Crawler, Inbucket
	@echo "$(CYAN)Setting up for Local Docker Supabase...$(RESET)"
	@if [ ! -f .env ]; then \
		cp .env.docker.example .env; \
		echo "$(GREEN)✓ Created .env for Docker mode$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ .env already exists$(RESET)"; \
	fi
	@if [ ! -f config/project.config.yaml ]; then \
		cp config/project.config.yaml.example config/project.config.yaml; \
		echo "$(GREEN)✓ Created config/project.config.yaml$(RESET)"; \
		echo "$(YELLOW)⚠ Customize config/project.config.yaml for your chain!$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ config/project.config.yaml already exists$(RESET)"; \
	fi
	@pnpm install
	@mkdir -p data/geoip apps/web/public/avatars
	@echo ""
	@echo "$(GREEN)✓ Setup complete!$(RESET)"
	@echo "$(CYAN)Next: make docker-dev$(RESET)"

setup-cloud: ## Setup for Cloud Supabase (managed DB)
	# Creates .env from .env.cloud.example for Supabase Cloud
	# Use this when: You want managed database (no PostgreSQL in Docker)
	# Services: Web, Crawler only (database hosted on supabase.com)
	@echo "$(CYAN)Setting up for Cloud Supabase...$(RESET)"
	@if [ ! -f .env ]; then \
		cp .env.cloud.example .env; \
		echo "$(GREEN)✓ Created .env for Cloud mode$(RESET)"; \
		echo "$(YELLOW)⚠ Edit .env with your Supabase credentials!$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ .env already exists$(RESET)"; \
	fi
	@if [ ! -f config/project.config.yaml ]; then \
		cp config/project.config.yaml.example config/project.config.yaml; \
		echo "$(GREEN)✓ Created config/project.config.yaml$(RESET)"; \
		echo "$(YELLOW)⚠ Customize config/project.config.yaml for your chain!$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ config/project.config.yaml already exists$(RESET)"; \
	fi
	@pnpm install
	@mkdir -p data/geoip apps/web/public/avatars
	@echo ""
	@echo "$(YELLOW)Next steps:$(RESET)"
	@echo "  1. Create Supabase project at https://supabase.com"
	@echo "  2. Edit .env and config/project.config.yaml"
	@echo "  3. Run: supabase link && supabase db push"
	@echo "  4. Run: make cloud-dev"

setup-fork: setup-docker ## 🍴 Setup for forking (enables committing config)
	@echo ""
	@echo "$(CYAN)🍴 Configuring for fork...$(RESET)"
	@echo ""
	@echo "$(GREEN)✓ Created config/project.config.yaml from template$(RESET)"
	@echo "$(GREEN)✓ Ready to customize!$(RESET)"
	@echo ""
	@echo "$(CYAN)Next steps:$(RESET)"
	@echo "  1. Edit config/project.config.yaml for your blockchain"
	@echo "     Examples: config/examples/dingocoin.yaml, dogecoin.yaml"
	@echo "  2. Edit .env with your settings"
	@echo "  3. Customize logos in apps/web/public/logos/"
	@echo "  4. Test locally:"
	@echo "     $(YELLOW)make docker-dev$(RESET)"
	@echo "  5. Commit your fork-specific config (use -f to override gitignore):"
	@echo "     $(YELLOW)git add -f config/project.config.yaml$(RESET)"
	@echo "     $(YELLOW)git add .env.docker.example .env.cloud.example$(RESET)"
	@echo "     $(YELLOW)git commit -m \"Configure for YourCoin\"$(RESET)"
	@echo "     $(YELLOW)git push origin master$(RESET)"
	@echo ""
	@echo "$(CYAN)Optional: Validate config$(RESET)"
	@echo "  make config-check"
	@echo ""

# ===========================================
# DEVELOPMENT MODE
# ===========================================

docker-dev: ## 🐳 Start LOCAL Docker Supabase (full stack)
	# Starts all services in Docker (database + app)
	# Breakdown: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	#   - docker-compose.yml: Base Supabase services (PostgreSQL, Kong, GoTrue, etc.)
	#   - docker-compose.dev.yml: Web app + crawler containers
	#   - up -d: Start in background (detached mode)
	# Result: Full stack runs on ports 4000-4025
	@echo "$(CYAN)Starting Local Docker Supabase...$(RESET)"
	@docker compose $(COMPOSE_DOCKER) up -d
	@sleep 5
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║    🐳 LOCAL DOCKER MODE READY         ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Web App:$(RESET)      http://localhost:4000"
	@echo "  $(CYAN)Supabase API:$(RESET) http://localhost:4020"
	@echo "  $(CYAN)Studio:$(RESET)       http://localhost:4022"
	@echo "  $(CYAN)Inbucket:$(RESET)     http://localhost:4023"
	@echo "  $(CYAN)PostgreSQL:$(RESET)   localhost:4021"
	@echo ""

cloud-dev: ## ☁️  Start CLOUD Supabase mode (web + crawler only)
	@echo "$(CYAN)Starting Cloud Supabase mode...$(RESET)"
	@if ! grep -q "supabase.co" .env 2>/dev/null; then \
		echo "$(RED)Error: .env not configured for Supabase Cloud$(RESET)"; \
		echo "Run: make setup-cloud"; \
		exit 1; \
	fi
	@docker compose $(COMPOSE_CLOUD) up -d
	@sleep 3
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║    ☁️  CLOUD SUPABASE MODE READY      ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Web App:$(RESET)      http://localhost:4000"
	@echo "  $(CYAN)Supabase:$(RESET)     $$(grep NEXT_PUBLIC_SUPABASE_URL .env | cut -d= -f2)"
	@echo ""

docker-down: ## Stop Docker mode
	@docker compose $(COMPOSE_DOCKER) down

cloud-down: ## Stop Cloud mode
	@docker compose $(COMPOSE_CLOUD) down

docker-logs: ## Show Docker mode logs
	@docker compose $(COMPOSE_DOCKER) logs -f

cloud-logs: ## Show Cloud mode logs
	@docker compose $(COMPOSE_CLOUD) logs -f

config-reload: ## 🔄 Reload project.config.yaml (restart web only)
	@echo "$(CYAN)Reloading configuration...$(RESET)"
	@docker compose $(COMPOSE_DOCKER) restart web
	@sleep 3
	@echo "$(GREEN)✓ Config reloaded$(RESET)"
	@echo "  Web app restarted at http://localhost:4000"

config-check: ## ✓ Validate project.config.yaml against schema
	@pnpm exec node scripts/validate-config.mjs

dev-web: migrate ## Run web app locally (not in Docker)
	@echo "$(CYAN)Starting web app on port 4000...$(RESET)"
	@-pkill -f "next dev" 2>/dev/null || true
	@-lsof -ti :4000 | xargs kill -9 2>/dev/null || true
	@sleep 1
	@PORT=4000 pnpm --filter @atlasp2p/web dev

# ===========================================
# PRODUCTION MODE
# ===========================================

prod-docker: ## 🚀 Production - Self-Hosted (full Docker stack)
	@echo "$(CYAN)Starting production (self-hosted)...$(RESET)"
	@if [ -z "$(DOMAIN)" ] && ! grep -q "^DOMAIN=" .env 2>/dev/null; then \
		echo "$(RED)Error: DOMAIN not set$(RESET)"; \
		echo "Set DOMAIN in .env or run: make prod-docker DOMAIN=nodes.example.com"; \
		exit 1; \
	fi
	@docker compose $(COMPOSE_PROD_DOCKER) up -d --build
	@sleep 5
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║    🚀 PRODUCTION (DOCKER) READY       ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Website:$(RESET) https://$${DOMAIN:-$$(grep ^DOMAIN= .env 2>/dev/null | cut -d= -f2)}"
	@echo "  $(CYAN)API:$(RESET)     https://$${DOMAIN:-$$(grep ^DOMAIN= .env 2>/dev/null | cut -d= -f2)}/supabase"
	@echo ""
	@echo "$(YELLOW)Note: SSL certificates auto-provisioned by Caddy$(RESET)"
	@echo ""

prod-cloud: ## 🚀 Production - Hybrid (Cloud DB + Docker app)
	@echo "$(CYAN)Starting production (cloud mode)...$(RESET)"
	@if ! grep -q "supabase.co" .env 2>/dev/null; then \
		echo "$(RED)Error: .env not configured for Supabase Cloud$(RESET)"; \
		echo "Add NEXT_PUBLIC_SUPABASE_URL and keys to .env"; \
		exit 1; \
	fi
	@if [ -z "$(DOMAIN)" ] && ! grep -q "^DOMAIN=" .env 2>/dev/null; then \
		echo "$(RED)Error: DOMAIN not set$(RESET)"; \
		echo "Set DOMAIN in .env"; \
		exit 1; \
	fi
	@docker compose $(COMPOSE_PROD_CLOUD) up -d --build
	@sleep 3
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║    🚀 PRODUCTION (CLOUD) READY        ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)Website:$(RESET)  https://$${DOMAIN:-$$(grep ^DOMAIN= .env 2>/dev/null | cut -d= -f2)}"
	@echo "  $(CYAN)Database:$(RESET) $$(grep NEXT_PUBLIC_SUPABASE_URL .env | cut -d= -f2)"
	@echo ""

prod-down: ## Stop production
	@docker compose $(COMPOSE_PROD_DOCKER) down 2>/dev/null || true
	@docker compose $(COMPOSE_PROD_CLOUD) down 2>/dev/null || true

prod-logs: ## Show production logs
	@docker compose $(COMPOSE_PROD_DOCKER) logs -f 2>/dev/null || docker compose $(COMPOSE_PROD_CLOUD) logs -f

prod-restart: ## Restart production (recreates containers to reload env vars)
	@echo "$(CYAN)Restarting production (recreating containers)...$(RESET)"
	@docker compose $(COMPOSE_PROD_DOCKER) up -d --force-recreate 2>/dev/null || docker compose $(COMPOSE_PROD_CLOUD) up -d --force-recreate
	@echo "$(GREEN)✓ Production restarted$(RESET)"

# ===========================================
# DOCKER UTILITIES
# ===========================================

down: ## Stop all Docker services
	@docker compose $(COMPOSE_DOCKER) down 2>/dev/null || true
	@docker compose $(COMPOSE_CLOUD) down 2>/dev/null || true

logs: ## Show Docker logs
	@docker compose $(COMPOSE_DOCKER) logs -f 2>/dev/null || docker compose $(COMPOSE_CLOUD) logs -f

ps: ## Show running containers
	@docker compose $(COMPOSE_DOCKER) ps 2>/dev/null || docker compose $(COMPOSE_CLOUD) ps

docker-clean: ## Remove all containers and volumes (WARNING: destroys data!)
	@docker compose $(COMPOSE_DOCKER) down -v --remove-orphans 2>/dev/null || true
	@docker compose $(COMPOSE_CLOUD) down -v --remove-orphans 2>/dev/null || true
	@echo "$(GREEN)✓ Docker cleaned$(RESET)"

# ===========================================
# DATABASE & MIGRATIONS
# ===========================================

migrate: ## Run database migrations (SQL files)
	@echo "$(CYAN)Applying database migrations...$(RESET)"
	@if docker compose ps db 2>/dev/null | grep -q "Up"; then \
		for file in supabase/migrations/*.sql; do \
			echo "  Running: $$(basename $$file)"; \
			docker compose exec -T db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/$$(basename $$file) 2>/dev/null || \
			cat $$file | docker compose exec -T db psql -U postgres -d postgres; \
		done && \
		echo "$(GREEN)✓ Migrations applied successfully$(RESET)"; \
	else \
		echo "$(RED)✗ Database not running. Start with: make dev$(RESET)"; \
		exit 1; \
	fi

migrate-file: ## Run a specific migration file (usage: make migrate-file FILE=00019_fix.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: FILE required$(RESET)"; \
		echo "Usage: make migrate-file FILE=00019_fix_alert_permissions.sql"; \
		exit 1; \
	fi
	@echo "$(CYAN)Running migration: $(FILE)$(RESET)"
	@cat supabase/migrations/$(FILE) | docker compose exec -T db psql -U postgres -d postgres
	@echo "$(GREEN)✓ Migration applied$(RESET)"

migrate-create: ## Create new migration (usage: make migrate-create NAME=add_feature)
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)Error: NAME required$(RESET)"; \
		echo "Usage: make migrate-create NAME=add_feature"; \
		exit 1; \
	fi
	@TIMESTAMP=$$(date +%Y%m%d%H%M%S); \
	FILE="supabase/migrations/$${TIMESTAMP}_$(NAME).sql"; \
	echo "-- Migration: $(NAME)" > $$FILE; \
	echo "-- Created: $$(date)" >> $$FILE; \
	echo "" >> $$FILE; \
	echo "-- Add your SQL here" >> $$FILE; \
	echo "$(GREEN)✓ Created: $$FILE$(RESET)"

migrate-reset: ## Reset database (WARNING: destroys all data!)
	@echo "$(RED)⚠ WARNING: This will delete ALL data!$(RESET)"
	@read -p "Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		docker compose down -v db; \
		docker compose up -d db; \
		sleep 10; \
		make migrate; \
		echo "$(GREEN)✓ Database reset complete$(RESET)"; \
	else \
		echo "$(YELLOW)Cancelled$(RESET)"; \
	fi

db-shell: ## PostgreSQL shell
	@docker compose exec db psql -U postgres -d postgres

db-backup: ## Backup database
	@BACKUP_FILE="backup_$$(date +%Y%m%d_%H%M%S).sql"; \
	docker compose exec db pg_dump -U postgres postgres > $$BACKUP_FILE; \
	echo "$(GREEN)✓ Backup saved: $$BACKUP_FILE$(RESET)"

db-restore: ## Restore database (usage: make db-restore FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: FILE required$(RESET)"; \
		echo "Usage: make db-restore FILE=backup.sql"; \
		exit 1; \
	fi
	@docker compose exec -T db psql -U postgres -d postgres < $(FILE)
	@echo "$(GREEN)✓ Database restored$(RESET)"

# ===========================================
# CRAWLER
# ===========================================

crawler: ## Start crawler service (Docker)
	@echo "$(CYAN)Starting crawler service...$(RESET)"
	@docker compose $(COMPOSE_DOCKER) up -d crawler
	@echo "$(GREEN)✓ Crawler started$(RESET)"
	@echo "View logs: $(CYAN)make crawler-logs$(RESET)"

crawler-prod: ## Start crawler in production
	@docker compose $(COMPOSE_PROD_DOCKER) up -d crawler

crawler-dev: ## Run crawler locally (once)
	@cd apps/crawler && python -m src.crawler

crawler-logs: ## Show crawler logs
	@docker compose logs -f crawler

geoip: ## Download GeoIP databases
	@echo "$(CYAN)Downloading GeoIP...$(RESET)"
	@mkdir -p data/geoip
	@if [ -f .env ]; then \
		export $$(grep -v '^#' .env | xargs) && \
		cd apps/crawler && python3 -m src.geoip_download ../../data/geoip; \
	else \
		echo "$(RED)Error: .env not found. Run: make env$(RESET)"; \
		exit 1; \
	fi

# ===========================================
# CODE QUALITY
# ===========================================

lint: ## Run linter
	@pnpm lint

typecheck: ## TypeScript check
	@pnpm typecheck

test: ## Run tests
	@pnpm test

format: ## Format code
	@pnpm format

build: ## Build for production
	@echo "$(CYAN)Building...$(RESET)"
	@pnpm build

# ===========================================
# CLEANUP
# ===========================================

clean-cache: ## Clean Next.js cache only
	@echo "$(CYAN)Cleaning Next.js cache...$(RESET)"
	@chmod -R 755 apps/web/.next apps/web/.turbo 2>/dev/null || true
	@rm -rf apps/web/.next apps/web/.turbo
	@echo "$(GREEN)✓ Cache cleaned$(RESET)"

clean: ## Clean build artifacts
	@echo "$(CYAN)Cleaning...$(RESET)"
	@rm -rf node_modules apps/*/node_modules packages/*/node_modules
	@chmod -R 755 apps/web/.next apps/web/.turbo 2>/dev/null || true
	@rm -rf apps/web/.next .turbo
	@rm -rf apps/crawler/__pycache__ apps/crawler/*.pyc
	@echo "$(GREEN)✓ Cleaned$(RESET)"

reset: clean docker-clean setup-docker ## Full reset (destroys all data!)

# ===========================================
# UTILITIES
# ===========================================

sync-upstream: ## Sync latest changes from AtlasP2P upstream
	@echo "$(CYAN)Syncing with AtlasP2P upstream...$(RESET)"
	@if ! git remote | grep -q "^upstream$$"; then \
		echo "$(YELLOW)Adding AtlasP2P as upstream remote...$(RESET)"; \
		git remote add upstream https://github.com/RaxTzu/AtlasP2P.git; \
		echo "$(GREEN)✓ Upstream remote added$(RESET)"; \
	fi
	@echo "$(CYAN)Fetching from upstream...$(RESET)"
	@git fetch upstream
	@echo "$(CYAN)Merging upstream/master into current branch...$(RESET)"
	@git merge upstream/master
	@echo ""
	@echo "$(GREEN)╔═══════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║    ✓ SYNCED WITH ATLASP2P UPSTREAM    ║$(RESET)"
	@echo "$(GREEN)╚═══════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(YELLOW)Next steps:$(RESET)"
	@echo "  1. Review changes: $(CYAN)git log$(RESET)"
	@echo "  2. Test locally: $(CYAN)make docker-dev$(RESET)"
	@echo "  3. Push to your fork: $(CYAN)git push origin master$(RESET)"
	@echo ""

check: ## Check system requirements
	@echo "$(CYAN)Checking requirements...$(RESET)"
	@command -v node >/dev/null 2>&1 && echo "$(GREEN)✓ Node.js installed$(RESET)" || echo "$(RED)✗ Node.js not found$(RESET)"
	@command -v pnpm >/dev/null 2>&1 && echo "$(GREEN)✓ pnpm installed$(RESET)" || echo "$(RED)✗ pnpm not found$(RESET)"
	@command -v docker >/dev/null 2>&1 && echo "$(GREEN)✓ Docker installed$(RESET)" || echo "$(RED)✗ Docker not found$(RESET)"
	@command -v python3 >/dev/null 2>&1 && echo "$(GREEN)✓ Python3 installed$(RESET)" || echo "$(RED)✗ Python3 not found$(RESET)"
	@[ -f .env ] && echo "$(GREEN)✓ .env exists$(RESET)" || echo "$(YELLOW)⚠ .env not found (run: make env)$(RESET)"

status: ## Show project status
	@echo "$(CYAN)Project Status:$(RESET)"
	@echo ""
	@docker compose ps 2>/dev/null || echo "$(YELLOW)Docker not running$(RESET)"
	@echo ""
	@[ -f .env ] && echo "$(GREEN)✓ .env configured$(RESET)" || echo "$(RED)✗ .env missing$(RESET)"
	@[ -d data/geoip ] && echo "$(GREEN)✓ GeoIP directory exists$(RESET)" || echo "$(YELLOW)⚠ GeoIP directory missing$(RESET)"
	@[ -f data/geoip/GeoLite2-City.mmdb ] && echo "$(GREEN)✓ GeoIP database exists$(RESET)" || echo "$(YELLOW)⚠ GeoIP database missing (run: make geoip)$(RESET)"
