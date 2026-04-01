resource "google_compute_instance" "redis_vm" {
  project      = var.project
  zone         = var.zone
  name         = var.instance_name
  machine_type = var.machine_type
  tags         = ["redis-server", var.instance_name] # Tag for firewall rule

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
    # Static internal IP if specified
    dynamic "access_config" {
      for_each = var.internal_ip != null ? [] : [1]
      content {
        # Ephemeral external IP
      }
    }
    network_ip = var.internal_ip
  }

  metadata_startup_script = templatefile("${path.module}/startup-script.sh.tpl", {
    redis_port     = var.redis_port
    redis_password = var.redis_password
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
    service     = "redis"
  }
}

resource "google_compute_firewall" "allow_redis_internal" {
  project     = var.project
  name        = "${var.instance_name}-allow-internal-redis"
  network     = var.network_name
  description = "Allow internal traffic to Redis GCE instance on port ${var.redis_port}"

  allow {
    protocol = "tcp"
    ports    = [tostring(var.redis_port)]
  }

  source_ranges = var.source_ranges_allow_redis
  target_tags   = [var.instance_name] # Apply to instances with this tag
}

resource "google_compute_firewall" "allow_redis_from_home" {
  project = var.project
  name    = "${var.instance_name}-allow-redis-home"
  network = var.network_name

  allow {
    protocol = "tcp"
    ports    = [tostring(var.redis_port)] # usually 6379
  }

  source_ranges = ["45.48.174.4/32"]
  target_tags   = [var.instance_name] # same tag the VM already has
}