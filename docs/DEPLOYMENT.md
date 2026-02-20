# Deployment Guide - ChatGPT Clone

Complete guide for deploying your ChatGPT clone to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Option A: Deploy to Vercel (Recommended)](#option-a-deploy-to-vercel)
4. [Option B: Self-Hosting with Docker](#option-b-self-hosting-with-docker)
5. [Environment Variables](#environment-variables)
6. [Post-Deployment](#post-deployment)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Performance Tuning](#performance-tuning)

---

## Prerequisites

### Required

- Node.js 20+ installed
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- Git installed and repository initialized
- Domain configured (chat.ultrassom.ai)

### Optional

- Sentry account for error tracking
- Redis/Upstash for distributed rate limiting
- Database (PostgreSQL/MongoDB) for conversation persistence

---

## Deployment Options

### Comparison

| Feature | Vercel | Self-Hosted (Docker) |
|---------|--------|---------------------|
| Setup Time | 5 minutes | 30 minutes |
| Cost | Free tier available | Server costs |
| Scaling | Automatic | Manual |
| SSL | Automatic | Manual setup |
| Maintenance | Minimal | Regular updates |
| Control | Limited | Full control |

---

## Option A: Deploy to Vercel

### Step 1: Pre-deployment Checks

Run the pre-deployment script to verify everything is ready:

```bash
./scripts/pre-deploy.sh
```

Fix any issues reported before proceeding.

### Step 2: Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

### Step 3: Login to Vercel

```bash
vercel login
```

### Step 4: Configure Environment Variables

Create a `.env.production` file with your production values:

```bash
cp .env.example .env.production
```

Edit `.env.production` and set:
- `OPENAI_API_KEY` - Your OpenAI API key
- `NEXT_PUBLIC_APP_URL` - https://chat.ultrassom.ai
- Other variables as needed

### Step 5: Deploy to Vercel

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Step 6: Configure Domain

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Add `chat.ultrassom.ai`
4. Follow the DNS configuration instructions

### Step 7: Set Environment Variables in Vercel

```bash
# Via CLI
vercel env add OPENAI_API_KEY production

# Or via Dashboard:
# 1. Go to Settings → Environment Variables
# 2. Add each variable from .env.example
# 3. Select "Production" environment
```

### Step 8: Redeploy with Environment Variables

```bash
vercel --prod
```

### Step 9: Verify Deployment

```bash
curl https://chat.ultrassom.ai/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-29T...",
  "uptime": 123.45,
  "environment": "production",
  "version": "0.1.0"
}
```

---

## Option B: Self-Hosting with Docker

### Prerequisites

- Docker and Docker Compose installed
- Server with at least 2GB RAM
- Domain pointing to your server

### Step 1: Clone Repository on Server

```bash
git clone <your-repo-url>
cd CHATGPT
```

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your production values.

### Step 3: Generate SSL Certificates

#### Option A: Using Certbot (Let's Encrypt)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d chat.ultrassom.ai

# Copy certificates
sudo cp /etc/letsencrypt/live/chat.ultrassom.ai/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/chat.ultrassom.ai/privkey.pem nginx/ssl/key.pem
```

#### Option B: Self-Signed (Development Only)

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/CN=chat.ultrassom.ai"
```

### Step 4: Update Next.js Config for Standalone Build

Add to `next.config.ts`:

```typescript
export default {
  // ... other config
  output: 'standalone',
};
```

### Step 5: Build and Start Services

```bash
# Build the application
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app
```

### Step 6: Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# Test health endpoint
curl https://chat.ultrassom.ai/api/health

# Test chat endpoint (requires API key)
curl -X POST https://chat.ultrassom.ai/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Step 7: Setup Auto-Restart (Optional)

```bash
# Enable watchtower for automatic updates
docker-compose --profile auto-update up -d
```

### Step 8: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

---

## Environment Variables

### Required Variables

```bash
# OpenAI API Key (REQUIRED)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx

# Application URL
NEXT_PUBLIC_APP_URL=https://chat.ultrassom.ai
```

### Recommended Variables

```bash
# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_CHAT_RPM=20
RATE_LIMIT_CANVAS_RPM=10
RATE_LIMIT_IMAGES_RPM=5

# Redis (for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

### Optional Variables

```bash
# Sentry Error Tracking
SENTRY_ENABLED=true
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# API Key Authentication
API_KEY_AUTH_ENABLED=false
API_KEYS=key1,key2,key3

# Feature Flags
NEXT_PUBLIC_ENABLE_CANVAS=true
NEXT_PUBLIC_ENABLE_IMAGES=true
NEXT_PUBLIC_ENABLE_EXPORT=true
```

---

## Post-Deployment

### 1. Test All Features

```bash
# Chat functionality
# Open https://chat.ultrassom.ai
# Send a message and verify response

# Canvas feature (if enabled)
# Test code editing and artifacts

# Image generation (if enabled)
# Test DALL-E integration

# Export functionality
# Try exporting conversation as PDF/JSON
```

### 2. Monitor Initial Traffic

Watch logs for any errors:

```bash
# Vercel
vercel logs --follow

# Docker
docker-compose logs -f app
```

### 3. Configure Monitoring

If using Sentry:

```bash
# Install Sentry SDK
npm install @sentry/nextjs

# Run setup wizard
npx @sentry/wizard@latest -i nextjs

# Update environment variables
SENTRY_ENABLED=true
SENTRY_DSN=your-dsn

# Redeploy
```

### 4. Setup Backups (Self-Hosted)

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/chatgpt"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup Redis data
docker-compose exec redis redis-cli SAVE
docker cp chatgpt-redis:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Backup environment
cp .env $BACKUP_DIR/.env_$DATE

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
EOF

chmod +x backup.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

---

## Monitoring & Maintenance

### Health Checks

Set up uptime monitoring with:
- [UptimeRobot](https://uptimerobot.com) (free)
- [Pingdom](https://www.pingdom.com)
- [Better Uptime](https://betteruptime.com)

Monitor endpoint: `https://chat.ultrassom.ai/api/health`

### Performance Monitoring

#### Vercel Analytics

Enable in Vercel dashboard:
1. Go to project settings
2. Enable Vercel Analytics
3. Enable Speed Insights

#### Self-Hosted Monitoring

Use Grafana + Prometheus:

```yaml
# Add to docker-compose.yml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - '9090:9090'

  grafana:
    image: grafana/grafana
    ports:
      - '3001:3000'
    volumes:
      - grafana-data:/var/lib/grafana
```

### Log Rotation (Self-Hosted)

```bash
# Create logrotate config
sudo cat > /etc/logrotate.d/chatgpt << EOF
/path/to/CHATGPT/nginx/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        docker-compose exec nginx nginx -s reload > /dev/null
    endscript
}
EOF
```

### Updates

#### Vercel (Automatic)

Every git push to main branch triggers a new deployment.

#### Docker (Manual)

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Or with watchtower (automatic)
# Just push to container registry
```

---

## Troubleshooting

### Common Issues

#### 1. "OPENAI_API_KEY is not set" Error

**Solution:**
```bash
# Vercel: Set environment variable
vercel env add OPENAI_API_KEY production

# Docker: Check .env file
cat .env | grep OPENAI_API_KEY

# Restart containers
docker-compose restart app
```

#### 2. Rate Limiting Not Working

**Solution:**
```bash
# Check Redis connection
docker-compose exec redis redis-cli ping
# Expected: PONG

# Check app logs
docker-compose logs app | grep -i "rate limit"

# Verify environment variable
echo $RATE_LIMIT_ENABLED
```

#### 3. SSL Certificate Errors (Self-Hosted)

**Solution:**
```bash
# Verify certificate files
ls -lh nginx/ssl/

# Test nginx config
docker-compose exec nginx nginx -t

# Regenerate Let's Encrypt certificate
sudo certbot renew --force-renewal
```

#### 4. Build Fails

**Solution:**
```bash
# Clear build cache
rm -rf .next node_modules

# Reinstall dependencies
npm install

# Try build again
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

#### 5. High Memory Usage

**Solution:**
```bash
# Increase Docker memory limit
# Edit docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G

# Restart
docker-compose up -d
```

#### 6. API Timeout Errors

**Solution:**

For Vercel, timeouts are handled in `vercel.json`:
```json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

For Docker:
```nginx
# In nginx/nginx.conf
proxy_read_timeout 120s;
proxy_connect_timeout 120s;
```

---

## Performance Tuning

### 1. Enable Redis Caching

```bash
# Install Redis client
npm install ioredis

# Update rate limit config
REDIS_URL=redis://localhost:6379
```

### 2. Optimize Images

```typescript
// next.config.ts
export default {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },
};
```

### 3. Enable Compression

Already configured in:
- `next.config.ts` (gzip via Next.js)
- `nginx/nginx.conf` (gzip via Nginx)
- `vercel.json` (automatic on Vercel)

### 4. Database Query Optimization

If using PostgreSQL for conversation history:

```sql
-- Add indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

### 5. CDN Configuration

For Vercel: Automatic global CDN

For self-hosted:
- Cloudflare (free tier)
- AWS CloudFront
- Fastly

### 6. Bundle Size Optimization

```bash
# Analyze bundle
ANALYZE=true npm run build

# Review output and remove large dependencies
# Consider lazy loading heavy components
```

---

## Security Checklist

- [ ] SSL/TLS enabled (HTTPS)
- [ ] Environment variables secured (not in source code)
- [ ] Rate limiting enabled
- [ ] CORS configured properly
- [ ] Security headers set (CSP, HSTS, etc.)
- [ ] API keys rotated regularly
- [ ] Error messages don't leak sensitive info
- [ ] Dependency vulnerabilities checked (`npm audit`)
- [ ] Firewall configured (if self-hosted)
- [ ] Backups scheduled (if self-hosted)
- [ ] Monitoring and alerts set up

---

## Support & Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Vercel Docs:** https://vercel.com/docs
- **Docker Docs:** https://docs.docker.com
- **OpenAI API Docs:** https://platform.openai.com/docs
- **Sentry Docs:** https://docs.sentry.io

---

## License

This deployment guide is part of the ChatGPT Clone project.

Last Updated: 2026-01-29
