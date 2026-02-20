# SSL Certificates

Place your SSL certificate files here for HTTPS support.

## Required Files

- `cert.pem` - SSL certificate (public key)
- `key.pem` - Private key

## Getting SSL Certificates

### Option 1: Let's Encrypt (Free, Production)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d chat.ultrassom.ai

# Copy to this directory
sudo cp /etc/letsencrypt/live/chat.ultrassom.ai/fullchain.pem ./cert.pem
sudo cp /etc/letsencrypt/live/chat.ultrassom.ai/privkey.pem ./key.pem

# Set proper permissions
sudo chown $USER:$USER *.pem
chmod 600 key.pem
chmod 644 cert.pem
```

### Option 2: Self-Signed (Development Only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/CN=chat.ultrassom.ai"
```

**WARNING:** Self-signed certificates will show security warnings in browsers. Only use for development/testing.

### Option 3: Cloudflare Origin Certificate

1. Go to Cloudflare Dashboard
2. Select your domain
3. Go to SSL/TLS → Origin Server
4. Click "Create Certificate"
5. Download both files and save as `cert.pem` and `key.pem`

## Renewal

Let's Encrypt certificates expire after 90 days. Set up auto-renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Setup cron job for auto-renewal
sudo crontab -e

# Add this line:
0 0 1 * * certbot renew --quiet && docker-compose restart nginx
```

## Security

- Never commit these files to Git (they're in .gitignore)
- Keep `key.pem` permissions at 600 (read/write for owner only)
- Rotate certificates before expiry
- Use strong encryption (RSA 2048+ or ECDSA)
