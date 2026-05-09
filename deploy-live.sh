#!/bin/bash

# AssessExpert Live Server Deployment Script
# Run this on the live server after pushing changes to GitHub

echo "=========================================="
echo "AssessExpert Deployment Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

# Navigate to project directory
cd /var/www/html/assessexpert || { echo -e "${RED}Project directory not found${NC}"; exit 1; }

echo -e "${YELLOW}Step 1: Pulling latest code from GitHub...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
  echo -e "${RED}Git pull failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

echo -e "${YELLOW}Step 2: Updating backend...${NC}"
cd backend
npm install
if [ $? -ne 0 ]; then
  echo -e "${RED}Backend npm install failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Run migrations if needed
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"

pm2 restart assessexpert-backend
if [ $? -ne 0 ]; then
  echo -e "${RED}Backend restart failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Backend restarted${NC}"
echo ""

echo -e "${YELLOW}Step 3: Updating frontend...${NC}"
cd ../frontend/portal
npm install
if [ $? -ne 0 ]; then
  echo -e "${RED}Frontend npm install failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}Frontend build failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Frontend built${NC}"

pm2 restart assessexpert-frontend
if [ $? -ne 0 ]; then
  echo -e "${RED}Frontend restart failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Frontend restarted${NC}"
echo ""

echo -e "${YELLOW}Step 4: Checking service status...${NC}"
pm2 status
echo ""

echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Services:"
echo "  - Backend:  https://assessexpert.com/api"
echo "  - Frontend: https://assessexpert.com"
echo ""
echo "To view logs:"
echo "  pm2 logs assessexpert-backend --lines 50"
echo "  pm2 logs assessexpert-frontend --lines 50"
echo ""
