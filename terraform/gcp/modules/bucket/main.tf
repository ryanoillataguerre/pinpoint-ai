resource "google_storage_bucket" "default" {
  name          = var.name
  project       = var.project
  force_destroy = false

  location = var.location

  storage_class = "COLDLINE"

  versioning {
    enabled = false
  }

  uniform_bucket_level_access = true
}