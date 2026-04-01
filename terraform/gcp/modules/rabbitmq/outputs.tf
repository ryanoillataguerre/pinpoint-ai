output "rabbitmq_internal_ip" {
  description = "Internal IP address of the RabbitMQ instance"
  value       = google_compute_instance.rabbitmq.network_interface[0].network_ip
}

output "rabbitmq_instance_name" {
  description = "Name of the GCE instance"
  value       = google_compute_instance.rabbitmq.name
}

output "rabbitmq_amqp_port" {
  description = "RabbitMQ AMQP port"
  value       = 5672
}

output "rabbitmq_management_port" {
  description = "RabbitMQ management UI port"
  value       = 15672
}

output "rabbitmq_connection_string" {
  description = "RabbitMQ connection string (AMQP URL)"
  value       = "amqp://${var.rabbitmq_username}:${var.rabbitmq_password}@${google_compute_instance.rabbitmq.network_interface[0].network_ip}:5672"
  sensitive   = true
}
