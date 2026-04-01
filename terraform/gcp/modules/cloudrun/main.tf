resource "google_cloud_run_service" "default" {
  name                       = var.name
  location                   = var.location
  autogenerate_revision_name = true
  project                    = var.project

  metadata {
    annotations = {
      "run.googleapis.com/ingress" = var.ingress
    }
  }

  template {
    spec {
      container_concurrency = var.concurrency
      service_account_name  = var.service_account_email
      timeout_seconds       = var.timeout
      containers {
        image = var.image
        resources {
          limits = {
            cpu    = "${var.cpus * 1000}m"
            memory = "${var.memory}Mi"
          }
        }
        ports {
          name           = var.http2 ? "h2c" : "http1"
          container_port = var.container_port
        }

        # Populate environment variables.
        dynamic "env" {
          for_each = var.env

          content {
            name  = env.value.key
            value = env.value.value
          }
        }

        # Conditionally include startup_probe if variables are provided
        dynamic "startup_probe" {
          for_each = (length(var.startup_probe_http) > 0 || length(var.startup_probe_grpc) > 0) ? [1] : []
          content {
            initial_delay_seconds = var.startup_initial_delay_seconds
            failure_threshold     = 3
            period_seconds        = 60

            dynamic "http_get" {
              for_each = var.startup_probe_http

              content {
                port = http_get.value.port
                path = http_get.value.path
              }
            }

            dynamic "grpc" {
              for_each = var.startup_probe_grpc

              content {
                service = grpc.value.service
                port    = var.container_port
              }
            }
          }
        }

        # Conditionally include liveness_probe if variables are provided
        dynamic "liveness_probe" {
          for_each = (length(var.liveness_probe_http) > 0 || length(var.liveness_probe_grpc) > 0) ? [1] : []
          content {
            initial_delay_seconds = var.liveness_initial_delay_seconds
            failure_threshold     = 3
            period_seconds        = 360

            dynamic "http_get" {
              for_each = var.liveness_probe_http

              content {
                port = http_get.value.port
                path = http_get.value.path
              }
            }

            dynamic "grpc" {
              for_each = var.liveness_probe_grpc

              content {
                service = grpc.value.service
                port    = var.container_port
              }
            }
          }
        }
      }
    }
    metadata {
      labels = var.labels

      annotations = merge({
        "run.googleapis.com/startup-cpu-boost"     = "false"
        "run.googleapis.com/cpu-throttling"        = var.cpu_throttling
        "autoscaling.knative.dev/minScale"         = "${var.min_instances}"
        "autoscaling.knative.dev/maxScale"         = "${var.max_instances}"
        "client.knative.dev/user-image"            = var.image
        "run.googleapis.com/cloudsql-instances"    = join(",", var.cloudsql_connections)
        "run.googleapis.com/client-name"           = "terraform"
        "run.googleapis.com/execution-environment" = var.execution_environment
        "run.googleapis.com/mount-fuse"            = "true"
        },
        var.vpc_access.connector == null ? {} : {
          "run.googleapis.com/vpc-access-connector" = var.vpc_access.connector
          "run.googleapis.com/vpc-access-egress"    = var.vpc_access.egress
        }
      )
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  lifecycle {
    # Ignore changes to ingress-status at all levels since Cloud Run manages this
    ignore_changes = [
      template[0].metadata[0].annotations["client.knative.dev/user-image"],
      template[0].metadata[0].annotations["run.googleapis.com/client-name"],
      template[0].metadata[0].annotations["run.googleapis.com/client-version"],
      template[0].metadata[0].annotations["run.googleapis.com/sandbox"],
      template[0].metadata[0].annotations["run.googleapis.com/ingress-status"],
      template[0].metadata[0].annotations["run.googleapis.com/mount-fuse"],
      template[0].metadata[0].labels["run.googleapis.com/startupProbeType"],
      template[0].metadata[0].labels["commit-sha"],
      template[0].metadata[0].labels["managed-by"],
      template[0].metadata[0].labels["goog-terraform-provisioned"],
      metadata[0].annotations["client.knative.dev/user-image"],
      metadata[0].annotations["run.googleapis.com/client-name"],
      metadata[0].annotations["run.googleapis.com/client-version"],
      metadata[0].annotations["run.googleapis.com/launch-stage"],
      metadata[0].annotations["serving.knative.dev/creator"],
      metadata[0].annotations["serving.knative.dev/lastModifier"],
      metadata[0].annotations["run.googleapis.com/ingress-status"],
      metadata[0].labels["cloud.googleapis.com/location"],
      template[0].metadata[0].labels["client.knative.dev/nonce"],
      template[0].spec[0].containers[0].image,
      template[0].spec[0].containers[0].startup_probe,
      template[0].spec[0].containers[0].liveness_probe
    ]
  }
}

resource "google_cloud_run_service_iam_member" "public_access" {
  count    = var.allow_public_access ? 1 : 0
  service  = google_cloud_run_service.default.name
  location = google_cloud_run_service.default.location
  project  = google_cloud_run_service.default.project
  role     = "roles/run.invoker"
  member   = "allUsers"
}
