#!/bin/bash
# Setup script for nsjail code execution sandbox
# Run this script on a fresh VPS/deployment to install required dependencies
#
# Usage:
#   chmod +x scripts/setup-nsjail.sh
#   ./scripts/setup-nsjail.sh
#
# This script works on:
#   - Ubuntu/Debian (apt)
#   - Alpine (apk) - for Docker environments

set -e

echo "========================================"
echo "  nsjail Setup for Derit Code Execution"
echo "========================================"

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
elif command -v apk &> /dev/null; then
    PKG_MANAGER="apk"
else
    echo "Error: No supported package manager found (apt-get or apk)"
    exit 1
fi

echo "Detected package manager: $PKG_MANAGER"

# Update package lists
if [ "$PKG_MANAGER" = "apt-get" ]; then
    echo "Updating package lists..."
    sudo apt-get update -qq
    
    echo "Installing Java (JDK 11)..."
    sudo apt-get install -y openjdk-11-jdk-headless
    
    echo "Installing Python 3..."
    sudo apt-get install -y python3 python3-pip
    
    echo "Installing nsjail..."
    # Check if nsjail is available in repos, otherwise build from source
    if ! sudo apt-get install -y nsjail 2>/dev/null; then
        echo "nsjail not in apt repos, building from source..."
        
        # Install build dependencies
        sudo apt-get install -y \
            git \
            protobuf-compiler \
            libprotobuf-dev \
            libnl-route-3-dev \
            iptables-dev \
            pkg-config \
            g++ \
            make
        
        # Clone and build nsjail
        NSJAIL_TMP=$(mktemp -d)
        git clone --depth 1 https://github.com/google/nsjail.git "$NSJAIL_TMP"
        cd "$NSJAIL_TMP"
        make -j$(nproc)
        sudo make install
        cd -
        rm -rf "$NSJAIL_TMP"
        
        echo "nsjail installed from source"
    else
        echo "nsjail installed from apt"
    fi
    
    echo "Setting up cgroups (required for nsjail)..."
    # Enable required kernel modules for cgroups
    if [ -f /etc/default/grub ]; then
        # Check if cgroup namespaces are available
        if ! grep -q "cgroup_enable=memory" /proc/cmdline 2>/dev/null; then
            echo "Note: You may need to enable cgroups in GRUB for full nsjail functionality"
            echo "Add 'cgroup_enable=memory cgroup_enable= freezer' to GRUB_CMDLINE_LINUX_DEFAULT"
        fi
    fi

elif [ "$PKG_MANAGER" = "apk" ]; then
    echo "Installing Java (JDK 11)..."
    apk add --no-cache openjdk11
    
    echo "Installing Python 3..."
    apk add --no-cache python3
    
    echo "Installing nsjail..."
    # nsjail might not be in standard Alpine repos, check
    if ! apk add --no-cache nsjail 2>/dev/null; then
        echo "nsjail not in apk repos, building from source..."
        
        # Install build dependencies
        apk add --no-cache \
            git \
            protobuf \
            libprotobuf-dev \
            libnl3-dev \
            iptables-dev \
            pkgconf \
            g++ \
            make
        
        # Clone and build nsjail
        NSJAIL_TMP=$(mktemp -d)
        git clone --depth 1 https://github.com/google/nsjail.git "$NSJAIL_TMP"
        cd "$NSJAIL_TMP"
        make -j$(nproc)
        make install
        cd -
        rm -rf "$NSJAIL_TMP"
        
        echo "nsjail installed from source"
    else
        echo "nsjail installed from apk"
    fi
fi

# Verify installation
echo ""
echo "========================================"
echo "  Verifying Installation"
echo "========================================"

echo "Checking Java..."
java -version 2>&1 | head -1

echo "Checking Python..."
python3 --version

echo "Checking nsjail..."
nsjail --version

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Environment variables to set in .env:"
echo ""
echo "  NSJAIL_PATH=/usr/bin/nsjail"
echo "  NSJAIL_CONFIG_DIR=./apps/server/config"
echo "  NSJAIL_WORKSPACE_DIR=./temp/nsjail-workspace"
echo "  JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64"
echo "  PYTHON_BIN=/usr/bin/python3"
echo "  NSJAIL_MAX_CONCURRENT=4"
echo "  NSJAIL_MEMORY_LIMIT_MB=512"
echo "  RUN_TIMEOUT=5000"
echo "  COMPILE_TIMEOUT=10000"
echo ""
echo "Create the workspace directory:"
echo "  mkdir -p ./temp/nsjail-workspace"
echo ""
