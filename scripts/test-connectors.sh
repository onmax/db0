#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== db0 Connector Test Suite ===${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running${NC}"
  exit 1
fi

# Start Docker containers
echo -e "${YELLOW}Starting Docker containers...${NC}"
docker compose -f docker-compose.test.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 5

# Check health status
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  healthy=$(docker compose -f docker-compose.test.yml ps --format json 2>/dev/null | grep -c '"healthy"' || echo "0")
  total=$(docker compose -f docker-compose.test.yml ps -q 2>/dev/null | wc -l | tr -d ' ')

  if [ "$healthy" -ge 4 ]; then
    echo -e "${GREEN}All services healthy!${NC}"
    break
  fi

  echo "  Waiting... ($healthy/$total healthy)"
  sleep 2
  attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
  echo -e "${YELLOW}Warning: Not all services are healthy, but continuing...${NC}"
  docker compose -f docker-compose.test.yml ps
fi

echo ""
echo -e "${YELLOW}Running tests...${NC}"
echo ""

# Export environment variables for tests
export POSTGRESQL_URL="postgres://postgres:postgres@localhost:15432/test"
export MYSQL_URL="mysql://root:root@localhost:13306/test"
export MARIADB_URL="mysql://root:root@localhost:13307/test"
export MARIADB_HOST="localhost"
export MARIADB_PORT="13307"
export MARIADB_USER="root"
export MARIADB_PASSWORD="root"
export MARIADB_DATABASE="test"
export MSSQL_URL="mssql://localhost:11433"
export MSSQL_HOST="localhost"
export MSSQL_PORT="11433"
export MSSQL_USER="sa"
export MSSQL_PASSWORD="Test@12345"
export MSSQL_DATABASE="master"

# Neon local proxy (uses the postgres container via neon-proxy)
export NEON_HTTP_URL="postgres://postgres:postgres@localhost:4444/test"

# Run specific test groups based on argument
case "${1:-all}" in
  "sqlite")
    echo -e "${GREEN}Testing SQLite connectors...${NC}"
    npx vitest run test/connectors/better-sqlite3.test.ts test/connectors/node-sqlite.test.ts test/connectors/sqlite3.test.ts
    ;;
  "postgresql")
    echo -e "${GREEN}Testing PostgreSQL connectors...${NC}"
    npx vitest run test/connectors/postgresql.test.ts test/connectors/pg.test.ts test/connectors/postgresql-pool.test.ts test/connectors/pglite.test.ts
    ;;
  "mysql")
    echo -e "${GREEN}Testing MySQL connectors...${NC}"
    npx vitest run test/connectors/mysql2.test.ts test/connectors/mysql-pool.test.ts test/connectors/mariadb.test.ts
    ;;
  "mssql")
    echo -e "${GREEN}Testing MSSQL connector...${NC}"
    npx vitest run test/connectors/mssql.test.ts
    ;;
  "neon")
    echo -e "${GREEN}Testing Neon connectors...${NC}"
    npx vitest run test/connectors/neon-http.test.ts test/connectors/neon-ws.test.ts
    ;;
  "http")
    echo -e "${GREEN}Testing HTTP connector...${NC}"
    npx vitest run test/connectors/http.test.ts
    ;;
  "libsql")
    echo -e "${GREEN}Testing LibSQL connector...${NC}"
    npx vitest run test/connectors/libsql.test.ts
    ;;
  "mobile")
    echo -e "${GREEN}Testing mobile connectors (mocked)...${NC}"
    npx vitest run test/connectors/capacitor-sqlite.test.ts test/connectors/cordova-sqlite.test.ts
    ;;
  "bun")
    echo -e "${GREEN}Testing Bun SQLite connector (via Docker)...${NC}"
    docker compose -f docker-compose.test.yml --profile bun run --rm bun
    ;;
  "integrations")
    echo -e "${GREEN}Testing integrations...${NC}"
    npx vitest run test/integrations/
    ;;
  "all")
    echo -e "${GREEN}Running all connector tests...${NC}"
    npx vitest run test/connectors/ test/integrations/
    ;;
  "quick")
    echo -e "${GREEN}Running quick tests (no cloud deps)...${NC}"
    npx vitest run test/connectors/better-sqlite3.test.ts \
      test/connectors/postgresql.test.ts \
      test/connectors/mysql2.test.ts \
      test/connectors/http.test.ts \
      test/connectors/pglite.test.ts
    ;;
  *)
    echo "Usage: $0 [sqlite|postgresql|mysql|mssql|neon|http|libsql|mobile|bun|integrations|all|quick]"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Tests completed!${NC}"
echo ""

# Optionally stop containers
if [ "${KEEP_CONTAINERS:-0}" != "1" ]; then
  echo -e "${YELLOW}Stopping Docker containers...${NC}"
  docker compose -f docker-compose.test.yml down
else
  echo -e "${YELLOW}Keeping containers running (KEEP_CONTAINERS=1)${NC}"
fi
