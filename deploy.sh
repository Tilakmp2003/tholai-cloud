#!/bin/bash
set -e

# Configuration
AWS_REGION="ap-south-1"
REPO_NAME="tholai-backend"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE_URI="$ECR_URL/$REPO_NAME:latest"

echo "🚀 Starting Deployment to ECR..."
echo "📍 Region: $AWS_REGION"
echo "🆔 Account: $ACCOUNT_ID"
echo "📦 Repo: $REPO_NAME"

# 1. Create ECR Repository if it doesn't exist
echo "Checking if ECR repository exists..."
aws ecr describe-repositories --repository-names $REPO_NAME --region $AWS_REGION > /dev/null 2>&1 || \
  (echo "Creating repository..." && aws ecr create-repository --repository-name $REPO_NAME --region $AWS_REGION)

# 2. Login to ECR
echo "🔑 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL

# 3. Build Docker Image
echo "🔨 Building Docker Image..."
# Use linux/amd64 platform for App Runner compatibility
docker build --platform linux/amd64 -t $REPO_NAME:latest .

# 4. Tag Image
echo "🏷️ Tagging Image..."
docker tag $REPO_NAME:latest $IMAGE_URI

# 5. Push Image
echo "⬆️ Pushing Image to ECR..."
docker push $IMAGE_URI

echo "✅ Success! Image pushed to: $IMAGE_URI"
echo "👉 Now go to App Runner -> Source & deployment -> Image registry -> Browse -> Select this image."
