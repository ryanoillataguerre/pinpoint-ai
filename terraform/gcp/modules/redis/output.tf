output "redis_host_internal_ip" {
  description = "The internal IP address of the GCE instance running Redis."
  value       = google_compute_instance.redis_vm.network_interface[0].network_ip
}

output "redis_port" {
  description = "The port Redis is listening on (on the GCE instance)."
  value       = var.redis_port
}

output "redis_password" {
  description = "The password for Redis (if configured)."
  value       = var.redis_password
  sensitive   = true
}
