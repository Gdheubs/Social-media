# Complete AWS Deployment Guide - Creator Cosmos Platform

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [AWS Services Setup](#aws-services-setup)
4. [Database Setup (MongoDB)](#database-setup)
5. [Application Deployment](#application-deployment)
6. [Domain & SSL Configuration](#domain-ssl-configuration)
7. [Environment Variables](#environment-variables)
8. [Monitoring & Logging](#monitoring-logging)
9. [Scaling & Optimization](#scaling-optimization)
10. [Cost Estimation](#cost-estimation)

---

## Architecture Overview

### AWS Services Used
```
┌─────────────────────────────────────────────────────────────┐
│                     Route 53 (DNS)                          │
│                    creator-cosmos.com                        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              CloudFront (CDN)                                │
│         SSL/TLS Certificate (ACM)                            │
└────────┬────────────────────────────┬────────────────────────┘
         │                            │
┌────────▼────────────┐    ┌─────────▼──────────────┐
│  S3 Bucket          │    │  Application Load       │
│  (Static Assets)    │    │  Balancer (ALB)        │
└─────────────────────┘    └──────────┬─────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │   Target Group        │
                          └───────────┬───────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────▼─────────┐   ┌────────▼────────┐   ┌────────▼────────┐
    │   EC2 Instance 1  │   │  EC2 Instance 2 │   │  EC2 Instance N │
    │   (Backend+Front) │   │  (Backend+Front)│   │  (Backend+Front)│
    │   - FastAPI:8001  │   │  - FastAPI:8001 │   │  - FastAPI:8001 │
    │   - React:3000    │   │  - React:3000   │   │  - React:3000   │
    └─────────┬─────────┘   └────────┬────────┘   └────────┬────────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
                         ┌───────────▼────────────┐
                         │  DocumentDB/MongoDB    │
                         │  (Managed Database)    │
                         └────────────────────────┘
```

---

## Prerequisites

### Required Items
- [ ] AWS Account with billing enabled
- [ ] Domain name (purchase from Route53 or external registrar)
- [ ] Local terminal with AWS CLI installed
- [ ] SSH key pair for EC2 access
- [ ] Credit card for AWS charges

### Required Credentials
- [ ] Stripe API keys (already have: sk_test_emergent)
- [ ] Cloudinary credentials (already configured)
- [ ] Agora App ID & Certificate (optional for live streaming)
- [ ] OpenAI API key (optional for AI moderation)

### Local Setup
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# AWS Access Key ID: <your_key>
# AWS Secret Access Key: <your_secret>
# Default region: us-east-1
# Default output format: json
```

---

## AWS Services Setup

### Step 1: Create VPC and Network Infrastructure

#### 1.1 Create VPC
```bash
# Go to AWS Console → VPC → Create VPC
VPC Name: creator-cosmos-vpc
IPv4 CIDR: 10.0.0.0/16
Tenancy: Default
Enable DNS hostnames: Yes
```

Or via CLI:
```bash
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=creator-cosmos-vpc}]'
```

#### 1.2 Create Subnets (Multi-AZ for High Availability)
```bash
# Public Subnet 1 (us-east-1a)
aws ec2 create-subnet \
  --vpc-id <vpc-id> \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1a}]'

# Public Subnet 2 (us-east-1b)
aws ec2 create-subnet \
  --vpc-id <vpc-id> \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1b}]'

# Private Subnet 1 (us-east-1a) - for database
aws ec2 create-subnet \
  --vpc-id <vpc-id> \
  --cidr-block 10.0.10.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1a}]'

# Private Subnet 2 (us-east-1b) - for database
aws ec2 create-subnet \
  --vpc-id <vpc-id> \
  --cidr-block 10.0.11.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1b}]'
```

#### 1.3 Create Internet Gateway
```bash
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=creator-cosmos-igw}]'

# Attach to VPC
aws ec2 attach-internet-gateway \
  --vpc-id <vpc-id> \
  --internet-gateway-id <igw-id>
```

#### 1.4 Configure Route Tables
```bash
# Create route table for public subnets
aws ec2 create-route-table \
  --vpc-id <vpc-id> \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=public-rt}]'

# Add route to internet gateway
aws ec2 create-route \
  --route-table-id <rt-id> \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id <igw-id>

# Associate with public subnets
aws ec2 associate-route-table \
  --subnet-id <public-subnet-1a-id> \
  --route-table-id <rt-id>

