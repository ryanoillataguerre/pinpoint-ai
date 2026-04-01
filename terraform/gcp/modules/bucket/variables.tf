variable "name" {
  description = "Bucket name"
  type        = string
}

variable "location" {
  description = "Bucket location"
  type        = string
  default     = "us-west1"
}

variable "project" {
  description = "Project ID"
  type        = string
}
