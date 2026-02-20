# Deployment Architecture

## 1. Infrastructure Topology

### Runtime Environment
The application is designed to run in a **Containerized** environment or on a **Serverless** platform like Vercel.

-   **Docker:** A `Dockerfile` and `docker-compose.yml` are present, enabling self-hosting.
    -   **Web Service:** The Next.js Node.js server.
-   **Vercel:** `vercel.json` indicates optimization for the Vercel platform (Edge Functions, static serving).

## 2. Build Process

1.  **Dependencies:** `npm install` (via `package.json`).
2.  **Linting:** `npm run lint` ensures code quality.
3.  **Compilation:** `npm run build` (Next.js build).
    -   Generates static pages where possible.
    -   Compiles Server Actions and API routes.
    -   Optimizes images and fonts.
    -   Uploads Sentry source maps.

## 3. Web Server Configuration

-   **Next.js Server:** In production (`next start`), Next.js acts as the HTTP server.
-   **Headers:** Security headers (HSTS, X-Frame-Options) are configured in `next.config.ts`.
-   **Apache/Nginx:** The presence of `apache-config/` and `nginx/` folders suggests the app can be deployed behind a reverse proxy for SSL termination and load balancing in self-hosted scenarios.

## 4. CI/CD Pipeline

-   **GitHub Actions:** `.github/workflows/deploy.yml` and `pr-checks.yml`.
    -   **PR Checks:** Runs linting, type checking, and tests on pull requests.
    -   **Deploy:** Automates deployment to production environment upon merge to main.