aws ec2 associate-route-table \
  --subnet-id <public-subnet-1b-id> \
  --route-table-id <rt-id>
```

### Step 2: Create Security Groups

#### 2.1 Application Load Balancer Security Group
```bash
aws ec2 create-security-group \
  --group-name creator-cosmos-alb-sg \
  --description "Security group for ALB" \
  --vpc-id <vpc-id>

# Allow HTTP (80)
aws ec2 authorize-security-group-ingress \
  --group-id <alb-sg-id> \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Allow HTTPS (443)
aws ec2 authorize-security-group-ingress \
  --group-id <alb-sg-id> \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

#### 2.2 EC2 Instances Security Group
```bash
aws ec2 create-security-group \
  --group-name creator-cosmos-ec2-sg \
  --description "Security group for EC2 instances" \
  --vpc-id <vpc-id>

# Allow SSH (22) from your IP only
aws ec2 authorize-security-group-ingress \
  --group-id <ec2-sg-id> \
  --protocol tcp \
  --port 22 \
  --cidr <your-ip>/32

# Allow Backend (8001) from ALB
aws ec2 authorize-security-group-ingress \
  --group-id <ec2-sg-id> \
  --protocol tcp \
  --port 8001 \
  --source-group <alb-sg-id>

# Allow Frontend (3000) from ALB
aws ec2 authorize-security-group-ingress \
  --group-id <ec2-sg-id> \
  --protocol tcp \
  --port 3000 \
  --source-group <alb-sg-id>

# Allow all traffic between EC2 instances (for internal communication)
aws ec2 authorize-security-group-ingress \
  --group-id <ec2-sg-id> \
  --protocol -1 \
  --source-group <ec2-sg-id>
```

#### 2.3 Database Security Group
```bash
aws ec2 create-security-group \
  --group-name creator-cosmos-db-sg \
  --description "Security group for DocumentDB" \
  --vpc-id <vpc-id>

# Allow MongoDB (27017) from EC2 instances only
aws ec2 authorize-security-group-ingress \
  --group-id <db-sg-id> \
  --protocol tcp \
  --port 27017 \
  --source-group <ec2-sg-id>
```

---

## Database Setup

### Option A: Amazon DocumentDB (Recommended - Managed MongoDB)

#### Step 1: Create DocumentDB Cluster
```bash
# Console: AWS Console → DocumentDB → Create cluster

Cluster identifier: creator-cosmos-db
Engine version: 4.0.0 (MongoDB compatible)
Instance class: db.t3.medium (or db.r5.large for production)
Number of instances: 2 (Multi-AZ for HA)
Username: admin
Password: <strong-password>

Network:
- VPC: creator-cosmos-vpc
- Subnet group: Create new (private-subnet-1a, private-subnet-1b)
- Security group: creator-cosmos-db-sg

Encryption:
- Enable encryption at rest: Yes
- Enable encryption in transit (TLS): Yes

Backup:
- Retention period: 7 days
- Preferred backup window: 03:00-04:00 UTC
```

Or via CLI:
```bash
# Create subnet group
aws docdb create-db-subnet-group \
  --db-subnet-group-name creator-cosmos-subnet-group \
  --db-subnet-group-description "Subnet group for DocumentDB" \
  --subnet-ids <private-subnet-1a-id> <private-subnet-1b-id>

# Create cluster
aws docdb create-db-cluster \
  --db-cluster-identifier creator-cosmos-db \
  --engine docdb \
  --master-username admin \
  --master-user-password <password> \
  --vpc-security-group-ids <db-sg-id> \
  --db-subnet-group-name creator-cosmos-subnet-group

# Create instances
aws docdb create-db-instance \
  --db-instance-identifier creator-cosmos-db-instance-1 \
  --db-instance-class db.t3.medium \
  --engine docdb \
  --db-cluster-identifier creator-cosmos-db

aws docdb create-db-instance \
  --db-instance-identifier creator-cosmos-db-instance-2 \
  --db-instance-class db.t3.medium \
  --engine docdb \
  --db-cluster-identifier creator-cosmos-db
```

