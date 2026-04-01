# ─── Enable GCP APIs ─────────────────────────────────────────

resource "google_project_service" "run-api" {
  project                    = var.gcp_project
  service                    = "run.googleapis.com"
  disable_on_destroy         = true
  disable_dependent_services = true
}

resource "google_project_service" "vpcaccess-api" {
  project                    = var.gcp_project
  service                    = "vpcaccess.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = true
}

resource "google_project_service" "sqladmin-api" {
  project                    = var.gcp_project
  service                    = "sqladmin.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = true
}

resource "google_project_service" "artifactregistry-api" {
  project                    = var.gcp_project
  service                    = "artifactregistry.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = true
}

resource "google_project_service" "servicenetworking-api" {
  project                    = var.gcp_project
  service                    = "servicenetworking.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = true
}

resource "google_project_service" "iam-api" {
  project                    = var.gcp_project
  service                    = "iam.googleapis.com"
  disable_on_destroy         = true
  disable_dependent_services = true
}

resource "google_project_service" "oidc-api" {
  project                    = var.gcp_project
  service                    = "iamcredentials.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = true

  depends_on = [google_project_service.iam-api]
}

resource "google_project_service" "compute-api" {
  project                    = var.gcp_project
  service                    = "compute.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = false
}

resource "google_project_service" "storage-api" {
  project                    = var.gcp_project
  service                    = "storage.googleapis.com"
  disable_on_destroy         = true
  disable_dependent_services = true
}

resource "google_project_service" "monitoring-api" {
  project                    = var.gcp_project
  service                    = "monitoring.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = false
}

resource "google_project_service" "logging-api" {
  project                    = var.gcp_project
  service                    = "logging.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = false
}

# ─── VPC Network ─────────────────────────────────────────────

module "vpc" {
  source  = "../modules/vpc"
  project = var.gcp_project
  name    = "prod-vpc"
  region  = "us-west1"

  depends_on = [google_project_service.servicenetworking-api, google_project_service.vpcaccess-api]
}

# ─── Cloud Storage (uploads, exports) ────────────────────────

module "app_data_bucket" {
  source   = "../modules/bucket"
  project  = var.gcp_project
  location = "US"
  name     = "pinpoint-ai-data-prod"
}

# ─── Cloud SQL (PostgreSQL 17 with pgvector) ─────────────────

module "sql_db" {
  source               = "../modules/sql"
  project              = var.gcp_project
  db_name              = "production-core"
  region               = "us-west1"
  db_tier              = "db-f1-micro" # Start small, upgrade as needed
  disk_size            = 20
  backups_enabled      = true
  private_network_link = module.vpc.private_network_link
  max_connections      = 1000

  depends_on = [module.vpc, google_project_service.sqladmin-api]
}

# ─── Artifact Registry ──────────────────────────────────────

module "api_service_ar_repo" {
  source  = "../modules/ar_repo"
  project = var.gcp_project
  repo_id = "api-service-production"

  depends_on = [google_project_service.artifactregistry-api]
}

module "job_service_ar_repo" {
  source  = "../modules/ar_repo"
  project = var.gcp_project
  repo_id = "job-service-production"

  depends_on = [google_project_service.artifactregistry-api]
}

# ─── Redis (GCE) ────────────────────────────────────────────

module "redis" {
  source          = "../modules/redis"
  project         = var.gcp_project
  region          = "us-west1"
  zone            = "us-west1-a"
  instance_name   = "production-redis"
  machine_type    = "e2-micro"
  network_name    = module.vpc.name
  subnetwork_name = module.vpc.gce_subnetwork_self_link
  source_ranges_allow_redis = [
    module.vpc.gce_subnetwork_ip_cidr_range,
    module.vpc.subnetwork_ip_cidr_range
  ]

  depends_on = [module.vpc, google_project_service.run-api]
}

# ─── RabbitMQ (GCE) ─────────────────────────────────────────

resource "random_string" "rabbitmq_erlang_cookie" {
  length  = 32
  special = false
}

module "rabbitmq" {
  source = "../modules/rabbitmq"

  project       = var.gcp_project
  region        = "us-west1"
  zone          = "us-west1-a"
  instance_name = "production-rabbitmq"
  machine_type  = "e2-micro"

  network_name    = module.vpc.name
  subnetwork_name = module.vpc.gce_subnetwork_self_link
  internal_ip     = "10.10.1.10"

  source_ranges_allow_rabbitmq = [
    module.vpc.gce_subnetwork_ip_cidr_range,
    module.vpc.subnetwork_ip_cidr_range
  ]

  rabbitmq_username      = "admin"
  rabbitmq_password      = var.rabbitmq_password
  rabbitmq_erlang_cookie = random_string.rabbitmq_erlang_cookie.result

  service_account_email = "terraform@${var.gcp_project}.iam.gserviceaccount.com"
  environment           = "production"

  depends_on = [module.vpc, google_project_service.run-api]
}

# ─── Cloud Run Services ─────────────────────────────────────

