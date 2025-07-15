# Use an official Node.js image as the base image
FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Build the TypeScript project
RUN npm run build

# Create the /.n8n/custom directory
RUN mkdir -p /.n8n/custom

# Copy the built files to the /.n8n/custom directory
RUN cp -r ./dist/* /.n8n/custom/
# Set /.n8n/custom as a volume
VOLUME ["/.n8n/custom"]
# Expose the default n8n port
RUN chmod +x /usr/src/app/scripts/buildScript.sh

# Start the n8n service
CMD ["/bin/bash", "-c", "/usr/src/app/scripts/buildScript.sh"]
