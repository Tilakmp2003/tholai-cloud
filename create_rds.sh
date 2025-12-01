#!/bin/bash
set -e

DB_INSTANCE_IDENTIFIER="tholai-db"
DB_NAME="tholai"
MASTER_USERNAME="postgres"
REGION="ap-south-1"

echo "🚀 Starting AWS RDS Creation (Free Tier)..."
echo "📍 Region: $REGION"

# Check if DB already exists
if aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE_IDENTIFIER --region $REGION >/dev/null 2>&1; then
    echo "⚠️  Database '$DB_INSTANCE_IDENTIFIER' already exists."
    echo "   Getting endpoint..."
else
    echo "🔐 Enter a password for the database (min 8 chars):"
    read -s DB_PASSWORD
    echo

    # Create Security Group
    echo "🛡️  Creating/Checking Security Group 'tholai-db-sg'..."
    SG_ID=$(aws ec2 describe-security-groups --group-names tholai-db-sg --region $REGION --output text --query 'SecurityGroups[0].GroupId' 2>/dev/null || \
            aws ec2 create-security-group --group-name tholai-db-sg --description "Security group for Tholai RDS" --region $REGION --output text --query 'GroupId')

    echo "   SG ID: $SG_ID"

    # Allow access from anywhere (for App Runner & Local Migrations)
    echo "🔓 Authorizing Ingress (Port 5432 from 0.0.0.0/0)..."
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 5432 --cidr 0.0.0.0/0 --region $REGION 2>/dev/null || echo "   Ingress already exists."

    # Create RDS
    echo "🐘 Creating RDS PostgreSQL Instance..."
    aws rds create-db-instance \
        --db-instance-identifier $DB_INSTANCE_IDENTIFIER \
        --db-name $DB_NAME \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --master-username $MASTER_USERNAME \
        --master-user-password $DB_PASSWORD \
        --allocated-storage 20 \
        --vpc-security-group-ids $SG_ID \
        --publicly-accessible \
        --region $REGION \
        --no-multi-az \
        --backup-retention-period 7 \
        --output json > rds_creation.json

    echo "⏳ Waiting for Database to be available (this takes ~5-10 mins)..."
    aws rds wait db-instance-available --db-instance-identifier $DB_INSTANCE_IDENTIFIER --region $REGION
fi

# Get Endpoint
ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE_IDENTIFIER --region $REGION --query "DBInstances[0].Endpoint.Address" --output text)

echo ""
echo "✅ Database is Ready!"
echo "---------------------------------------------------"
if [ -z "$DB_PASSWORD" ]; then
    echo "DATABASE_URL=\"postgresql://$MASTER_USERNAME:[YOUR_PASSWORD]@$ENDPOINT:5432/$DB_NAME\""
    echo "⚠️  (Replace [YOUR_PASSWORD] with the password you set earlier)"
else
    echo "DATABASE_URL=\"postgresql://$MASTER_USERNAME:$DB_PASSWORD@$ENDPOINT:5432/$DB_NAME\""
fi
echo "---------------------------------------------------"
echo "👉 Copy the DATABASE_URL above and paste it into App Runner environment variables."
