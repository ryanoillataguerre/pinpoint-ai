.PHONY: help run run-backend run-web run-dev setup stop rebuild db-migrate db-studio

help:
	@echo "Available targets:"
	@echo "  run          - Run backend stack (docker compose) + web app concurrently"
	@echo "  run-backend  - Run backend stack only (postgres, redis, rabbitmq, api, jobs)"
	@echo "  run-web      - Run Next.js web app only"
	@echo "  setup        - Install dependencies and set up local dev"
	@echo "  stop         - Stop all running services"
	@echo "  rebuild      - Rebuild docker images and run"
	@echo "  db-migrate   - Run Prisma migrations (against dockerized postgres)"
	@echo "  db-studio    - Open Prisma Studio"

setup:
	@echo "Installing web dependencies..."
	cd web && npm install
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Generating Prisma client..."
	cd backend && npx prisma generate
	@echo "Setup complete. Run 'make run' to start."

run:
	@echo ""
	@echo "Starting Pinpoint AI..."
	@echo "  Backend API:  http://localhost:8080"
	@echo "  Job Service:  (docker compose)"
	@echo "  Web App:      http://localhost:3000"
	@echo "  RabbitMQ UI:  http://localhost:15674"
	@echo ""
	@echo "Press Ctrl+C to stop all services"
	@echo ""
	@trap 'echo "Stopping all services..."; docker compose down; pkill -f "next dev" 2>/dev/null || true; exit 0' INT; \
	docker compose down && \
	docker compose up --build & \
	COMPOSE_PID=$$!; \
	sleep 8 && \
	echo "Backend services up, starting web app..." && \
	cd web && npm run dev & \
	WEB_PID=$$!; \
	wait

run-backend:
	@echo "Starting backend stack..."
	docker compose down
	docker compose up --build

run-web:
	@echo "Starting web app..."
	cd web && npm run dev

stop:
	@echo "Stopping all services..."
	docker compose down
	pkill -f "next dev" 2>/dev/null || true
	@echo "All services stopped."

rebuild:
	@echo "Rebuilding all services..."
	docker compose down
	docker compose up --build --remove-orphans

db-migrate:
	@echo "Running migrations against dockerized postgres..."
	cd backend && DATABASE_URL="postgresql://pinpoint:pinpoint@localhost:5442/pinpoint?schema=public" npx prisma migrate dev

db-studio:
	cd backend && DATABASE_URL="postgresql://pinpoint:pinpoint@localhost:5442/pinpoint?schema=public" npx prisma studio
