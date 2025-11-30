# IAM Role for Lambda Agents
resource "aws_iam_role" "agent_lambda_role" {
  name = "vsc-agent-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.agent_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.agent_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Enhanced Policy for SQS, Secrets, RDS Proxy, S3, DynamoDB
resource "aws_iam_role_policy" "agent_permissions" {
  name = "vsc-agent-permissions"
  role = aws_iam_role.agent_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security Group for Lambda
resource "aws_security_group" "lambda_sg" {
  name        = "vsc-lambda-sg"
  description = "Security group for Lambda Agents"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Lambda Function (SQS Consumer)
resource "aws_lambda_function" "agent_runner" {
  filename      = "agent_placeholder.zip" # Will be replaced by CI/CD
  function_name = "vsc-agent-runner"
  role          = aws_iam_role.agent_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 300 # 5 minutes max

  vpc_config {
    subnet_ids         = [aws_subnet.private_1.id, aws_subnet.private_2.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  environment {
    variables = {
      NODE_ENV           = "production"
      # Point to RDS Instance (Direct)
      DATABASE_URL       = "postgresql://${aws_db_instance.postgres.username}:${random_password.db_password.result}@${aws_db_instance.postgres.address}:5432/vsc_db"
      # Point to Redis Cluster Primary Endpoint
      REDIS_URL          = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
      SQS_QUEUE_URL      = aws_sqs_queue.task_queue.id
    }
  }
}

# SQS Event Source Mapping (Trigger Lambda on SQS Message)
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.task_queue.arn
  function_name    = aws_lambda_function.agent_runner.arn
  batch_size       = 1
  enabled          = true
}
