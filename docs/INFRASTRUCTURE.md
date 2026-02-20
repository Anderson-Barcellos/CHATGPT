# Infrastructure

**Last updated:** 2026-01-30  
**Domain:** https://ultrassom.ai/chat  
**Port:** 3040

## Overview

```
Internet
  │
  ▼
Apache2 (HTTPS, port 443)
  │  ultrassom.ai-optimized.conf
  │  ProxyPass /chat → http://localhost:3040/chat
  ▼
Next.js 16 (Node.js, port 3040)
  │  basePath: /chat
  │  managed by systemd
  ▼
OpenAI API (external)
```

## Apache Reverse Proxy

**Config file:** `/root/CHATGPT/apache-config/chat.conf`  
**Installed at:** `/etc/apache2/sites-enabled/ultrassom.ai-optimized.conf` (included in main vhost)

### Key rules

```apache
# Main app
<Location /chat>
    ProxyPass http://localhost:3040/chat
    ProxyPassReverse http://localhost:3040/chat
    ProxyTimeout 120
</Location>

# API routes (longer timeout for AI)
<Location /chat/api>
    ProxyPass http://localhost:3040/chat/api
    ProxyTimeout 300
</Location>

# Static assets (1-year cache)
<Location /chat/_next>
    ProxyPass http://localhost:3040/chat/_next
    Header set Cache-Control "public, max-age=31536000, immutable"
</Location>
```

### Important notes

- Do NOT add a trailing-slash rewrite for `/chat` — it causes a redirect loop with Next.js basePath.
- The `X-Forwarded-Host` header is set to `ultrassom.ai`.
- WebSocket support is configured for HMR in development.

### Port registry

Check `/etc/apache2/APACHE.md` and use the port check script before allocating new ports:

```bash
/etc/apache2/check-port.sh 3040       # Check specific port
/etc/apache2/check-port.sh --list     # All ports in use
/etc/apache2/check-port.sh --reserved # Reserved ports
```

Gaúcho Chat uses port **3040** (within the 3030-3099 Vite frontends range).

## Systemd Service

**Source:** `/root/CHATGPT/systemd/chatgpt.service`  
**Installed at:** `/etc/systemd/system/chatgpt.service`

### Service configuration

```ini
[Unit]
Description=ChatGPT Clone (Gaúcho Chat)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/CHATGPT
Environment="NODE_ENV=production"
Environment="PORT=3040"
Environment="NEXT_PUBLIC_BASE_PATH=/chat"
EnvironmentFile=/root/CHATGPT/.env.production
ExecStartPre=/bin/bash -c 'fuser -k 3040/tcp 2>/dev/null; sleep 1; exit 0'
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=15
StartLimitBurst=5
KillMode=mixed
KillSignal=SIGTERM
TimeoutStartSec=30
StandardOutput=append:/var/log/chatgpt/app.log
StandardError=append:/var/log/chatgpt/error.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### Management commands

```bash
sudo systemctl start chatgpt
sudo systemctl stop chatgpt
sudo systemctl restart chatgpt
sudo systemctl status chatgpt
sudo journalctl -u chatgpt -f         # Follow logs
sudo journalctl -u chatgpt -n 50      # Last 50 lines
```

### Log files

| File | Content |
|------|---------|
| `/var/log/chatgpt/app.log` | Application stdout |
| `/var/log/chatgpt/error.log` | Application stderr + API errors |

### Deployment workflow

```bash
cd /root/CHATGPT
npm run build                          # Build production bundle
sudo systemctl restart chatgpt         # Restart service
sudo systemctl status chatgpt          # Verify running
curl -s http://localhost:3040/chat     # Verify HTTP 200
```

If port 3040 is stuck (EADDRINUSE):
```bash
sudo fuser -k -9 3040/tcp
sudo systemctl restart chatgpt
```

## Environment Variables

**File:** `.env.local` (development) / `.env.production` (production)

### Required

| Variable | Value | Purpose |
|----------|-------|---------|
| `OPENAI_API_KEY` | `sk-proj-...` | OpenAI API authentication |
| `NEXT_PUBLIC_BASE_PATH` | `/chat` | URL prefix for Apache subpath |
| `PORT` | `3040` | Node.js listen port |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_APP_URL` | — | Full public URL |
| `NEXT_PUBLIC_APP_NAME` | `Gaúcho Chat` | App display name |
| `NODE_ENV` | `development` | Environment mode |
| `RATE_LIMIT_ENABLED` | `false` | Enable rate limiting |
| `RATE_LIMIT_CHAT_RPM` | `20` | Chat requests per minute |
| `RATE_LIMIT_CANVAS_RPM` | `10` | Canvas requests per minute |
| `RATE_LIMIT_IMAGES_RPM` | `5` | Image requests per minute |
| `API_KEY_AUTH_ENABLED` | `false` | Require X-Api-Key header |
| `API_KEYS` | — | Comma-separated valid API keys |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated allowed origins |
| `ENABLE_REQUEST_LOGGING` | `false` | Log all API requests |
| `REDIS_URL` | — | Redis URL for distributed rate limiting |

## Next.js Configuration

**File:** `next.config.ts`

Key settings:
- `basePath: "/chat"` — all routes under /chat
- `assetPrefix: "/chat"` — static assets under /chat/_next
- `compress: true` — gzip
- `poweredByHeader: false` — strip X-Powered-By
- `reactStrictMode: true`
- `optimizePackageImports` for lucide-react, @radix-ui, react-syntax-highlighter, @tanstack/react-query
- Custom webpack chunking (framework, lib, commons, shared)
- Image domains: `**.openai.com`, `chat.ultrassom.ai`

## SSL / HTTPS

Handled entirely by Apache2 with Let's Encrypt certificates for `ultrassom.ai`. The Next.js app only serves HTTP on localhost:3040.
