# Scripts Directory

Utility scripts for deployment and maintenance.

## Available Scripts

### pre-deploy.sh

Comprehensive pre-deployment checks to ensure the application is ready for production.

**Usage:**
```bash
./scripts/pre-deploy.sh [--skip-build]
```

**What it checks:**
- Node.js version compatibility
- Environment variables configuration
- TypeScript type errors
- ESLint issues
- Production build success
- Bundle size analysis
- Security vulnerabilities
- Hardcoded secrets
- Git status

**Exit codes:**
- `0` - All checks passed
- `1` - One or more checks failed

**Example output:**
```
========================================
Pre-flight Checks
========================================

✓ Node.js version: v20.11.0
✓ package.json found
✓ node_modules found

========================================
Environment Validation
========================================

✓ .env.local found
✓ OPENAI_API_KEY is set
...
```

**Flags:**
- `--skip-build` - Skip the build verification step (faster checks)

## Creating New Scripts

When adding new scripts:

1. Create the script file in this directory
2. Add shebang line: `#!/bin/bash`
3. Make it executable: `chmod +x scripts/your-script.sh`
4. Document it in this README
5. Add error handling with `set -e`
6. Use colored output for better UX

**Template:**
```bash
#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Starting task...${NC}"

# Your code here

echo -e "${GREEN}Task completed!${NC}"
```
