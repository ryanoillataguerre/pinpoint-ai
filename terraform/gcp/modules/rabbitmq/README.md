# RabbitMQ Terraform Module for GCP

Simple single-node RabbitMQ deployment on Google Compute Engine.

## Features

- ✅ Single GCE instance running RabbitMQ in Docker
- ✅ Management UI on port 15672
- ✅ Prometheus metrics on port 15692
- ✅ Automatic health checks
- ✅ Persistent storage
- ✅ Delayed message exchange plugin
- ✅ Cost: ~$35/month

## Usage

```hcl
module "rabbitmq" {
  source = "../modules/rabbitmq"

  project         = var.gcp_project
  region          = "us-west1"
  zone            = "us-west1-a"
  instance_name   = "production-rabbitmq"
  machine_type    = "e2-medium"  # 2 vCPU, 4GB RAM

  network_name    = module.vpc.name
  subnetwork_name = module.vpc.subnetwork_self_link
  internal_ip     = "10.128.0.20"

  source_ranges_allow_rabbitmq = [
    module.vpc.subnetwork_ip_cidr_range,
    "10.8.0.0/28"
  ]

  rabbitmq_username      = "admin"
  rabbitmq_password      = var.rabbitmq_password
  rabbitmq_erlang_cookie = random_string.erlang_cookie.result

  service_account_email = "terraform@${var.gcp_project}.iam.gserviceaccount.com"
  environment           = "production"
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| project | GCP project ID | string | - | yes |
| region | GCP region | string | - | yes |
| zone | GCP zone | string | - | yes |
| instance_name | Instance name | string | rabbitmq | no |
| internal_ip | Internal IP | string | - | yes |
| machine_type | Machine type | string | e2-medium | no |
| rabbitmq_password | Admin password | string | - | yes |
| rabbitmq_username | Admin username | string | admin | no |

## Outputs

| Name | Description |
|------|-------------|
| rabbitmq_connection_string | AMQP connection URL |
| rabbitmq_host | IP address |
| rabbitmq_management_url | Management UI URL |

## Cost

- e2-medium: ~$30/month
- 50GB storage: ~$5/month
- **Total: ~$35/month**

## Management

Access UI at `http://<ip>:15672` (username: admin, password from terraform)

Check status:
```bash
gcloud compute ssh <instance-name> --zone=<zone>
docker exec rabbitmq-server rabbitmqctl status
```
