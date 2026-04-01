# GCP authentication file
variable "gcp_auth_file" {
  type        = string
  description = "GCP authentication file"
}

# GCP region
variable "gcp_region" {
  type        = string
  description = "GCP region"
}

# GCP project name
variable "gcp_project" {
  type        = string
  description = "GCP project name"
}

# ─── Auth ────────────────────────────────────────────────
variable "jwt_access_secret" {
  type        = string
  description = "JWT access token secret"
  sensitive   = true
}

variable "jwt_refresh_secret" {
  type        = string
  description = "JWT refresh token secret"
  sensitive   = true
}

# ─── LLM Providers ──────────────────────────────────────
variable "anthropic_api_key" {
  type        = string
  description = "Anthropic API key for Claude"
  sensitive   = true
}

variable "openrouter_api_key" {
  type        = string
  description = "OpenRouter API key for LLM fallback"
  sensitive   = true
}

# ─── External APIs ──────────────────────────────────────
variable "keepa_api_key" {
  type        = string
  description = "Keepa API key for Amazon pricing data"
  sensitive   = true
}

# ─── Stripe ─────────────────────────────────────────────
variable "stripe_secret_key" {
  type        = string
  description = "Stripe secret key"
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  type        = string
  description = "Stripe webhook secret"
  sensitive   = true
  default     = ""
}

# ─── Infrastructure ─────────────────────────────────────
variable "rabbitmq_password" {
  type        = string
  description = "RabbitMQ admin password"
  sensitive   = true
}

variable "redis_password" {
  type        = string
  description = "Password for Redis authentication"
  sensitive   = true
}

# ─── Google OAuth ────────────────────────────────────────
variable "google_client_id" {
  type        = string
  description = "Google OAuth client ID"
  default     = ""
}