#### Step 2: Get Connection String
```bash
# Wait for cluster to be available (~10 minutes)
aws docdb describe-db-clusters \
  --db-cluster-identifier creator-cosmos-db \
  --query 'DBClusters[0].Endpoint'

# Connection string format:
# mongodb://admin:<password>@creator-cosmos-db.cluster-xxxxx.us-east-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=rds-combined-ca-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

#### Step 3: Download TLS Certificate
```bash
wget https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem
# Upload this to EC2 instances later
```

### Option B: MongoDB Atlas (Alternative - Fully Managed)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster or paid cluster
3. Configure:
   - Cloud: AWS
   - Region: us-east-1
   - Cluster Tier: M10+ for production
4. Whitelist AWS EC2 IP addresses
5. Get connection string

### Option C: Self-Hosted MongoDB on EC2 (Budget Option)

```bash
# Launch separate EC2 for MongoDB
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name <your-key> \
  --security-group-ids <db-sg-id> \
  --subnet-id <private-subnet-1a-id> \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=mongodb-server}]'

# SSH into instance and install MongoDB
ssh -i <key>.pem ec2-user@<mongodb-ip>

# Install MongoDB 6.0
sudo tee /etc/yum.repos.d/mongodb-org-6.0.repo << EOF
[mongodb-org-6.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/6.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-6.0.asc
EOF

sudo yum install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

---

## Application Deployment

### Step 1: Create EC2 Launch Template

#### 1.1 Prepare Application AMI (One-time setup)

```bash
# Launch base EC2 instance
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name <your-key> \
  --security-group-ids <ec2-sg-id> \
  --subnet-id <public-subnet-1a-id> \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=creator-cosmos-setup}]'

# SSH into instance
ssh -i <key>.pem ec2-user@<public-ip>
```

#### 1.2 Install Dependencies on EC2

```bash
# Update system
sudo yum update -y

# Install Node.js 18
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Python 3.11
sudo yum install -y python3.11 python3.11-pip

# Install yarn
sudo npm install -g yarn

# Install nginx (for reverse proxy)
sudo amazon-linux-extras install nginx1 -y

# Install git
sudo yum install -y git

# Install supervisor
sudo pip3.11 install supervisor

# Create application directory
sudo mkdir -p /app
sudo chown ec2-user:ec2-user /app
cd /app
```

#### 1.3 Clone and Setup Application

```bash
# Option 1: From Git Repository (Recommended)
git clone <your-repo-url> .

# Option 2: Transfer files from local
# From your local machine:
scp -i <key>.pem -r /app ec2-user@<public-ip>:/

# Install backend dependencies
cd /app/backend
pip3.11 install -r requirements.txt

# Install frontend dependencies
cd /app/frontend
yarn install

# Build frontend for production
yarn build
```

#### 1.4 Configure Environment Variables

```bash
# Backend .env
cat > /app/backend/.env << 'EOF'
MONGO_URL="mongodb://admin:<password>@creator-cosmos-db.cluster-xxxxx.us-east-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=/app/rds-combined-ca-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
DB_NAME="creator_cosmos_prod"
CORS_ORIGINS="https://creator-cosmos.com,https://www.creator-cosmos.com"
JWT_SECRET="<generate-strong-random-secret>"
STRIPE_API_KEY="sk_live_<your-live-key>"
CLOUDINARY_CLOUD_NAME="dck4rnfs3"
CLOUDINARY_API_KEY="523221771562841"
CLOUDINARY_API_SECRET="fwPtyK5aPdBSwd4L7CpI8GP7m80"
OPENAI_API_KEY="<your-openai-key>"
AGORA_APP_ID="<your-agora-id>"
AGORA_APP_CERTIFICATE="<your-agora-cert>"
FRONTEND_URL="https://creator-cosmos.com"
EOF

# Frontend .env.production
cat > /app/frontend/.env.production << 'EOF'
REACT_APP_BACKEND_URL=https://api.creator-cosmos.com
GENERATE_SOURCEMAP=false
EOF

# Copy DocumentDB certificate
cp /home/ec2-user/rds-combined-ca-bundle.pem /app/
```

#### 1.5 Setup Nginx Reverse Proxy

```bash
sudo tee /etc/nginx/conf.d/creator-cosmos.conf << 'EOF'
# Backend API
server {
    listen 80;
    server_name api.creator-cosmos.com;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# Frontend
server {
    listen 80;
    server_name creator-cosmos.com www.creator-cosmos.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 1.6 Setup Supervisor (Process Manager)

```bash
sudo tee /etc/supervisord.conf << 'EOF'
[supervisord]
nodaemon=false

[inet_http_server]
port=127.0.0.1:9001

[supervisorctl]
serverurl=http://127.0.0.1:9001

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[program:backend]
command=/usr/bin/python3.11 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
directory=/app/backend
autostart=true
autorestart=true
stderr_logfile=/var/log/backend.err.log
stdout_logfile=/var/log/backend.out.log
environment=PYTHONUNBUFFERED="1"

[program:frontend]
command=/usr/bin/node /app/frontend/node_modules/.bin/serve -s build -l 3000
directory=/app/frontend
autostart=true
autorestart=true
stderr_logfile=/var/log/frontend.err.log
stdout_logfile=/var/log/frontend.out.log
EOF

# Start supervisor
sudo supervisord -c /etc/supervisord.conf
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

#### 1.7 Create Startup Script

```bash
sudo tee /etc/systemd/system/creator-cosmos.service << 'EOF'
[Unit]
Description=Creator Cosmos Application
After=network.target

[Service]
Type=forking
User=root
ExecStart=/usr/bin/supervisord -c /etc/supervisord.conf
ExecStop=/usr/bin/supervisorctl shutdown
ExecReload=/usr/bin/supervisorctl reload
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable creator-cosmos
sudo systemctl start creator-cosmos
```

#### 1.8 Create AMI from Configured Instance

```bash
# Stop instance first
aws ec2 stop-instances --instance-ids <instance-id>

# Create AMI
aws ec2 create-image \
  --instance-id <instance-id> \
  --name "creator-cosmos-app-v1.0" \
  --description "Creator Cosmos application with all dependencies"

# Wait for AMI to be available
aws ec2 describe-images --image-ids <ami-id>
```

### Step 2: Create Auto Scaling Group

#### 2.1 Create Launch Template

```bash
aws ec2 create-launch-template \
  --launch-template-name creator-cosmos-lt \
  --version-description "v1.0" \
  --launch-template-data '{
    "ImageId": "<ami-id>",
    "InstanceType": "t3.medium",
    "KeyName": "<your-key>",
    "SecurityGroupIds": ["<ec2-sg-id>"],
    "IamInstanceProfile": {
      "Name": "EC2-CloudWatch-Role"
    },
    "UserData": "<base64-encoded-startup-script>",
    "TagSpecifications": [{
      "ResourceType": "instance",
      "Tags": [{
        "Key": "Name",
        "Value": "creator-cosmos-app"
      }]
    }]
  }'
```

#### 2.2 Create Target Group for ALB

```bash
aws elbv2 create-target-group \
  --name creator-cosmos-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id <vpc-id> \
  --health-check-enabled \
  --health-check-path /api \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3
```

#### 2.3 Create Application Load Balancer

```bash
aws elbv2 create-load-balancer \
  --name creator-cosmos-alb \
  --subnets <public-subnet-1a-id> <public-subnet-1b-id> \
  --security-groups <alb-sg-id> \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4
```

#### 2.4 Create Listener Rules

```bash
# HTTP Listener (redirect to HTTPS later)
aws elbv2 create-listener \
  --load-balancer-arn <alb-arn> \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=<tg-arn>

# HTTPS Listener (after SSL certificate)
aws elbv2 create-listener \
  --load-balancer-arn <alb-arn> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<acm-cert-arn> \
  --default-actions Type=forward,TargetGroupArn=<tg-arn>
```

#### 2.5 Create Auto Scaling Group

```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name creator-cosmos-asg \
  --launch-template LaunchTemplateName=creator-cosmos-lt,Version='$Latest' \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --target-group-arns <tg-arn> \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --vpc-zone-identifier "<public-subnet-1a-id>,<public-subnet-1b-id>"
```

#### 2.6 Configure Auto Scaling Policies

```bash
# Target Tracking - CPU Utilization
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name creator-cosmos-asg \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 70.0
  }'

# Target Tracking - Request Count
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name creator-cosmos-asg \
  --policy-name request-count-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ALBRequestCountPerTarget",
      "ResourceLabel": "<alb-full-name>/<tg-full-name>"
    },
    "TargetValue": 1000.0
  }'
```

---

## Domain & SSL Configuration

### Step 1: Request SSL Certificate (AWS Certificate Manager)

```bash
# Request certificate
aws acm request-certificate \
  --domain-name creator-cosmos.com \
  --subject-alternative-names www.creator-cosmos.com api.creator-cosmos.com \
  --validation-method DNS \
  --region us-east-1

# Get validation DNS records
aws acm describe-certificate --certificate-arn <cert-arn>
```

### Step 2: Configure Route 53

#### Option A: If domain is in Route 53

```bash
# Create hosted zone (if not exists)
aws route53 create-hosted-zone \
  --name creator-cosmos.com \
  --caller-reference $(date +%s)

# Add ACM validation records
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch file://validation-records.json

# validation-records.json
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "_xxx.creator-cosmos.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "_xxx.acm-validations.aws."}]
    }
  }]
}

# Create alias record for ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "creator-cosmos.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "<alb-hosted-zone-id>",
          "DNSName": "<alb-dns-name>",
          "EvaluateTargetHealth": true
        }
      }
    }, {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.creator-cosmos.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "<alb-hosted-zone-id>",
          "DNSName": "<alb-dns-name>",
          "EvaluateTargetHealth": true
        }
      }
    }, {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.creator-cosmos.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "<alb-hosted-zone-id>",
          "DNSName": "<alb-dns-name>",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

#### Option B: If domain is external (GoDaddy, Namecheap, etc.)

1. Get ALB DNS name: `<alb-name>-<random>.us-east-1.elb.amazonaws.com`
2. Add CNAME records in your domain registrar:
   ```
   creator-cosmos.com        → <alb-dns-name>
   www.creator-cosmos.com    → <alb-dns-name>
   api.creator-cosmos.com    → <alb-dns-name>
   ```

### Step 3: Update ALB Listener to HTTPS

```bash
# Modify HTTP listener to redirect to HTTPS
aws elbv2 modify-listener \
  --listener-arn <http-listener-arn> \
  --default-actions Type=redirect,RedirectConfig='{
    "Protocol": "HTTPS",
    "Port": "443",
    "StatusCode": "HTTP_301"
  }'
