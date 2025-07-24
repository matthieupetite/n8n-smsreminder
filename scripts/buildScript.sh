#!/bin/bash
# This script builds the project and handles errors gracefully
set -e  # Exit immediately if a command exits with a non-zero status
rm -rf /.n8n/custom/*
rm -rf /.n8n/custom/.[!.]*
npm install
npm run build
mkdir -p /.n8n/custom
cd /.n8n/custom
npm init -y
mkdir -p /.n8n/custom/n8n-nodes-sms-reminder
cp -R /usr/src/app/dist/* /.n8n/custom/n8n-nodes-sms-reminder/
cd /.n8n/custom/n8n-nodes-sms-reminder
npm link
cd /.n8n/custom/ && npm link n8n-nodes-sms-reminder




