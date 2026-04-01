variable "project" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for RabbitMQ resources"
  type        = string
}

variable "zone" {
  description = "The GCP zone for the RabbitMQ instances"
  type        = string
}

variable "instance_name" {
  description = "Base name for the RabbitMQ cluster instances"
  type        = string
  default     = "rabbitmq-cluster"
}

variable "machine_type" {
  description = "Machine type for the GCE instances (e.g., e2-standard-2, e2-medium)"
  type        = string
  default     = "e2-standard-2" # 2 vCPU, 8GB RAM
}

variable "boot_disk_image" {
  description = "The image for the boot disk for the GCE instances"
  type        = string
  default     = "debian-cloud/debian-12"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB for each instance"
  type        = number
  default     = 50
}

variable "network_name" {
  description = "The name of the VPC network to connect the GCE instances to"
  type        = string
}

variable "subnetwork_name" {
  description = "The name of the subnetwork to connect the GCE instances to"
  type        = string
}

variable "internal_ip" {
  description = "Internal IP address for RabbitMQ node 1"
  type        = string
}

variable "source_ranges_allow_rabbitmq" {
  description = "List of CIDR blocks allowed to access RabbitMQ. Typically internal ranges."
  type        = list(string)
}

variable "rabbitmq_username" {
  description = "RabbitMQ admin username"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "rabbitmq_password" {
  description = "RabbitMQ admin password"
  type        = string
  sensitive   = true
}

variable "rabbitmq_erlang_cookie" {
  description = "Erlang cookie for RabbitMQ cluster communication (must be same across all nodes)"
  type        = string
  sensitive   = true
}

variable "service_account_email" {
  description = "Service account email for the compute instances"
  type        = string
  default     = null
}

variable "environment" {
  description = "Environment label (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "allow_home_access" {
  description = "Whether to allow access to management UI from home IP"
  type        = bool
  default     = false
}
