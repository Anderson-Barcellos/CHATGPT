#!/bin/bash

################################################################################
# Pre-Deployment Checks Script
# 
# Runs various checks before deploying to production:
# - Environment validation
# - Type checking
# - Linting
# - Build verification
# - Bundle size analysis
# - Security audit
#
# Usage:
#   ./scripts/pre-deploy.sh [--skip-build]
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Symbols
CHECK="✓"
CROSS="✗"
INFO="ℹ"

# Configuration
SKIP_BUILD=false
FAILED_CHECKS=0

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
  esac
done

################################################################################
# Helper Functions
################################################################################

print_header() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}${CHECK} $1${NC}"
}

print_error() {
  echo -e "${RED}${CROSS} $1${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

print_warning() {
  echo -e "${YELLOW}${INFO} $1${NC}"
}

print_info() {
  echo -e "${BLUE}${INFO} $1${NC}"
}

check_command() {
  if ! command -v $1 &> /dev/null; then
    print_error "$1 is not installed"
    return 1
  fi
  return 0
}

################################################################################
# Pre-flight Checks
################################################################################

print_header "Pre-flight Checks"

# Check Node.js version
print_info "Checking Node.js version..."
NODE_VERSION=$(node -v)
REQUIRED_NODE_VERSION="20"
CURRENT_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')

if [ "$CURRENT_MAJOR_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
  print_error "Node.js version $NODE_VERSION is too old. Required: v${REQUIRED_NODE_VERSION}+"
else
  print_success "Node.js version: $NODE_VERSION"
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
  print_error "package.json not found"
  exit 1
fi

print_success "package.json found"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  print_warning "node_modules not found. Running npm install..."
  npm install
  print_success "Dependencies installed"
else
  print_success "node_modules found"
fi

################################################################################
# Environment Validation
################################################################################

print_header "Environment Validation"

# Check if .env.local exists (for local testing)
if [ -f ".env.local" ]; then
  print_success ".env.local found"
  
  # Check for required environment variables
  REQUIRED_VARS=("OPENAI_API_KEY")
  
  for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" .env.local; then
      value=$(grep "^${var}=" .env.local | cut -d= -f2)
      if [ -z "$value" ] || [[ "$value" == *"xxxx"* ]] || [[ "$value" == *"your-"* ]]; then
        print_error "$var is not configured properly in .env.local"
      else
        print_success "$var is set"
      fi
    else
      print_error "$var is missing in .env.local"
    fi
  done
else
  print_warning ".env.local not found (okay for CI/CD with environment variables)"
fi

# Warn about .env.example
if [ ! -f ".env.example" ]; then
  print_warning ".env.example not found"
else
  print_success ".env.example found"
fi

################################################################################
# TypeScript Type Checking
################################################################################

print_header "TypeScript Type Checking"

if [ -f "tsconfig.json" ]; then
  print_info "Running TypeScript compiler..."
  
  if npx tsc --noEmit; then
    print_success "No type errors found"
  else
    print_error "TypeScript compilation failed"
  fi
else
  print_warning "tsconfig.json not found, skipping type check"
fi

################################################################################
# ESLint
################################################################################

print_header "ESLint Checks"

if [ -f "package.json" ] && grep -q "\"lint\"" package.json; then
  print_info "Running ESLint..."
  
  if npm run lint; then
    print_success "No linting errors"
  else
    print_error "ESLint found issues"
  fi
else
  print_warning "Lint script not found in package.json"
fi

################################################################################
# Build Verification
################################################################################

if [ "$SKIP_BUILD" = false ]; then
  print_header "Build Verification"
  
  print_info "Running production build..."
  
  # Clean previous build
  if [ -d ".next" ]; then
    print_info "Cleaning previous build..."
    rm -rf .next
  fi
  
  # Run build
  if npm run build; then
    print_success "Build completed successfully"
    
    # Check build output
    if [ -d ".next" ]; then
      BUILD_SIZE=$(du -sh .next | cut -f1)
      print_info "Build size: $BUILD_SIZE"
      
      # Check for build warnings
      if [ -f ".next/build-manifest.json" ]; then
        print_success "Build manifest generated"
      fi
    else
      print_error ".next directory not created"
    fi
  else
    print_error "Build failed"
  fi
else
  print_warning "Build verification skipped (--skip-build flag)"
fi

################################################################################
# Bundle Size Analysis
################################################################################

print_header "Bundle Size Analysis"

if [ -f ".next/build-manifest.json" ] || [ "$SKIP_BUILD" = true ]; then
  if [ "$SKIP_BUILD" = false ]; then
    # Check for large chunks
    print_info "Analyzing bundle size..."
    
    # Find large JavaScript files (> 500KB)
    LARGE_FILES=$(find .next/static -name "*.js" -size +500k 2>/dev/null || true)
    
    if [ -z "$LARGE_FILES" ]; then
      print_success "No excessively large bundles found"
    else
      print_warning "Large bundles detected:"
      echo "$LARGE_FILES" | while read file; do
        size=$(du -h "$file" | cut -f1)
        echo "  - $file ($size)"
      done
    fi
    
    # Total static file size
    if [ -d ".next/static" ]; then
      TOTAL_STATIC_SIZE=$(du -sh .next/static | cut -f1)
      print_info "Total static assets size: $TOTAL_STATIC_SIZE"
    fi
  else
    print_info "Skipped (no build)"
  fi
else
  print_warning "Build manifest not found, skipping bundle analysis"
fi

################################################################################
# Security Audit
################################################################################

print_header "Security Audit"

print_info "Running npm audit..."

# Run audit and capture output
AUDIT_OUTPUT=$(npm audit --audit-level=high 2>&1 || true)

if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
  print_success "No high/critical vulnerabilities found"
elif echo "$AUDIT_OUTPUT" | grep -q "ELOCKVERIFY"; then
  print_warning "npm audit skipped (lockfile verification issue)"
else
  print_warning "Security vulnerabilities found. Run 'npm audit' for details"
  echo "$AUDIT_OUTPUT" | grep -E "(high|critical)" || true
fi

# Check for common security issues in code
print_info "Checking for hardcoded secrets..."

SECRETS_PATTERNS=(
  "sk-[a-zA-Z0-9]{32,}"  # OpenAI API keys
  "AKIA[0-9A-Z]{16}"      # AWS Access Key
  "ghp_[a-zA-Z0-9]{36}"   # GitHub Personal Access Token
)

FOUND_SECRETS=false

for pattern in "${SECRETS_PATTERNS[@]}"; do
  if grep -r -E "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.next app lib components 2>/dev/null; then
    print_error "Potential hardcoded secret found matching pattern: $pattern"
    FOUND_SECRETS=true
  fi
done

if [ "$FOUND_SECRETS" = false ]; then
  print_success "No hardcoded secrets detected"
fi

################################################################################
# Git Status Check
################################################################################

print_header "Git Status"

if [ -d ".git" ]; then
  # Check for uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes"
    git status --short
  else
    print_success "Working directory is clean"
  fi
  
  # Show current branch
  CURRENT_BRANCH=$(git branch --show-current)
  print_info "Current branch: $CURRENT_BRANCH"
  
  # Warn if deploying from non-main branch
  if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    print_warning "You are not on the main/master branch"
  fi
else
  print_warning "Not a git repository"
fi

################################################################################
# Summary
################################################################################

print_header "Pre-Deployment Summary"

if [ $FAILED_CHECKS -eq 0 ]; then
  echo -e "${GREEN}${CHECK} All checks passed! Ready to deploy.${NC}\n"
  exit 0
else
  echo -e "${RED}${CROSS} $FAILED_CHECKS check(s) failed. Please fix the issues before deploying.${NC}\n"
  exit 1
fi
