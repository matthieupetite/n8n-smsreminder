#!/bin/bash
# This script builds and packages custom nodes for n8n init container
set -e  # Exit immediately if a command exits with a non-zero status

echo "Building n8n custom nodes..."

# Clean the custom directory
rm -rf /home/node/.n8n/custom/*
rm -rf /home/node/.n8n/custom/.[!.]*

# Install dependencies and build
npm install
npm run build:clean

# Create the proper directory structure for N8N_CUSTOM_EXTENSIONS
# n8n expects this directory to contain installed npm packages
mkdir -p /home/node/.n8n/custom/
cd /home/node/.n8n/custom/

# Initialize as an npm project
npm init -y

# Create a tarball to force npm to copy files instead of symlinking
cd /usr/src/app
npm pack

# Install from the tarball (this copies files instead of creating symlinks)
cd /home/node/.n8n/custom/
npm install /usr/src/app/n8n-nodes-sms-reminder-*.tgz --production --no-package-lock

# Clean up the tarball
rm -f /usr/src/app/n8n-nodes-sms-reminder-*.tgz

# Verify installation
echo "\n=== Custom nodes installed ==="
ls -la /home/node/.n8n/custom/node_modules/
echo "\n=== Package contents ==="
ls -la /home/node/.n8n/custom/node_modules/n8n-nodes-sms-reminder/ || echo "Package not found!"

# Set proper permissions for n8n user (UID 1000)
chown -R 1000:1000 /home/node/.n8n/custom/

echo "\nCustom nodes ready for n8n!"

