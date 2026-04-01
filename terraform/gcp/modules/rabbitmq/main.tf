# Single RabbitMQ Node
# Simple, cost-effective deployment

resource "google_compute_instance" "rabbitmq" {
  project      = var.project
  zone         = var.zone
  name         = var.instance_name
  machine_type = var.machine_type
  tags         = ["rabbitmq-server", var.instance_name]

  boot_disk {
    initialize_params {
      image = var.boot_disk_image
      size  = var.disk_size_gb
      type  = "pd-standard"
    }
  }

  network_interface {
    network    = var.network_name
    subnetwork = var.subnetwork_name
    network_ip = var.internal_ip

    # Ephemeral external IP for package downloads
    access_config {
      # Ephemeral public IP
    }
  }

  metadata_startup_script = templatefile("${path.module}/startup-script-single.sh.tpl", {
    rabbitmq_username      = var.rabbitmq_username
    rabbitmq_password      = var.rabbitmq_password
    rabbitmq_erlang_cookie = var.rabbitmq_erlang_cookie
    node_name              = var.instance_name
  })

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  service_account {
    email  = var.service_account_email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  allow_stopping_for_update = true

  labels = {
    environment = var.environment
    service     = "rabbitmq"
  }
}

# Firewall rule to allow internal access to RabbitMQ AMQP
resource "google_compute_firewall" "allow_rabbitmq_amqp" {
  project     = var.project
  name        = "${var.instance_name}-allow-amqp"
  network     = var.network_name
  description = "Allow internal traffic to RabbitMQ AMQP on port 5672"

  allow {
    protocol = "tcp"
    ports    = ["5672"]
  }

  source_ranges = var.source_ranges_allow_rabbitmq
  target_tags   = [var.instance_name]
}

# Firewall rule to allow internal access to RabbitMQ Management UI
resource "google_compute_firewall" "allow_rabbitmq_management" {
  project     = var.project
  name        = "${var.instance_name}-allow-management"
  network     = var.network_name
  description = "Allow internal traffic to RabbitMQ Management UI on port 15672"

  allow {
    protocol = "tcp"
    ports    = ["15672"]
  }

  source_ranges = var.source_ranges_allow_rabbitmq
  target_tags   = [var.instance_name]
}

# Firewall rule for Prometheus metrics
resource "google_compute_firewall" "allow_rabbitmq_prometheus" {
  project     = var.project
  name        = "${var.instance_name}-allow-prometheus"
  network     = var.network_name
  description = "Allow access to RabbitMQ Prometheus metrics on port 15692"

  allow {
    protocol = "tcp"
    ports    = ["15692"]
  }

  source_ranges = var.source_ranges_allow_rabbitmq
  target_tags   = [var.instance_name]
}

# Optional: Firewall rule to allow access from specific IP (e.g., home)
resource "google_compute_firewall" "allow_rabbitmq_from_home" {
  count       = var.allow_home_access ? 1 : 0
  project     = var.project
  name        = "${var.instance_name}-allow-home"
  network     = var.network_name
  description = "Allow access to RabbitMQ Management UI from home"

  allow {
    protocol = "tcp"
    ports    = ["15672"]
  }

  source_ranges = ["76.32.136.81/32", "166.205.190.39/32"]
  target_tags   = [var.instance_name]
}
