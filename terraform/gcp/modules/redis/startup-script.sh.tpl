#!/bin/bash
set -euxo pipefail

# Update system
apt-get update
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Install Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Ensure Docker starts on boot
systemctl enable docker
systemctl start docker

# Create Redis data directory with proper permissions
mkdir -p /opt/redis/data
chown -R 999:999 /opt/redis/data

# Stop any existing Redis container
docker stop redis-server 2>/dev/null || true
docker rm redis-server 2>/dev/null || true

# Build Redis command
REDIS_COMMAND="redis-server --bind 0.0.0.0 --save '' --appendonly no --maxmemory 128mb --maxmemory-policy allkeys-lru"

if [ -n "${redis_password}" ]; then
  REDIS_COMMAND="$REDIS_COMMAND --requirepass ${redis_password}"
fi

# Run Redis container with proper configuration
docker run -d \
  --name redis-server \
  -p ${redis_port}:6379 \
  -v /opt/redis/data:/data \
  --restart always \
  --memory="256m" \
  --cpus="0.5" \
  redis:7-alpine \
  /bin/sh -c "$REDIS_COMMAND"

# Wait for Redis to start and test connection
sleep 10
docker exec redis-server redis-cli ping || {
  echo "Redis failed to start properly"
  docker logs redis-server
  exit 1
}

echo "Redis server started successfully" 