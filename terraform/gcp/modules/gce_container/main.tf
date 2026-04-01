# Simplified GCE Container Service using Container-Optimized OS
# Much simpler than custom startup scripts - just declare the container

locals {
  container_declaration = yamlencode({
    spec = {
      containers = [{
        name  = var.service_name
        image = var.docker_image
        env = [for env in var.env_vars : {
          name  = env.key
          value = env.value
        }]
        stdin = false
        tty   = false
      }]
      restartPolicy = "Always"
    }
  })

}

data "google_compute_image" "cos" {
  family  = "cos-stable"
  project = "cos-cloud"
}

resource "google_compute_instance" "service" {
  project      = var.project
  zone         = var.zone
  name         = var.instance_name
  machine_type = var.machine_type
  tags         = concat(["container-vm", var.instance_name], var.network_tags)

  boot_disk {
    initialize_params {
      image = data.google_compute_image.cos.self_link
      size  = var.disk_size_gb
      type  = var.disk_type
    }
  }

  network_interface {
    network    = var.network_name
    subnetwork = var.subnetwork_name

    dynamic "access_config" {
      for_each = var.assign_external_ip ? [1] : []
      content {
        # Ephemeral public IP (needed for pulling images from Artifact Registry)
      }
    }
  }

  metadata = {
    gce-container-declaration = local.container_declaration
    google-logging-enabled    = "true"
    # Prune unused Docker images on every boot and set up a daily timer.
    # This prevents disk exhaustion from accumulated image layers across deployments.
    startup-script = <<-EOT
      #!/bin/bash
      # Prune unused images immediately on boot (catches leftover layers from prior deploys)
      docker system prune -af || true

      # Set up a daily systemd timer so the disk stays clean between reboots
      cat > /etc/systemd/system/docker-prune.service << 'EOF'
      [Unit]
      Description=Docker system prune

      [Service]
      Type=oneshot
      ExecStart=/usr/bin/docker system prune -af
      EOF

      cat > /etc/systemd/system/docker-prune.timer << 'EOF'
      [Unit]
      Description=Daily Docker prune

      [Timer]
      OnCalendar=daily
      Persistent=true

      [Install]
      WantedBy=timers.target
      EOF

      systemctl daemon-reload
      systemctl enable --now docker-prune.timer
    EOT
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = var.preemptible
  }

  service_account {
    email  = var.service_account_email
    scopes = ["cloud-platform"]
  }

  allow_stopping_for_update = true

  labels = merge({
    environment  = var.environment
    service      = var.service_name
    container-vm = "true"
  }, var.labels)
}

# Firewall rule to allow access to the service port
resource "google_compute_firewall" "allow_service_port" {
  project     = var.project
  name        = "${var.instance_name}-allow-port-${var.container_port}"
  network     = var.network_name
  description = "Allow traffic to ${var.service_name} on port ${var.container_port}"

  allow {
    protocol = "tcp"
    ports    = [tostring(var.container_port)]
  }

  source_ranges = var.source_ranges
  target_tags   = [var.instance_name]
}

# Firewall rule to allow SSH (via IAP by default)
resource "google_compute_firewall" "allow_ssh" {
  count       = var.allow_ssh ? 1 : 0
  project     = var.project
  name        = "${var.instance_name}-allow-ssh"
  network     = var.network_name
  description = "Allow SSH access to ${var.service_name}"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = [var.instance_name]
}
