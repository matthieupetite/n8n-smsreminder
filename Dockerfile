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
RUN npm run build:clean

# Create the /.n8n/custom directory
RUN mkdir -p /home/node/.n8n/custom

# Make the build script executable
RUN chmod +x /usr/src/app/scripts/buildScript.sh

# Set /.n8n/custom as a volume (this will be mounted by the main n8n container)
VOLUME ["/home/node/.n8n/custom"]

# Start the build and packaging script (exits when done)
CMD ["/bin/bash", "/usr/src/app/scripts/buildScript.sh"]