```

---

## Environment Variables

### Production Environment Variables Template

**Backend (.env)**
```bash
# Database
MONGO_URL="mongodb://admin:<PASSWORD>@creator-cosmos-db.cluster-<ID>.us-east-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=/app/rds-combined-ca-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
DB_NAME="creator_cosmos_prod"

# Security
CORS_ORIGINS="https://creator-cosmos.com,https://www.creator-cosmos.com"
JWT_SECRET="<GENERATE_USING: openssl rand -base64 32>"

# Payments
STRIPE_API_KEY="sk_live_<YOUR_STRIPE_LIVE_KEY>"

# Media Storage
CLOUDINARY_CLOUD_NAME="dck4rnfs3"
CLOUDINARY_API_KEY="523221771562841"
CLOUDINARY_API_SECRET="fwPtyK5aPdBSwd4L7CpI8GP7m80"

# AI Moderation (Optional)
OPENAI_API_KEY="sk-<YOUR_OPENAI_KEY>"

# Live Streaming (Optional)
AGORA_APP_ID="<YOUR_AGORA_APP_ID>"
AGORA_APP_CERTIFICATE="<YOUR_AGORA_CERTIFICATE>"

# Frontend URL
FRONTEND_URL="https://creator-cosmos.com"
```

**Frontend (.env.production)**
```bash
REACT_APP_BACKEND_URL=https://api.creator-cosmos.com
GENERATE_SOURCEMAP=false
```

### Secure Secrets Management with AWS Systems Manager

```bash
# Store secrets in Parameter Store
aws ssm put-parameter \
  --name /creator-cosmos/prod/jwt-secret \
  --value "<jwt-secret>" \
  --type SecureString