locals {
  common_env_vars = [
    {
      key   = "DATABASE_URL"
      value = "postgres://postgres:${module.sql_db.db_user_password}@${module.sql_db.private_ip_address}:5432/postgres"
    },
    {
      key   = "REDIS_URL"
      value = "redis://${module.redis.redis_host_internal_ip}:${module.redis.redis_port}"
    },
    {
      key   = "RABBITMQ_URL"
      value = module.rabbitmq.rabbitmq_connection_string
    },
    {
      key   = "NODE_ENV"
      value = "production"
    },
    {
      key   = "JWT_ACCESS_SECRET"
      value = var.jwt_access_secret
    },
    {
      key   = "JWT_REFRESH_SECRET"
      value = var.jwt_refresh_secret
    },
    {
      key   = "ANTHROPIC_API_KEY"
      value = var.anthropic_api_key
    },
    {
      key   = "OPENROUTER_API_KEY"
      value = var.openrouter_api_key
    },
    {
      key   = "KEEPA_API_KEY"
      value = var.keepa_api_key
    },
    {
      key   = "STRIPE_SECRET_KEY"
      value = var.stripe_secret_key
    },
    {
      key   = "STRIPE_WEBHOOK_SECRET"
      value = var.stripe_webhook_secret
    },
    {
      key   = "GCS_BUCKET_NAME"
      value = module.app_data_bucket.name
    },
    {
      key   = "GCP_PROJECT_ID"
      value = var.gcp_project
    },
    {
      key   = "GOOGLE_CLIENT_ID"
      value = var.google_client_id
    },
  ]
}

# API Service (Cloud Run)
module "api_service" {
  name     = "api-service-production"
  location = "us-west1"
  project  = var.gcp_project

  source = "../modules/cloudrun"

  image = "us-west1-docker.pkg.dev/${var.gcp_project}/api-service-production/api-service:latest"

  allow_public_access  = true
  ingress              = "all"
  cloudsql_connections = [module.sql_db.connection_name]
  concurrency          = 100
  cpus                 = 1
  timeout              = 60
  env = concat(local.common_env_vars, [
    {
      key   = "FRONTEND_URL"
      value = "https://pinpoint-ai.vercel.app" # Update with actual domain
    },
  ])
  execution_environment          = "gen2"
  http2                          = false
  max_instances                  = 5
  min_instances                  = 1
  memory                         = 512
  container_port                 = 8080
  startup_initial_delay_seconds  = 10
  liveness_initial_delay_seconds = 10
  vpc_access = {
    connector = module.vpc.connector_id
    egress    = "private-ranges-only"
  }
  startup_probe_http = [{
    port = 8080
    path = "/healthcheck"
  }]
  liveness_probe_http = [{
    port = 8080
    path = "/healthcheck"
  }]

  depends_on = [
    module.vpc,
    module.sql_db,
    module.api_service_ar_repo,
    module.redis,
    module.rabbitmq,
    google_project_service.run-api,
  ]
}

# Job Service (GCE Container — ~$13/month vs ~$150/month on Cloud Run)
module "job_service_gce" {
  source = "../modules/gce_container"

  project       = var.gcp_project
  zone          = "us-west1-a"
  instance_name = "production-job-service"
  service_name  = "job-service"
  machine_type  = "e2-small"

  network_name    = module.vpc.name
  subnetwork_name = module.vpc.gce_subnetwork_self_link

  source_ranges = [
    module.vpc.gce_subnetwork_ip_cidr_range,
    module.vpc.subnetwork_ip_cidr_range
  ]

  service_account_email = "terraform@${var.gcp_project}.iam.gserviceaccount.com"
  environment           = "production"

  docker_image   = "us-west1-docker.pkg.dev/${var.gcp_project}/job-service-production/job-service:latest"
  container_port = 8080
  env_vars       = local.common_env_vars

  depends_on = [
    module.vpc,
    module.sql_db,
    module.redis,
    module.rabbitmq,
    module.job_service_ar_repo,
  ]
}

# ─── GitHub Actions (CI/CD) ─────────────────────────────────

module "github_actions" {
  source = "../modules/github_actions"

  project_id            = var.gcp_project
  pool_id               = "production-gha-pool"
  pool_display_name     = "Github Action Pool - Production"
  provider_id           = "production-gha-provider"
  provider_display_name = "GHA Provider - Production"
  # Update with your GitHub org/repo
  attribute_condition = "assertion.repository == \"your-org/pinpoint-ai\" && assertion.ref == \"refs/heads/main\""
  sa_mapping = {
    "production-gha-workload-identity" = {
      sa_name   = "projects/${var.gcp_project}/serviceAccounts/terraform@${var.gcp_project}.iam.gserviceaccount.com",
      attribute = "*"
    }
  }
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.aud"        = "assertion.aud"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
}

# ─── IAM ─────────────────────────────────────────────────────

# Monitoring permissions for GCE instances
resource "google_project_iam_member" "monitoring_metric_writer" {
  project = var.gcp_project
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:terraform@${var.gcp_project}.iam.gserviceaccount.com"

  depends_on = [google_project_service.monitoring-api]
}

resource "google_project_iam_member" "logging_log_writer" {
  project = var.gcp_project
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:terraform@${var.gcp_project}.iam.gserviceaccount.com"

  depends_on = [google_project_service.logging-api]
}

# ─── Outputs ─────────────────────────────────────────────────

output "api_service_url" {
  description = "Cloud Run URL for the API service"
  value       = module.api_service.url
}

output "sql_private_ip" {
  description = "Cloud SQL private IP"
  value       = module.sql_db.private_ip_address
}

output "redis_internal_ip" {
  description = "Redis internal IP"
  value       = module.redis.redis_host_internal_ip
}

output "rabbitmq_internal_ip" {
  description = "RabbitMQ internal IP"
  value       = module.rabbitmq.rabbitmq_internal_ip
}
