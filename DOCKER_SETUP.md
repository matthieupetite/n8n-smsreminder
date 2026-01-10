# N8N_CUSTOM_EXTENSIONS Configuration Guide

## What is N8N_CUSTOM_EXTENSIONS?

`N8N_CUSTOM_EXTENSIONS` is an environment variable that tells n8n where to find custom node packages. It should point to a directory containing **installed npm packages** (with a `node_modules` folder).

## How It Works

```
N8N_CUSTOM_EXTENSIONS=/data/custom
```

n8n will look for custom nodes in:

```
/data/custom/node_modules/
├── n8n-nodes-sms-reminder/
│   ├── dist/
│   │   ├── nodes/
│   │   └── credentials/
│   └── package.json  (with "n8n" field)
└── other-custom-packages/
```

## Directory Structure Requirements

The directory MUST contain:

1. ✅ A `package.json` file
2. ✅ A `node_modules/` folder with installed packages
3. ✅ Each package must have the `"n8n"` section in its package.json

## Current Setup Explained

### Init Container (builds nodes)

```yaml
custom-nodes-builder:
  volumes:
    - n8n_custom:/.n8n/custom # Writes to shared volume
```

**What it does:**

1. Builds your TypeScript nodes
2. Runs `npm install /usr/src/app` inside `/.n8n/custom/`
3. This creates: `/.n8n/custom/node_modules/n8n-nodes-sms-reminder/`

### Main n8n Container

```yaml
n8n:
  environment:
    - N8N_CUSTOM_EXTENSIONS=/data/custom
  volumes:
    - n8n_custom:/data/custom:ro # Reads from shared volume
```

**What it does:**

1. Mounts the volume to `/data/custom`
2. Scans `/data/custom/node_modules/` for packages
3. Loads any package with an `"n8n"` section in package.json

## Alternative Configurations

### Option 1: Multiple Custom Node Packages

```yaml
environment:
  # Comma-separated list of directories
  - N8N_CUSTOM_EXTENSIONS=/data/custom1,/data/custom2,/data/custom3
```

### Option 2: Direct Package Directory

If you want to point directly to a single package:

```bash
# Build script would copy to:
cp -R /usr/src/app /.n8n/custom/n8n-nodes-sms-reminder/

# Then configure:
N8N_CUSTOM_EXTENSIONS=/.n8n/custom/n8n-nodes-sms-reminder
```

### Option 3: Local Development (without Docker)

```bash
# Install in user's home directory
cd ~/.n8n/nodes
npm install /path/to/your/package

# n8n automatically checks ~/.n8n/nodes/ (no env var needed)
```

## Verifying the Setup

### Check if nodes are loaded:

```bash
# Enter the n8n container
docker exec -it n8n sh

# Check if the directory exists
ls -la /data/custom/node_modules/

# Check n8n logs
docker logs n8n | grep -i "custom\|nodes-sms"
```

### Common Issues:

**❌ "not a constructor" error**

- Package.json is missing or malformed
- The `"n8n"` section doesn't point to valid node files

**❌ Nodes not appearing**

- Wrong path in `N8N_CUSTOM_EXTENSIONS`
- Volume not mounted correctly
- Permissions issue (should be owned by UID 1000)

**❌ Permission denied**

- Run `chown -R 1000:1000` on the volume directory

## Testing Your Setup

```bash
# 1. Build and start
docker-compose up -d

# 2. Check init container finished successfully
docker logs n8n-custom-nodes-builder

# 3. Check n8n loaded the nodes
docker logs n8n | grep -A5 "Loading custom nodes"

# 4. Access n8n
open http://localhost:5678

# 5. Search for "SMS" in the node panel
```

## Environment Variables Summary

```yaml
environment:
  # Where to find custom nodes (REQUIRED for custom extensions)
  - N8N_CUSTOM_EXTENSIONS=/data/custom

  # Security settings
  - N8N_BASIC_AUTH_ACTIVE=true
  - N8N_BASIC_AUTH_USER=admin
  - N8N_BASIC_AUTH_PASSWORD=your-secure-password

  # Performance settings
  - DB_SQLITE_POOL_SIZE=3
  - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true

  # Optional: If you need multiple directories
  # - N8N_CUSTOM_EXTENSIONS=/data/custom1,/data/custom2
```

## Rebuild After Changes

When you update your nodes:

```bash
# Stop everything
docker-compose down

# Remove the custom volume
docker volume rm n8n_custom

# Rebuild and restart
docker-compose up -d --build

# Or just rebuild the init container
docker-compose up -d --build custom-nodes-builder
docker-compose restart n8n
```