aws ssm put-parameter \
  --name /creator-cosmos/prod/mongo-url \
  --value "<mongo-connection-string>" \
  --type SecureString

aws ssm put-parameter \
  --name /creator-cosmos/prod/stripe-key \
  --value "<stripe-live-key>" \
  --type SecureString

# Modify startup script to fetch secrets
cat > /app/scripts/load-secrets.sh << 'EOF'
#!/bin/bash
export MONGO_URL=$(aws ssm get-parameter --name /creator-cosmos/prod/mongo-url --with-decryption --query Parameter.Value --output text)
export JWT_SECRET=$(aws ssm get-parameter --name /creator-cosmos/prod/jwt-secret --with-decryption --query Parameter.Value --output text)
export STRIPE_API_KEY=$(aws ssm get-parameter --name /creator-cosmos/prod/stripe-key --with-decryption --query Parameter.Value --output text)

# Start application with loaded secrets
supervisord -c /etc/supervisord.conf
EOF

chmod +x /app/scripts/load-secrets.sh
```

---

## Monitoring & Logging

### Step 1: CloudWatch Logs

```bash
# Install CloudWatch agent on EC2
sudo yum install -y amazon-cloudwatch-agent

# Configure CloudWatch agent
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/config.json << 'EOF'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/backend.out.log",
            "log_group_name": "/creator-cosmos/backend",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/frontend.out.log",
            "log_group_name": "/creator-cosmos/frontend",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/creator-cosmos/nginx-access",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "/creator-cosmos/nginx-error",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "CreatorCosmos",
    "metrics_collected": {
      "cpu": {
        "measurement": [{"name": "cpu_usage_idle", "rename": "CPU_IDLE", "unit": "Percent"}],
        "totalcpu": false
      },
      "disk": {
        "measurement": [{"name": "used_percent", "rename": "DISK_USED", "unit": "Percent"}],
        "resources": ["*"]
      },
      "mem": {
        "measurement": [{"name": "mem_used_percent", "rename": "MEM_USED", "unit": "Percent"}]
      }
    }
  }
}
EOF

