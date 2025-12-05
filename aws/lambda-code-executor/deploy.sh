#!/bin/bash
set -e

# Configuration
AWS_REGION="ap-south-1"
FUNCTION_NAME="Tholai-Code-Executor"
ROLE_NAME="tholai-code-executor-role"

echo "🚀 Deploying Tholai Code Executor Lambda"
echo "📍 Region: $AWS_REGION"
echo "📦 Function: $FUNCTION_NAME"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"

# 1. Build the Lambda function
echo ""
echo "📦 Building Lambda function..."
npm install
npm run build

# Create deployment package
echo "📦 Creating deployment package..."
cd dist
zip -r ../function.zip index.js
cd ..

# 2. Create IAM Role if it doesn't exist
echo ""
echo "🔑 Checking IAM Role..."
if ! aws iam get-role --role-name $ROLE_NAME --region $AWS_REGION 2>/dev/null; then
  echo "Creating IAM Role..."
  
  # Trust policy for Lambda
  cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file://trust-policy.json \
    --region $AWS_REGION

  # Attach basic execution policy
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    --region $AWS_REGION

  rm trust-policy.json

  echo "⏳ Waiting for role to propagate..."
  sleep 10
else
  echo "✓ IAM Role exists"
fi

# 3. Create or Update Lambda Function
echo ""
echo "⚡ Deploying Lambda function..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $AWS_REGION 2>/dev/null; then
  echo "Updating existing function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $AWS_REGION
else
  echo "Creating new function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --timeout 30 \
    --memory-size 256 \
    --region $AWS_REGION
fi

# 4. Wait for function to be ready
echo ""
echo "⏳ Waiting for function to be ready..."
aws lambda wait function-active --function-name $FUNCTION_NAME --region $AWS_REGION

# 5. Test the function
echo ""
echo "🧪 Testing Lambda function..."
aws lambda invoke \
  --function-name $FUNCTION_NAME \
  --payload '{"code": "console.log(\"Hello from Lambda!\");", "language": "javascript"}' \
  --cli-binary-format raw-in-base64-out \
  --region $AWS_REGION \
  response.json

echo ""
echo "📄 Test Response:"
cat response.json
rm response.json

echo ""
echo "✅ Lambda deployed successfully!"
echo ""
echo "📌 Function ARN: arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"
echo ""
echo "👉 Make sure your backend has EXECUTION_MODE=CLOUD and AWS_REGION=$AWS_REGION"
