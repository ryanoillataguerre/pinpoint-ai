# Infrastructure Variables
variable "project" {
  description = "The GCP project ID"
  type        = string
}

variable "zone" {
  description = "The GCP zone for the instance"
  type        = string
}

variable "instance_name" {
  description = "Name for the GCE instance"
  type        = string
}

variable "service_name" {
  description = "Logical service name (used for labels and container name)"
  type        = string
}

variable "machine_type" {
  description = "Machine type for the GCE instance"
  type        = string
  default     = "e2-small"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 30
}

variable "disk_type" {
  description = "Boot disk type (pd-standard, pd-balanced, pd-ssd)"
  type        = string
  default     = "pd-standard"
}

variable "preemptible" {
  description = "Use preemptible (spot) instance for cost savings"
  type        = bool
  default     = false
}

# Network Variables
variable "network_name" {
  description = "The name of the VPC network"
  type        = string
}

variable "subnetwork_name" {
  description = "The name/self_link of the subnetwork"
  type        = string
}

variable "assign_external_ip" {
  description = "Whether to assign an external IP (needed for pulling images)"
  type        = bool
  default     = true
}

variable "source_ranges" {
  description = "CIDR blocks allowed to access the service"
  type        = list(string)
}

variable "network_tags" {
  description = "Additional network tags for the instance"
  type        = list(string)
  default     = []
}

variable "allow_ssh" {
  description = "Whether to allow SSH access"
  type        = bool
  default     = true
}

variable "ssh_source_ranges" {
  description = "CIDR blocks allowed SSH access (defaults to IAP range)"
  type        = list(string)
  default     = ["35.235.240.0/20"]
}

# Service Account
variable "service_account_email" {
  description = "Service account email for the compute instance"
  type        = string
}

variable "environment" {
  description = "Environment label (e.g., production, staging)"
  type        = string
  default     = "staging"
}

variable "labels" {
  description = "Additional labels to apply to the instance"
  type        = map(string)
  default     = {}
}

# Container Configuration
variable "docker_image" {
  description = "Docker image to run (full path including registry)"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 8080
}

variable "env_vars" {
  description = "Environment variables to pass to the container"
  type = list(object({
    key   = string
    value = string
  }))
  default   = []
  sensitive = true
}

