output "connector_id" {
  value       = google_vpc_access_connector.connector.id
  description = "VPC Access Connector ID"
}

output "private_network_link" {
  value       = google_compute_network.private_network.self_link
  description = "VPC Access Connector Self Link"
}

output "private_network_id" {
  value       = google_compute_network.private_network.id
  description = "VPC Access Connector Self Link"
}

output "name" {
  value       = google_compute_network.private_network.name
  description = "VPC Network Name"
}

output "subnetwork_self_link" {
  value       = google_compute_subnetwork.private-subnetwork.self_link
  description = "Private Subnetwork Self Link"
}

output "subnetwork_ip_cidr_range" {
  value       = google_compute_subnetwork.private-subnetwork.ip_cidr_range
  description = "Private Subnetwork IP CIDR Range"
}

output "gce_subnetwork_self_link" {
  value       = google_compute_subnetwork.gce-subnetwork.self_link
  description = "GCE Subnetwork Self Link"
}

output "gce_subnetwork_ip_cidr_range" {
  value       = google_compute_subnetwork.gce-subnetwork.ip_cidr_range
  description = "GCE Subnetwork IP CIDR Range"
}
