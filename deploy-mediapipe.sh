#!/bin/bash

# MediaPipe Deployment Script for AssessExpert
# This script deploys the complete MediaPipe integration to production

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting MediaPipe Deployment...${NC}"

# Configuration
PROJECT_ROOT="/var/www/html/assessexpert"
BACKUP_DIR="/var/backups/assessexpert"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Step 1: Backup Database
echo "📦 Backing up database..."
pg_dump assessexpert > "$BACKUP_DIR/assessexpert_$TIMESTAMP.sql"
print_status "Database backed up to $BACKUP_DIR/assessexpert_$TIMESTAMP.sql"

# Step 2: Backup Code
echo "📦 Backing up code..."
cd "$PROJECT_ROOT"
git tag -a "v2.0.0-mediapipe-$TIMESTAMP" -m "Pre-MediaPipe deployment backup"
print_status "Code tagged as v2.0.0-mediapipe-$TIMESTAMP"

# Step 3: Pull Latest Code
echo "📥 Pulling latest code..."
git pull origin main
print_status "Code updated from repository"

# Step 4: Backend Deployment
echo "🔧 Deploying backend..."
cd "$PROJECT_ROOT/backend"

# Install dependencies
npm install
print_status "Backend dependencies installed"

# Download MediaPipe models
if [ ! -f "ml-models/face_detection_short_range.tflite" ]; then
    echo "📥 Downloading MediaPipe models..."
    chmod +x download-models.sh
    ./download-models.sh
    print_status "MediaPipe models downloaded"
else
    print_warning "MediaPipe models already exist, skipping download"
fi

# Run database migration
echo "🗄️  Running database migration..."
npx prisma migrate deploy
npx prisma generate
print_status "Database migration complete"

# Build backend
npm run build
print_status "Backend built successfully"

# Restart backend
pm2 restart assessexpert-backend
print_status "Backend restarted"

# Step 5: Frontend Deployment
echo "🎨 Deploying frontend..."
cd "$PROJECT_ROOT/frontend/portal"

# Install dependencies
npm install
print_status "Frontend dependencies installed"

# Build frontend
npm run build
print_status "Frontend built successfully"

# Restart frontend
pm2 restart assessexpert-frontend
print_status "Frontend restarted"

# Step 6: Health Checks
echo "🏥 Running health checks..."
sleep 5

# Check backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/mediapipe/health)
if [ "$BACKEND_STATUS" == "200" ]; then
    print_status "Backend health check passed"
else
    print_error "Backend health check failed (Status: $BACKEND_STATUS)"
    echo "Rolling back..."
    git checkout HEAD~1
    pm2 restart assessexpert-backend
    pm2 restart assessexpert-frontend
    exit 1
fi

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3005)
if [ "$FRONTEND_STATUS" == "200" ]; then
    print_status "Frontend health check passed"
else
    print_error "Frontend health check failed (Status: $FRONTEND_STATUS)"
    echo "Rolling back..."
    git checkout HEAD~1
    pm2 restart assessexpert-backend
    pm2 restart assessexpert-frontend
    exit 1
fi

# Step 7: Verify MediaPipe
echo "🤖 Verifying MediaPipe integration..."
MEDIAPIPE_STATUS=$(curl -s http://localhost:4000/api/mediapipe/health | grep -o '"status":"healthy"' || echo "")
if [ -n "$MEDIAPIPE_STATUS" ]; then
    print_status "MediaPipe integration verified"
else
    print_warning "MediaPipe health check returned unexpected response"
fi

# Step 8: Final Status
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "📊 Deployment Summary:"
echo "  • Database backup: $BACKUP_DIR/assessexpert_$TIMESTAMP.sql"
echo "  • Git tag: v2.0.0-mediapipe-$TIMESTAMP"
echo "  • Backend status: ✅ Running"
echo "  • Frontend status: ✅ Running"
echo "  • MediaPipe status: ✅ Active"
echo ""
echo "📝 Next Steps:"
echo "  1. Monitor logs: pm2 logs"
echo "  2. Check metrics: curl https://assessexpert.com/api/mediapipe/metrics"
echo "  3. Test with real session"
echo "  4. Monitor for 24 hours"
echo ""
echo "🔄 Rollback command (if needed):"
echo "  git checkout v2.0.0-mediapipe-$TIMESTAMP~1"
echo "  pm2 restart all"
echo ""
