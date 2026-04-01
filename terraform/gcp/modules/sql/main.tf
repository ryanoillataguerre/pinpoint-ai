resource "google_sql_database_instance" "default" {
  database_version = "POSTGRES_17"
  name             = var.db_name
  project          = var.project
  region           = var.region

  settings {
    edition           = "ENTERPRISE"
    availability_type = var.availability_type
    pricing_plan      = "PER_USE"
    tier              = var.db_tier

    database_flags {
      name  = "max_connections"
      value = var.max_connections
    }

    # necessary for change logs
    database_flags {
      name  = "cloudsql.logical_decoding"
      value = var.logical_decoding
    }

    backup_configuration {
      enabled  = var.backups_enabled
      location = "us"
    }

    disk_autoresize       = true
    disk_autoresize_limit = 50
    disk_size             = var.disk_size
    disk_type             = "PD_SSD"

    insights_config {
      query_insights_enabled = false
    }

    ip_configuration {
      ipv4_enabled    = true
      private_network = var.private_network_link
    }

    location_preference {
      zone = "us-west1-a"
    }

    maintenance_window {
      day  = 1
      hour = 1
    }
  }

  lifecycle {
    ignore_changes = [settings[0].ip_configuration]
  }
}

resource "random_password" "password" {
  length           = 32
  special          = true
  override_special = "1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"
}

# # Wait for instance to be ready before creating user
# resource "time_sleep" "wait_for_instance" {
#   depends_on = [google_sql_database_instance.default]
#   create_duration = "90s"
# }

resource "google_sql_user" "db_master_user" {
  # depends_on = [time_sleep.wait_for_instance]
  instance = google_sql_database_instance.default.name
  name     = "postgres"
  password = random_password.password.result
}

# Create additional databases if specified
resource "google_sql_database" "additional_databases" {
  for_each = toset(var.additional_databases)
  name     = each.value
  instance = google_sql_database_instance.default.name
  project  = var.project
  # depends_on = [time_sleep.wait_for_instance]
}
