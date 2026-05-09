#!/bin/bash

# Quick Fix for Chunk Load Error on Live Server

echo "Fixing chunk load error on assessexpert.com..."

cd /var/www/html/assessexpert/frontend/portal

# Clear Next.js cache
echo "Clearing Next.js cache..."
rm -rf .next

# Reinstall dependencies
echo "Reinstalling dependencies..."
npm install

# Rebuild
echo "Building frontend..."
npm run build

# Restart
echo "Restarting frontend..."
pm2 restart assessexpert-frontend

echo "Done! Check https://assessexpert.com/proctor/sessions"
