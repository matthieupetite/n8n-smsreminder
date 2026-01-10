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

# Create the package directory structure
mkdir -p /.n8n/custom

# Copy the entire built package (not just dist)
cp -R ./dist /.n8n/custom/
cp package.json /.n8n/custom/
cp index.js /.n8n/custom/ 2>/dev/null || echo "No index.js found, skipping"

# Initialize npm in the custom directory and install the package
cd /.n8n/custom

# Install only production dependencies that n8n might need
if [ -f package.json ]; then
    npm install --omit=dev --ignore-scripts
fi

# Set proper permissions for n8n user (UID 1000)
chown -R 1000:1000 /.n8n/custom/

echo "Custom nodes built successfully!"
ls -la /.n8n/custom/
echo "Dist contents:"
ls -la /.n8n/custom/dist/

