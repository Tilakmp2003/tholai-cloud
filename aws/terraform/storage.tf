# Random ID for unique naming
resource "random_id" "suffix" {
  byte_length = 4
}

# ---------------------------------------------------------
# SECRETS MANAGER (DB Password)
# ---------------------------------------------------------
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "vsc-db-password-${random_id.suffix.hex}"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# ---------------------------------------------------------
# SQS QUEUE (Task Queue)
# ---------------------------------------------------------
resource "aws_sqs_queue" "task_queue" {
  name                       = "vsc-task-queue-${random_id.suffix.hex}"
  visibility_timeout_seconds = 300 # Must be >= Lambda timeout
  message_retention_seconds  = 86400
}

resource "aws_sqs_queue" "task_dlq" {
  name = "vsc-task-dlq-${random_id.suffix.hex}"
}

resource "aws_sqs_queue_redrive_policy" "task_queue" {
  queue_url = aws_sqs_queue.task_queue.id
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.task_dlq.arn
    maxReceiveCount     = 3
  })
}

# ---------------------------------------------------------
# RDS POSTGRES + PROXY
# ---------------------------------------------------------
resource "aws_db_subnet_group" "default" {
  name       = "vsc-db-subnet-group-${random_id.suffix.hex}"
  subnet_ids = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

resource "aws_security_group" "db_sg" {
  name        = "vsc-db-sg"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id

  # Allow access from Lambda and EC2 (via Proxy or Direct)
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda_sg.id]
    cidr_blocks     = ["13.232.162.175/32"] # EC2 Instance IP
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "vsc-postgres-${random_id.suffix.hex}"
  engine                 = "postgres"
  engine_version         = "14"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  db_name                = "vsc_db"
  username               = "vsc_admin"
  password               = random_password.db_password.result
  db_subnet_group_name   = aws_db_subnet_group.default.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  skip_final_snapshot    = true
  publicly_accessible    = true
}

# RDS Proxy removed due to Free Tier restrictions
# In production, uncomment the proxy configuration for connection pooling

# resource "aws_iam_role" "rds_proxy_role" { ... }
# resource "aws_iam_role_policy" "rds_proxy_policy" { ... }
# resource "aws_db_proxy" "proxy" { ... }
# resource "aws_db_proxy_default_target_group" "default" { ... }
# resource "aws_db_proxy_target" "target" { ... }

# ---------------------------------------------------------
# ELASTICACHE REDIS (Cluster Mode)
# ---------------------------------------------------------
resource "aws_elasticache_subnet_group" "redis" {
  name       = "vsc-redis-subnet-group-${random_id.suffix.hex}"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

resource "aws_security_group" "redis_sg" {
  name        = "vsc-redis-sg"
  description = "Security group for Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda_sg.id]
    cidr_blocks     = ["0.0.0.0/0"] # Placeholder for EC2 IP
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "vsc-redis-${random_id.suffix.hex}"
  description                = "Redis Cluster for VSC"
  node_type                  = "cache.t3.micro"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis_sg.id]
  engine                     = "redis"
  engine_version             = "7.0"
  port                       = 6379
}

# ---------------------------------------------------------
# S3 & DYNAMODB (Artifacts & Traces)
# ---------------------------------------------------------
resource "aws_s3_bucket" "artifacts" {
  bucket = "vsc-artifacts-${random_id.suffix.hex}"
}

resource "aws_dynamodb_table" "traces" {
  name         = "vsc-immutable-traces-${random_id.suffix.hex}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "traceId"
  range_key    = "timestamp"

  attribute {
    name = "traceId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }
}
