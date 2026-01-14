#!/bin/bash
# ===========================================
# GITHUB SECRETS BULK UPLOAD
# ===========================================
# Interactive script to bulk-upload production environment variables
# to GitHub repository secrets
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated
#   - production.env file in config/ directory
#   - Repository access with secrets:write permission
#
# Usage:
#   ./scripts/setup-github-secrets.sh
#
# Output:
#   - Creates GitHub secrets for all variables in production.env
#   - Skips NEXT_PUBLIC_* variables (not secrets, go in deployment.env)
#   - Skips comment lines and empty lines
# ===========================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ===========================================
# HELPER FUNCTIONS
# ===========================================

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# ===========================================
# VALIDATION
# ===========================================

echo ""
echo "========================================="
echo "  GitHub Secrets Bulk Upload"
echo "========================================="
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI is not installed"
    echo ""
    echo "Install it from: https://cli.github.com/"
    exit 1
fi
print_success "GitHub CLI is installed"

# Check GitHub authentication
if ! gh auth status &> /dev/null; then
    print_error "GitHub CLI is not authenticated"
    echo ""
    echo "Run: gh auth login"
    exit 1
fi
print_success "GitHub CLI is authenticated"

# Check if production.env exists
PROD_ENV_FILE="config/production.env"
if [ ! -f "$PROD_ENV_FILE" ]; then
    print_error "Production environment file not found: $PROD_ENV_FILE"
    echo ""
    echo "Create it from the example:"
    echo "  cp config/production.env.example config/production.env"
    echo "  # Edit config/production.env with your values"
    exit 1
fi
print_success "Production environment file found"

# ===========================================
# AUTO-DETECT REPOSITORY
# ===========================================

echo ""
print_info "Detecting GitHub repository..."

if ! REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null); then
    print_error "Could not detect GitHub repository"
    echo ""
    echo "Make sure you're in a git repository with a GitHub remote."
    echo "Alternatively, run this command from the repository root."
    exit 1
fi

print_success "Repository detected: $REPO"

# ===========================================
# PARSE AND PREVIEW
# ===========================================

echo ""
print_info "Analyzing production.env..."

# Arrays to store secrets
declare -a SECRET_NAMES=()
declare -a SECRET_VALUES=()
declare -a SKIPPED_VARS=()

# Parse the .env file
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines
    if [ -z "$line" ]; then
        continue
    fi

    # Skip comment lines
    if [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi

    # Extract key=value
    if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
        KEY="${BASH_REMATCH[1]}"
        VALUE="${BASH_REMATCH[2]}"

        # Skip NEXT_PUBLIC_* variables (these go in deployment.env, not secrets)
        if [[ "$KEY" =~ ^NEXT_PUBLIC_ ]]; then
            SKIPPED_VARS+=("$KEY (public variable)")
            continue
        fi

        # Skip empty values
        if [ -z "$VALUE" ]; then
            SKIPPED_VARS+=("$KEY (empty value)")
            continue
        fi

        SECRET_NAMES+=("$KEY")
        SECRET_VALUES+=("$VALUE")
    fi
done < "$PROD_ENV_FILE"

# ===========================================
# PREVIEW
# ===========================================

echo ""
echo "========================================="
echo "  Configuration Preview"
echo "========================================="
echo "Repository:       $REPO"
echo "Secrets to create: ${#SECRET_NAMES[@]}"
echo "Skipped variables: ${#SKIPPED_VARS[@]}"
echo ""

if [ ${#SKIPPED_VARS[@]} -gt 0 ]; then
    print_warning "Skipped variables (will NOT be uploaded):"
    for var in "${SKIPPED_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
fi

print_info "Secrets to upload:"
for key in "${SECRET_NAMES[@]}"; do
    echo "  - $key"
done
echo ""

# ===========================================
# CONFIRMATION
# ===========================================

read -p "Continue with uploading ${#SECRET_NAMES[@]} secrets to $REPO? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    print_warning "Aborted by user"
    exit 0
fi

# ===========================================
# UPLOAD SECRETS
# ===========================================

echo ""
print_info "Uploading secrets to GitHub..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for i in "${!SECRET_NAMES[@]}"; do
    KEY="${SECRET_NAMES[$i]}"
    VALUE="${SECRET_VALUES[$i]}"

    # Show progress
    echo -n "[$((i+1))/${#SECRET_NAMES[@]}] Uploading $KEY... "

    # Upload secret
    if echo "$VALUE" | gh secret set "$KEY" -R "$REPO" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}✗${NC}"
        ((FAIL_COUNT++))
    fi
done

# ===========================================
# SUMMARY
# ===========================================

echo ""
echo "========================================="
echo "  Upload Summary"
echo "========================================="
print_success "Successfully uploaded: $SUCCESS_COUNT secrets"

if [ $FAIL_COUNT -gt 0 ]; then
    print_error "Failed to upload: $FAIL_COUNT secrets"
    echo ""
    echo "Common causes:"
    echo "  - Missing repository permissions (secrets:write)"
    echo "  - Network connectivity issues"
    echo "  - Invalid secret values (certain characters may need escaping)"
fi

echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    print_success "Secrets uploaded successfully!"
    echo ""
    print_info "Next steps:"
    echo ""
    echo "1. Verify secrets in GitHub:"
    echo "   https://github.com/$REPO/settings/secrets/actions"
    echo ""
    echo "2. Add GitHub Variables (NOT secrets):"
    echo "   https://github.com/$REPO/settings/variables/actions"
    echo ""
    echo "   These variables should be added manually:"
    for var in "${SKIPPED_VARS[@]}"; do
        if [[ "$var" =~ ^NEXT_PUBLIC_ ]]; then
            echo "   - ${var%% *}"
        fi
    done
    echo ""
    echo "3. Your CI/CD workflow can now access these secrets!"
    echo ""
fi

echo "========================================="
echo ""