# Start CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json
```

### Step 2: CloudWatch Alarms

```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name creator-cosmos-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Database connections alarm
aws cloudwatch put-metric-alarm \
  --alarm-name creator-cosmos-db-connections \
  --alarm-description "Alert on high DB connections" \
  --metric-name DatabaseConnections \
  --namespace AWS/DocDB \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# ALB unhealthy targets
aws cloudwatch put-metric-alarm \
  --alarm-name creator-cosmos-unhealthy-targets \
  --alarm-description "Alert when targets are unhealthy" \
  --metric-name UnHealthyHostCount \
  --namespace AWS/ApplicationELB \
  --statistic Maximum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 2
```

### Step 3: Application Performance Monitoring (APM)

Consider integrating:
- **AWS X-Ray** for distributed tracing
- **DataDog** for comprehensive monitoring
- **New Relic** for application insights
- **Sentry** for error tracking

---

## Scaling & Optimization

### Performance Optimizations

#### 1. Enable CloudFront CDN
```bash
aws cloudfront create-distribution \
  --origin-domain-name creator-cosmos-alb-<id>.us-east-1.elb.amazonaws.com \
  --default-root-object index.html \
  --enabled
```

#### 2. S3 for Static Assets
```bash
# Create S3 bucket for uploads
aws s3 mb s3://creator-cosmos-uploads

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket creator-cosmos-uploads \
  --versioning-configuration Status=Enabled

# Set lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket creator-cosmos-uploads \
  --lifecycle-configuration file://lifecycle.json
```

#### 3. ElastiCache for Redis (Session/Cache)
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id creator-cosmos-cache \
  --engine redis \
  --cache-node-type cache.t3.medium \
  --num-cache-nodes 1 \
  --security-group-ids <cache-sg-id>
```

#### 4. Database Read Replicas
```bash
aws docdb create-db-instance \
  --db-instance-identifier creator-cosmos-db-replica-1 \
  --db-instance-class db.t3.medium \
  --engine docdb \
  --db-cluster-identifier creator-cosmos-db
```

---

## Cost Estimation

### Monthly AWS Costs (Estimated)

**Minimum Setup (MVP)**
- EC2 (2x t3.medium): $60/month
- DocumentDB (2x db.t3.medium): $200/month
- ALB: $25/month
- Data Transfer: $20/month
- **Total: ~$305/month**

**Production Setup (High Availability)**
- EC2 (3x t3.large): $150/month
- DocumentDB (3x db.r5.large): $600/month
- ALB: $25/month
- CloudFront: $50/month
- ElastiCache (Redis): $50/month
- S3 Storage: $25/month
- Data Transfer: $100/month
- CloudWatch: $25/month
- **Total: ~$1,025/month**

**High-Scale Setup (10K+ users)**
- EC2 (10x t3.xlarge): $1,500/month
- DocumentDB (Multi-AZ, 5 nodes): $2,000/month
- ALB + WAF: $100/month
- CloudFront: $200/month
- ElastiCache: $150/month
- S3 Storage (1TB): $100/month
- Data Transfer: $500/month
- **Total: ~$4,550/month**

