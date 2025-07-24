#!/bin/bash
set -e

# Variables
CUSTOM_DIR="/.n8n/custom"
MODULE_NAME="n8n-nodes-sms-reminder"
MODULE_PATH="$CUSTOM_DIR/node_modules/$MODULE_NAME"
SRC_DIR="/usr/src/app"

# Ensure user with UID 1000 has rw access to /.n8n
chown -R 1000:1000 /.n8n
chmod -R u+rw /.n8n

# Create the custom directory if it does not exist
mkdir -p "$CUSTOM_DIR"

# Clean only the target module folder
rm -rf "$MODULE_PATH"

# Ensure /.n8n/custom has a package.json
if [ ! -f "$CUSTOM_DIR/package.json" ]; then
	cd "$CUSTOM_DIR"
	npm init -y
fi

# Copy the entire custom node source code into the custom node_modules folder
mkdir -p "$MODULE_PATH"
cp -R "$SRC_DIR/"* "$MODULE_PATH/"

# Install dependencies in /.n8n/custom
cd "$CUSTOM_DIR"
npm install

# Optionally, build from within the custom folder if needed
npm run build || true




