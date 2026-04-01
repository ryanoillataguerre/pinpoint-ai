output "instance_name" {
  description = "The name of the GCE instance"
  value       = google_compute_instance.service.name
}

output "instance_id" {
  description = "The ID of the GCE instance"
  value       = google_compute_instance.service.instance_id
}

output "internal_ip" {
  description = "The internal IP address of the instance"
  value       = google_compute_instance.service.network_interface[0].network_ip
}

output "external_ip" {
  description = "The external IP address of the instance (if assigned)"
  value       = var.assign_external_ip ? google_compute_instance.service.network_interface[0].access_config[0].nat_ip : null
}

output "zone" {
  description = "The zone of the instance"
  value       = google_compute_instance.service.zone
}

output "service_url" {
  description = "Internal URL to reach the service"
  value       = "http://${google_compute_instance.service.network_interface[0].network_ip}:${var.container_port}"
}
