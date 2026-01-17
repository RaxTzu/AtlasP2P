#!/bin/bash
set -e

# Build script for cross-platform compilation of the verification server
# Outputs binaries to apps/web/public/verify/ for distribution

VERSION="1.0.0"
OUTPUT_DIR="../../apps/web/public/verify"
BINARY_NAME="verify"

echo "╔════════════════════════════════════════════╗"
echo "║   Building AtlasP2P Verification Server    ║"
echo "║   Version: $VERSION                         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to build for a specific platform
build_platform() {
    local GOOS=$1
    local GOARCH=$2
    local EXT=$3
    local FRIENDLY_NAME=$4

    echo "🔨 Building for $FRIENDLY_NAME..."

    FILENAME="${BINARY_NAME}-${GOOS}-${GOARCH}${EXT}"

    env GOOS=$GOOS GOARCH=$GOARCH CGO_ENABLED=0 go build \
        -ldflags="-s -w -X main.Version=$VERSION" \
        -trimpath \
        -o "$OUTPUT_DIR/$FILENAME" \
        .

    # Generate checksum
    if [[ "$OSTYPE" == "darwin"* ]]; then
        shasum -a 256 "$OUTPUT_DIR/$FILENAME" | awk '{print $1}' > "$OUTPUT_DIR/$FILENAME.sha256"
    else
        sha256sum "$OUTPUT_DIR/$FILENAME" | awk '{print $1}' > "$OUTPUT_DIR/$FILENAME.sha256"
    fi

    SIZE=$(du -h "$OUTPUT_DIR/$FILENAME" | cut -f1)
    echo "   ✅ $FILENAME ($SIZE)"
}

# Build for all platforms
build_platform "linux" "amd64" "" "Linux (x86_64)"
build_platform "linux" "arm64" "" "Linux (ARM64)"
build_platform "darwin" "amd64" "" "macOS (Intel)"
build_platform "darwin" "arm64" "" "macOS (Apple Silicon)"
build_platform "windows" "amd64" ".exe" "Windows (x86_64)"

echo ""
echo "✅ Build complete! Binaries available at:"
echo "   $OUTPUT_DIR"
echo ""
echo "📦 Generated files:"
ls -lh "$OUTPUT_DIR" | grep -v "^total" | awk '{print "   " $9 " (" $5 ")"}'
echo ""