### Cost Optimization Tips
1. Use Reserved Instances (up to 72% savings)
2. Enable Auto Scaling (scale down during low traffic)
3. Use S3 Intelligent-Tiering
4. Implement CloudFront caching aggressively
5. Use Spot Instances for non-critical workloads
6. Enable AWS Cost Explorer and set budgets

---

## Deployment Checklist

### Pre-Deployment
- [ ] AWS account configured with billing
- [ ] Domain name registered
- [ ] All API keys obtained (Stripe, Cloudinary, Agora, OpenAI)
- [ ] SSL certificate requested and validated
- [ ] Database backups enabled
- [ ] Monitoring and alerting configured

### Deployment Steps
- [ ] VPC and networking created
- [ ] Security groups configured
- [ ] Database cluster running
- [ ] AMI created from configured instance
- [ ] Auto Scaling Group launched
- [ ] Load Balancer configured
- [ ] DNS records updated
- [ ] HTTPS enabled
- [ ] Application tested end-to-end

### Post-Deployment
- [ ] Monitor logs for 24 hours
- [ ] Test all features (auth, upload, payments, live streaming)
- [ ] Set up backup retention policy
- [ ] Configure CloudWatch alarms
- [ ] Document runbook for common issues
- [ ] Train team on AWS console access
- [ ] Set up CI/CD pipeline (optional)

---

## Troubleshooting Common Issues

### Issue: Application not accessible
```bash
# Check ALB health checks
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# Check EC2 instances
aws ec2 describe-instance-status

# Check nginx
sudo systemctl status nginx
sudo nginx -t

# Check application logs
sudo supervisorctl status
tail -f /var/log/backend.err.log
```

### Issue: Database connection errors
```bash
# Test DocumentDB connection
mongo --ssl --host creator-cosmos-db.cluster-xxx.docdb.amazonaws.com:27017 \
  --username admin --password <password> \
  --sslCAFile rds-combined-ca-bundle.pem

# Check security group rules
aws ec2 describe-security-groups --group-ids <db-sg-id>
```

### Issue: High latency
```bash
# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=<alb-name> \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average

# Enable X-Ray tracing for detailed insights
```

---

## CI/CD Pipeline (Optional)

### Using AWS CodePipeline

```bash
# Create CodeCommit repository
aws codecommit create-repository \
  --repository-name creator-cosmos

# Create CodeBuild project
aws codebuild create-project \
  --name creator-cosmos-build \
  --source type=CODECOMMIT,location=https://git-codecommit.us-east-1.amazonaws.com/v1/repos/creator-cosmos \
  --artifacts type=NO_ARTIFACTS \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/standard:5.0,computeType=BUILD_GENERAL1_SMALL \
  --service-role <codebuild-role-arn>

# Create CodeDeploy application
aws deploy create-application \
  --application-name creator-cosmos \
  --compute-platform Server

# Create deployment group
aws deploy create-deployment-group \
  --application-name creator-cosmos \
  --deployment-group-name production \
  --service-role-arn <codedeploy-role-arn> \
  --auto-scaling-groups creator-cosmos-asg
```

---

## Security Best Practices

1. **Enable AWS WAF** on ALB for DDoS protection
2. **Use AWS Secrets Manager** instead of .env files
3. **Enable MFA** on AWS root account
4. **Regular security audits** with AWS Inspector
5. **Encrypt EBS volumes** on EC2 instances
6. **Enable VPC Flow Logs** for network monitoring
7. **Use IAM roles** instead of access keys on EC2
8. **Implement rate limiting** in application code
9. **Regular dependency updates** (npm audit, pip audit)
10. **Backup database** daily with 30-day retention

---

## Support & Resources

### AWS Documentation
- EC2: https://docs.aws.amazon.com/ec2/
- DocumentDB: https://docs.aws.amazon.com/documentdb/
- ALB: https://docs.aws.amazon.com/elasticloadbalancing/
- Route53: https://docs.aws.amazon.com/route53/

### Application Documentation
- Architecture: `/app/memory/architecture.md`
- API Reference: `/app/memory/phase2_features.md`
- Feature Docs: `/app/memory/phase3_advanced_features.md`
- Live Streaming: `/app/memory/phase4_live_privacy_auth.md`

### Emergency Contacts
- AWS Support: https://console.aws.amazon.com/support/
- Community Forum: https://repost.aws/

---

**Deployment Guide Version**: 1.0
**Last Updated**: January 30, 2026
**Platform**: Creator Cosmos - Next-Gen Social Ecosystem
