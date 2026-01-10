#!/bin/bash
# This script builds and packages custom nodes for n8n init container
set -e  # Exit immediately if a command exits with a non-zero status

echo "Building n8n custom nodes..."

# Clean the custom directory
rm -rf /.n8n/custom/*
rm -rf /.n8n/custom/.[!.]*

# Install dependencies and build
npm install
npm run build:clean

# Create the proper directory structure for N8N_CUSTOM_EXTENSIONS
# n8n expects this directory to contain installed npm packages
mkdir -p /.n8n/custom
cd /.n8n/custom

# Initialize as an npm project
npm init -y

# Install the custom nodes package from the build directory
npm install /usr/src/app --production --no-package-lock

# Verify installation
echo "\n=== Custom nodes installed ==="
ls -la /.n8n/custom/node_modules/
echo "\n=== Package contents ==="
ls -la /.n8n/custom/node_modules/n8n-nodes-sms-reminder/ || echo "Package not found!"

# Set proper permissions for n8n user (UID 1000)
chown -R 1000:1000 /.n8n/custom/

echo "\nCustom nodes ready for n8n!"

