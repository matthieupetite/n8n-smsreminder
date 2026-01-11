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
mkdir -p /home/node/.n8n/custom/node_modules/n8n-nodes-sms-reminder

# Manually copy the package files (avoids installing dependencies)
cp -R /usr/src/app/dist /home/node/.n8n/custom/node_modules/n8n-nodes-sms-reminder/
cp /usr/src/app/package.json /home/node/.n8n/custom/node_modules/n8n-nodes-sms-reminder/
cp /usr/src/app/index.js /home/node/.n8n/custom/node_modules/n8n-nodes-sms-reminder/ 2>/dev/null || true

# Create a minimal package.json in the custom directory
cat > /home/node/.n8n/custom/package.json <<EOF
{
  "name": "n8n-custom-extensions",
  "version": "1.0.0",
  "description": "Custom n8n nodes container",
  "private": true
}
EOF

# Verify installation
echo "\n=== Custom nodes installed ==="
ls -la /home/node/.n8n/custom/node_modules/
echo "\n=== Package contents ==="
ls -la /home/node/.n8n/custom/node_modules/n8n-nodes-sms-reminder/

# Set proper permissions for n8n user (UID 1000)
chown -R 1000:1000 /home/node/.n8n/custom/

echo "\nCustom nodes ready for n8n!"

