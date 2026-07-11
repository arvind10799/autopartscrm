# Auto Parts CRM AWS Deployment Runbook

This runbook is for the current AWS target:

- EC2: Amazon Linux 2023
- Database: Amazon RDS PostgreSQL
- Cache/queue: ElastiCache Redis serverless
- App runtime: Node.js, PM2, Nginx

## Required AWS Security Groups

Before running the deployment, confirm these rules:

- EC2 inbound: allow TCP 22 from your IP, TCP 80 from the internet, TCP 443 from the internet when SSL is ready.
- RDS inbound: allow TCP 5432 from the EC2 security group only.
- ElastiCache inbound: allow TCP 6379 from the EC2 security group only.

## Production Values

Use these values when the script asks for environment variables:

```bash
APP_DIR="/opt/auto-parts-crm"
REPO_URL="https://github.com/arvind10799/autopartscrm.git"
BRANCH="main"
APP_PUBLIC_URL="http://YOUR_EC2_PUBLIC_IP"
API_INTERNAL_URL="http://127.0.0.1:3000"
DB_NAME="auto_parts_crm"
REDIS_HOST="crm-wjf4r8.serverless.apse2.cache.amazonaws.com"
REDIS_PORT="6379"
REDIS_TLS_ENABLED="true"
```

Build the database URL from the RDS credentials:

```bash
DATABASE_URL="postgresql://postgres:YOUR_RDS_PASSWORD@database-1.c9wgco4aopuo.ap-southeast-2.rds.amazonaws.com:5432/auto_parts_crm?schema=public"
```

If the RDS database was not created with the `auto_parts_crm` database name, create it first or change the database name in `DATABASE_URL`.

## First Deployment

SSH to the EC2 instance as `ec2-user`, copy this repository, then run:

```bash
chmod +x deployment/aws/setup-amazon-linux-2023.sh
chmod +x deployment/aws/deploy-app.sh
sudo deployment/aws/setup-amazon-linux-2023.sh
deployment/aws/deploy-app.sh
```

The deploy script installs dependencies, writes `backend/.env` and `frontend/.env.production`, runs Prisma migrations, builds both apps, starts backend, worker, and frontend with PM2, and configures Nginx.

## PM2 Processes

The deployment starts three processes:

- `auto-parts-backend`: NestJS API on port 3000
- `auto-parts-worker`: BullMQ worker for background jobs
- `auto-parts-frontend`: Next.js app on port 3001

Useful commands:

```bash
pm2 status
pm2 logs auto-parts-backend
pm2 logs auto-parts-worker
pm2 logs auto-parts-frontend
```

## Future Deployments

After the first deployment:

```bash
cd /opt/auto-parts-crm
git pull
deployment/aws/deploy-app.sh
```

## SSL

After a real domain points to the EC2 public IP:

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx
```

