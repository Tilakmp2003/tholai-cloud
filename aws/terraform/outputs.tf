output "sqs_queue_url" {
  value = aws_sqs_queue.task_queue.id
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "s3_bucket_name" {
  value = aws_s3_bucket.artifacts.id
}

output "db_password" {
  value     = random_password.db_password.result
  sensitive = true
}
