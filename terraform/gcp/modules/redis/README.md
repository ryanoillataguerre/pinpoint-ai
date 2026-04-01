# GCE-based Redis Module

This Terraform module creates a Redis instance running on Google Compute Engine (GCE) instead of Google Memorystore. This provides more control over the Redis configuration and can be more cost-effective for smaller workloads.

## Features

- Redis server running on Ubuntu 22.04 LTS
- Configurable machine type and disk size
- Password authentication
- Firewall rules for secure access
- Automatic startup script for Redis installation and configuration
- Health check script included
- Log rotation configured
- Security hardening (disabled dangerous commands)

## Usage

```hcl
module "redis" {
  source = "./modules/redis"

  # Required variables
  private_network_id = var.vpc_network_id
  instance_name      = "my-redis-instance"
  project           = var.project_id
  region            = var.region
  redis_password    = var.redis_password

  # Optional variables
  machine_type           = "e2-small"
  disk_size_gb          = 20
  redis_port            = 6379
  environment           = "production"
  allowed_cidr_blocks   = "10.0.0.0/8"
  service_account_email = var.compute_service_account_email
}
```

## Variables

| Name                  | Description                                    | Type     | Default        | Required |
| --------------------- | ---------------------------------------------- | -------- | -------------- | :------: |
| private_network_id    | ID of the shared private network               | `string` | n/a            |   yes    |
| instance_name         | Name of the redis instance                     | `string` | n/a            |   yes    |
| project               | GCP project                                    | `string` | n/a            |   yes    |
| region                | GCP Region                                     | `string` | n/a            |   yes    |
| redis_password        | Password for Redis authentication              | `string` | n/a            |   yes    |
| machine_type          | Machine type for the Redis instance            | `string` | `"e2-micro"`   |    no    |
| disk_size_gb          | Boot disk size in GB                           | `number` | `20`           |    no    |
| internal_ip           | Internal IP address for the Redis instance     | `string` | `null`         |    no    |
| redis_port            | Port for Redis server                          | `number` | `6379`         |    no    |
| service_account_email | Service account email for the compute instance | `string` | `null`         |    no    |
| environment           | Environment label                              | `string` | `"dev"`        |    no    |
| allowed_cidr_blocks   | CIDR blocks allowed to access Redis            | `string` | `"10.0.0.0/8"` |    no    |

## Outputs

| Name          | Description           |
| ------------- | --------------------- |
| host          | Redis host IP address |
| port          | Redis port            |
| instance_name | Redis instance name   |
| zone          | Redis instance zone   |

## Migration from Memorystore

When migrating from Google Memorystore to this GCE-based solution:

1. **Update your module call** to include the new required `redis_password` variable
2. **Update connection strings** in your applications to use the new host IP and include authentication
3. **Plan the migration** carefully as there will be downtime during the switch
4. **Backup your data** from the existing Memorystore instance if needed

### Example migration steps:

1. Deploy the new GCE Redis instance alongside the existing Memorystore
2. Update your application configuration to use the new Redis instance
3. Migrate data if necessary using `redis-cli` or application-level migration
4. Remove the old Memorystore instance

## Security Considerations

- Redis is configured with password authentication
- Dangerous commands are disabled (FLUSHDB, FLUSHALL, DEBUG, CONFIG)
- Firewall rules restrict access to specified CIDR blocks
- Redis binds to all interfaces but is protected by VPC network isolation

## Monitoring and Maintenance

- Health check script available at `/usr/local/bin/redis-health-check.sh`
- Logs are written to `/var/log/redis/redis-server.log`
- Log rotation is configured to keep 7 days of logs
- Redis persistence is enabled with RDB snapshots

## Cost Considerations

- GCE-based Redis can be more cost-effective than Memorystore for smaller workloads
- Consider using preemptible instances for development environments
- Monitor disk usage as Redis persistence will consume disk space
- Scale machine type based on memory requirements

## Limitations

- No automatic failover (single instance)
- Manual scaling required
- No built-in monitoring like Memorystore
- Requires more operational overhead
