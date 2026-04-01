terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "6.36.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "6.36.0"
    }
  }
  backend "gcs" {
    bucket = "pinpoint-ai-tfstate-production"
    prefix = ""
  }
}

provider "google" {
  project     = var.gcp_project
  credentials = file(var.gcp_auth_file)
  region      = var.gcp_region
}

provider "google-beta" {
  project     = var.gcp_project
  credentials = file(var.gcp_auth_file)
  region      = var.gcp_region
}
