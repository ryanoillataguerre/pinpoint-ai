#!/bin/bash

# Update system packages
apt-get update -y

# Install Redis
apt-get install -y redis-server

# Create Redis configuration
cat > /etc/redis/redis.conf << EOF
# Network configuration
bind 0.0.0.0
port ${redis_port}
protected-mode yes

# Authentication
requirepass ${redis_password}

# Memory and persistence
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence configuration
save 900 1
save 300 10
save 60 10000

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""

# Performance
tcp-keepalive 300
timeout 0

# Disable dangerous commands in production
# rename-command SHUTDOWN SHUTDOWN_REDIS
# rename-command EVAL ""
EOF

# Set proper permissions
chown redis:redis /etc/redis/redis.conf
chmod 640 /etc/redis/redis.conf

# Create log directory
mkdir -p /var/log/redis
chown redis:redis /var/log/redis

# Enable and start Redis service
systemctl enable redis-server
systemctl restart redis-server

# Configure firewall (if ufw is enabled)
if systemctl is-active --quiet ufw; then
    ufw allow ${redis_port}/tcp
fi

# Create a health check script
cat > /usr/local/bin/redis-health-check.sh << 'EOF'
#!/bin/bash
redis-cli -p ${redis_port} -a ${redis_password} ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Redis is healthy"
    exit 0
else
    echo "Redis is not responding"
    exit 1
fi
EOF

chmod +x /usr/local/bin/redis-health-check.sh

# Set up log rotation
cat > /etc/logrotate.d/redis << EOF
/var/log/redis/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    postrotate
        systemctl reload redis-server > /dev/null 2>&1 || true
    endscript
}
EOF

echo "Redis installation and configuration completed" 