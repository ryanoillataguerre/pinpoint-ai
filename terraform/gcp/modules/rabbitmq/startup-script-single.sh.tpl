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

# Create RabbitMQ data and config directories
mkdir -p /opt/rabbitmq/data
mkdir -p /opt/rabbitmq/config
mkdir -p /opt/rabbitmq/plugins
chown -R 999:999 /opt/rabbitmq

# Download delayed message exchange plugin
echo "Downloading RabbitMQ delayed message exchange plugin..."
curl -fsSL https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v3.13.0/rabbitmq_delayed_message_exchange-3.13.0.ez \
  -o /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-3.13.0.ez
chown 999:999 /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-3.13.0.ez

# Verify plugin was downloaded
ls -lh /opt/rabbitmq/plugins/
echo "Plugin download complete"

# Create RabbitMQ configuration file
cat > /opt/rabbitmq/config/rabbitmq.conf <<'RABBITMQ_CONF'
# Memory and disk thresholds
vm_memory_high_watermark.relative = 0.6
disk_free_limit.relative = 1.0

# Networking
listeners.tcp.default = 5672
management.tcp.port = 15672

# Logging
log.console = true
log.console.level = info

# Performance tuning
channel_max = 2048
heartbeat = 60
frame_max = 131072
collect_statistics_interval = 10000
RABBITMQ_CONF

chown -R 999:999 /opt/rabbitmq/config

# Stop any existing RabbitMQ container
docker stop rabbitmq-server 2>/dev/null || true
docker rm rabbitmq-server 2>/dev/null || true

# Run RabbitMQ container (without plugin mounted initially)
docker run -d \
  --name rabbitmq-server \
  --hostname ${node_name} \
  -p 5672:5672 \
  -p 15672:15672 \
  -p 15692:15692 \
  -v /opt/rabbitmq/data:/var/lib/rabbitmq \
  -v /opt/rabbitmq/config/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro \
  -e RABBITMQ_DEFAULT_USER="${rabbitmq_username}" \
  -e RABBITMQ_DEFAULT_PASS="${rabbitmq_password}" \
  -e RABBITMQ_ERLANG_COOKIE="${rabbitmq_erlang_cookie}" \
  -e RABBITMQ_NODENAME="${node_name}" \
  --restart always \
  --memory="3g" \
  --cpus="1.5" \
  rabbitmq:3.13-management

# Wait a few seconds for container to start
echo "Waiting for container to start..."
sleep 10

# Copy the plugin into the running container
echo "Installing delayed message exchange plugin..."
docker cp /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-3.13.0.ez \
  rabbitmq-server:/plugins/

# Wait for RabbitMQ to fully start
echo "Waiting for RabbitMQ to start..."
sleep 20

# Check if RabbitMQ is running
docker exec rabbitmq-server rabbitmqctl wait --pid 1 --timeout 60 || {
  echo "RabbitMQ failed to start properly"
  docker logs rabbitmq-server
  exit 1
}

# Enable plugins
echo "Enabling RabbitMQ plugins..."
docker exec rabbitmq-server rabbitmq-plugins enable rabbitmq_management
docker exec rabbitmq-server rabbitmq-plugins enable rabbitmq_prometheus
docker exec rabbitmq-server rabbitmq-plugins enable rabbitmq_delayed_message_exchange
docker exec rabbitmq-server rabbitmq-plugins enable rabbitmq_consistent_hash_exchange

# Verify plugins are enabled
echo "Verifying plugins..."
docker exec rabbitmq-server rabbitmq-plugins list

echo "✓ Plugins enabled successfully"

# Set up health check script
cat > /usr/local/bin/rabbitmq-health-check.sh <<'HEALTH_CHECK'
#!/bin/bash
docker exec rabbitmq-server rabbitmqctl node_health_check || exit 1
HEALTH_CHECK

chmod +x /usr/local/bin/rabbitmq-health-check.sh

# Set up systemd service for health monitoring
cat > /etc/systemd/system/rabbitmq-health.service <<'SYSTEMD_SERVICE'
[Unit]
Description=RabbitMQ Health Check
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/rabbitmq-health-check.sh

[Install]
WantedBy=multi-user.target
SYSTEMD_SERVICE

cat > /etc/systemd/system/rabbitmq-health.timer <<'SYSTEMD_TIMER'
[Unit]
Description=RabbitMQ Health Check Timer
Requires=rabbitmq-health.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
SYSTEMD_TIMER

systemctl daemon-reload
systemctl enable rabbitmq-health.timer
systemctl start rabbitmq-health.timer

# Install Google Cloud Ops Agent for monitoring and logging
echo "Installing Google Cloud Ops Agent..."
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
bash add-google-cloud-ops-agent-repo.sh --also-install

# Configure Ops Agent to collect Docker logs
cat > /etc/google-cloud-ops-agent/config.yaml <<'OPS_AGENT_CONFIG'
logging:
  receivers:
    syslog:
      type: files
      include_paths:
        - /var/log/syslog
        - /var/log/messages
    docker:
      type: files
      include_paths:
        - /var/lib/docker/containers/*/*.log
      record_log_file_path: true
  processors:
    docker_parser:
      type: parse_json
      time_key: time
      time_format: "%Y-%m-%dT%H:%M:%S.%LZ"
  service:
    pipelines:
      default_pipeline:
        receivers: [syslog]
      docker_pipeline:
        receivers: [docker]
        processors: [docker_parser]

metrics:
  receivers:
    hostmetrics:
      type: hostmetrics
      collection_interval: 60s
  processors:
    metrics_filter:
      type: exclude_metrics
      metrics_pattern: []
  service:
    pipelines:
      default_pipeline:
        receivers: [hostmetrics]
OPS_AGENT_CONFIG

# Restart Ops Agent to apply configuration
systemctl restart google-cloud-ops-agent

echo "✓ Google Cloud Ops Agent installed and configured"

echo "RabbitMQ server started successfully on ${node_name}"
echo "Management UI available at http://$(hostname -I | awk '{print $1}'):15672"
echo "AMQP port: 5672"
echo "Username: ${rabbitmq_username}"
