variable "project" {
  description = "The GCP project ID."
  type        = string
}

variable "region" {
  description = "The GCP region for the Redis instance."
  type        = string
}

variable "zone" {
  description = "The GCP zone for the Redis instance."
  type        = string
}

variable "instance_name" {
  description = "Name for the GCE instance running Redis."
  type        = string
  default     = "redis-vm-staging"
}

variable "machine_type" {
  description = "Machine type for the GCE instance (e.g., e2-micro, e2-small)."
  type        = string
  default     = "e2-micro"
}

variable "boot_disk_image" {
  description = "The image for the boot disk for the GCE instance."
  type        = string
  default     = "debian-cloud/debian-11"
}

variable "network_name" {
  description = "The name of the VPC network to connect the GCE instance to."
  type        = string
}

variable "subnetwork_name" {
  description = "The name of the subnetwork to connect the GCE instance to."
  type        = string
}

variable "redis_port" {
  description = "Port Redis will listen on."
  type        = number
  default     = 6379
}

variable "source_ranges_allow_redis" {
  description = "List of CIDR blocks allowed to access Redis on the GCE instance. Typically internal ranges."
  type        = list(string)
}

variable "redis_password" {
  description = "Password for Redis. If left empty, authentication will be disabled in the default startup script."
  type        = string
  default     = ""
  sensitive   = true
}

variable "disk_size_gb" {
  type        = number
  description = "Boot disk size in GB"
  default     = 20
}

variable "internal_ip" {
  type        = string
  description = "Internal IP address for the Redis instance"
  default     = null
}

variable "service_account_email" {
  type        = string
  description = "Service account email for the compute instance"
  default     = null
}

variable "environment" {
  type        = string
  description = "Environment label"
  default     = "dev"
}

variable "allowed_cidr_blocks" {
  type        = string
  description = "CIDR blocks allowed to access Redis"
  default     = "10.0.0.0/8"
}
