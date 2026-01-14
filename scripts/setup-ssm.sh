#!/bin/bash
# ===========================================
# AWS SSM PARAMETER STORE SETUP
# ===========================================
# Interactive script to upload .env variables to AWS SSM Parameter Store
#
# Prerequisites:
#   - AWS CLI installed and configured
#   - production.env file in config/ directory
#   - IAM permissions for ssm:PutParameter
#
# Usage:
#   ./scripts/setup-ssm.sh
#
# Output:
#   - Creates SSM parameter: /AtlasP2P/{PROJECT_NAME}/Production
#   - Provides instructions for GitHub Actions configuration
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
echo "  AWS SSM Parameter Store Setup"
echo "========================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    echo ""
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi
print_success "AWS CLI is installed"

# Check AWS authentication
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS CLI is not configured or authentication failed"
    echo ""
    echo "Run: aws configure"
    exit 1
fi
print_success "AWS CLI is authenticated"

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
# GATHER INFORMATION
# ===========================================

echo ""
print_info "This script will create an AWS SSM SecureString parameter containing your production environment variables."
echo ""

# Get project name
read -p "Enter your project name (e.g., MyChainNodes): " PROJECT_NAME
if [ -z "$PROJECT_NAME" ]; then
    print_error "Project name cannot be empty"
    exit 1
fi

# Get AWS region
read -p "Enter AWS region [us-west-2]: " AWS_REGION
AWS_REGION=${AWS_REGION:-us-west-2}

# Construct parameter name
PARAMETER_NAME="/AtlasP2P/${PROJECT_NAME}/Production"

# ===========================================
# PREVIEW
# ===========================================

echo ""
echo "========================================="
echo "  Configuration Preview"
echo "========================================="
echo "Project Name:    $PROJECT_NAME"
echo "AWS Region:      $AWS_REGION"
echo "Parameter Name:  $PARAMETER_NAME"
echo "Source File:     $PROD_ENV_FILE"
echo ""

# Read and validate the .env file
ENV_CONTENT=$(cat "$PROD_ENV_FILE")
LINE_COUNT=$(echo "$ENV_CONTENT" | grep -v '^#' | grep -v '^$' | wc -l)

print_info "Found $LINE_COUNT non-empty, non-comment lines in production.env"
echo ""

# Confirm before proceeding
read -p "Continue with SSM parameter creation? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    print_warning "Aborted by user"
    exit 0
fi

# ===========================================
# CREATE SSM PARAMETER
# ===========================================

echo ""
print_info "Creating SSM parameter..."

if aws ssm put-parameter \
    --name "$PARAMETER_NAME" \
    --value "$ENV_CONTENT" \
    --type "SecureString" \
    --region "$AWS_REGION" \
    --overwrite \
    --description "Production environment variables for $PROJECT_NAME" \
    > /dev/null 2>&1; then
    print_success "SSM parameter created successfully"
else
    print_error "Failed to create SSM parameter"
    echo ""
    echo "Common causes:"
    echo "  - Missing IAM permissions (ssm:PutParameter)"
    echo "  - Invalid AWS region"
    echo "  - Network connectivity issues"
    exit 1
fi

# ===========================================
# GITHUB ACTIONS CONFIGURATION
# ===========================================

echo ""
echo "========================================="
echo "  GitHub Actions Configuration"
echo "========================================="
echo ""
print_success "SSM parameter created successfully!"
echo ""
print_info "Next steps for GitHub Actions:"
echo ""
echo "1. Add GitHub Variables (NOT secrets):"
echo "   Go to: Settings > Secrets and Variables > Actions > Variables"
echo ""
echo "   Variable Name:   SSM_PARAM_NAME"
echo "   Variable Value:  $PARAMETER_NAME"
echo ""
echo "   Variable Name:   AWS_REGION"
echo "   Variable Value:  $AWS_REGION"
echo ""
echo "2. Add GitHub Secrets for AWS credentials:"
echo "   Go to: Settings > Secrets and Variables > Actions > Secrets"
echo ""
echo "   Secret Name:     AWS_ACCESS_KEY_ID"
echo "   Secret Value:    <Your AWS Access Key ID>"
echo ""
echo "   Secret Name:     AWS_SECRET_ACCESS_KEY"
echo "   Secret Value:    <Your AWS Secret Access Key>"
echo ""
echo "3. The deployment workflow will automatically:"
echo "   - Fetch environment variables from SSM"
echo "   - Download deployment.env artifact from CI build"
echo "   - Merge both into final .env file"
echo "   - Deploy to your server"
echo ""
echo "========================================="
echo ""

# ===========================================
# VERIFICATION
# ===========================================

print_info "Verifying parameter..."
if aws ssm get-parameter \
    --name "$PARAMETER_NAME" \
    --region "$AWS_REGION" \
    --with-decryption \
    > /dev/null 2>&1; then
    print_success "Parameter verified and accessible"
else
    print_warning "Could not verify parameter (might be a permissions issue)"
fi

echo ""
print_success "Setup complete!"
echo ""
