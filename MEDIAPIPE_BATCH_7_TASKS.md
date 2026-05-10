# MediaPipe Integration - BATCH 7: Deployment & Production Readiness

**Status**: READY TO START  
**Tasks**: 10 tasks  
**Focus**: Deployment, Testing, Optimization, Documentation

---

## 📦 BATCH 7: Deployment & Production Readiness (10 tasks)

### Task 7.1: Database Migration & Setup ✅
**Objective**: Ensure database schema is updated for MediaPipe

**Actions**:
- Run Prisma migration for MediaPipe fields
- Verify FacialRecognitionLog table has new fields
- Create indexes for performance
- Test migration rollback
- Backup production database before migration

**Commands**:
```bash
cd backend
npx prisma migrate dev --name add_mediapipe_fields
npx prisma generate
npx prisma migrate status
```

**Verification**:
- Check `faceEmbedding` field exists
- Check `detectionMethod` field exists
- Check `faceCount` field exists
- Verify indexes are created

---

### Task 7.2: MediaPipe Model Download & Verification ✅
**Objective**: Download and verify all required MediaPipe models

**Actions**:
- Run model download script
- Verify all 4 models downloaded
- Check file sizes match expected
- Test model loading
- Add model health check endpoint

**Commands**:
```bash
cd backend
# Windows
download-models.bat

# Unix/Linux/Mac
chmod +x download-models.sh
./download-models.sh
```

**Verification**:
- `face_detection_short_range.tflite` (~1MB)
- `face_landmarker.task` (~3MB)
- `pose_landmarker_lite.task` (~5MB)
- `hand_landmarker.task` (~8MB)
- Total: ~17MB

**Health Check**:
```bash
curl http://localhost:4000/api/mediapipe/health
```

---

### Task 7.3: Backend Environment Configuration ✅
**Objective**: Configure backend environment variables

**Actions**:
- Update `.env` file with MediaPipe settings
- Remove AWS Rekognition variables
- Add MediaPipe configuration
- Set performance thresholds
- Configure storage paths

**Environment Variables**:
```env
# MediaPipe Configuration
MEDIAPIPE_ENABLED=true
MEDIAPIPE_MODELS_PATH=./ml-models
MEDIAPIPE_FACE_DETECTION_THRESHOLD=0.7
MEDIAPIPE_FACE_COMPARISON_THRESHOLD=0.6
MEDIAPIPE_MULTIPLE_FACE_DURATION=2000
MEDIAPIPE_LOOKING_AWAY_THRESHOLD=45
MEDIAPIPE_LOOKING_AWAY_DURATION=3000

# AI Monitoring
AI_MONITORING_ENABLED=true
AI_FRAME_SAMPLING_RATE=3
AI_ALERT_COOLDOWN=5000

# Capture Settings
AUTO_CAPTURE_ENABLED=true
CAPTURE_QUALITY=85
CAPTURE_RETENTION_DAYS=30
PERIODIC_CAPTURE_INTERVAL=120000

# Remove AWS (if exists)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=
```

---

### Task 7.4: Frontend Environment Configuration ✅
**Objective**: Configure frontend environment variables

**Actions**:
- Update `.env.local` for development
- Create `.env.production` for production
- Configure API endpoints
- Set WebSocket URLs
- Configure feature flags

**Environment Variables**:
```env
# Development (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_MEDIAPIPE_ENABLED=true

# Production (.env.production)
NEXT_PUBLIC_API_URL=https://assessexpert.com/api
NEXT_PUBLIC_WS_URL=https://assessexpert.com
NEXT_PUBLIC_MEDIAPIPE_ENABLED=true
```

---

### Task 7.5: Integration Testing Suite ✅
**Objective**: Create comprehensive integration tests

**Actions**:
- Test face detection accuracy
- Test multiple face alerts
- Test behavior scoring
- Test auto-capture workflow
- Test WebSocket events
- Test API endpoints

**Test Scenarios**:

1. **Face Detection Test**
   - Upload test image with 1 face → Should detect 1 face
   - Upload test image with 2 faces → Should detect 2 faces
   - Upload test image with 0 faces → Should detect 0 faces

2. **Face Comparison Test**
   - Compare same person → Should return >0.6 similarity
   - Compare different people → Should return <0.4 similarity

3. **Multiple Face Alert Test**
   - Show 2 faces for 2+ seconds → Should trigger alert
   - Show 2 faces for <2 seconds → Should NOT trigger alert

4. **Behavior Score Test**
   - Start with score 100
   - Trigger multiple faces → Score should decrease by 15
   - Trigger face absent → Score should decrease by 20

5. **Auto-Capture Test**
   - Complete ID verification checklist → Should capture image
   - Wait 2 minutes during exam → Should capture periodic image
   - Trigger AI alert → Should capture event-triggered image

**Test Script**:
```bash
cd backend
npm run test:integration
```

---

### Task 7.6: Performance Optimization & Monitoring ✅
**Objective**: Optimize performance and add monitoring

**Actions**:
- Profile MediaPipe service performance
- Optimize frame processing rate
- Add performance metrics
- Setup monitoring dashboard
- Configure alerts for performance issues

**Performance Targets**:
- Face detection: <100ms
- Face comparison: <50ms
- Total frame processing: <200ms
- Memory per session: <60MB
- CPU per session: <12%

**Monitoring Endpoints**:
```typescript
GET /api/mediapipe/metrics
GET /api/mediapipe/health
GET /api/mediapipe/sessions/active
```

**Metrics to Track**:
- Average detection time
- Peak memory usage
- Active sessions count
- Alert frequency
- Capture count
- Error rate

---

### Task 7.7: Error Handling & Fallback Mechanisms ✅
**Objective**: Add robust error handling and fallbacks

**Actions**:
- Add try-catch blocks to all MediaPipe methods
- Implement graceful degradation
- Add fallback to basic face detection
- Log errors to monitoring system
- Add user-friendly error messages

**Error Scenarios**:

1. **Models Not Found**
   - Fallback: Disable AI monitoring, show warning
   - Action: Guide admin to download models

2. **Model Loading Failed**
   - Fallback: Retry 3 times, then disable
   - Action: Log error, notify admin

3. **Face Detection Failed**
   - Fallback: Skip frame, continue monitoring
   - Action: Log warning, continue

4. **WebSocket Disconnected**
   - Fallback: Queue alerts, reconnect
   - Action: Show connection status

5. **Storage Full**
   - Fallback: Stop captures, alert admin
   - Action: Clean old captures

**Error Handling Code**:
```typescript
try {
  const faces = await this.mediapipeService.detectFaces(image)
  // Process faces
} catch (error) {
  this.logger.error('Face detection failed', error)
  // Fallback: Continue without AI monitoring
  return { faces: [], error: 'Detection unavailable' }
}
```

---

### Task 7.8: Security & Privacy Compliance ✅
**Objective**: Ensure security and privacy compliance

**Actions**:
- Encrypt stored face embeddings
- Add data retention policies
- Implement GDPR compliance
- Add consent management
- Secure API endpoints

**Security Measures**:

1. **Data Encryption**
   - Encrypt face embeddings at rest
   - Use HTTPS for all API calls
   - Encrypt WebSocket connections

2. **Access Control**
   - Only proctors can view captures
   - Only admins can configure AI rules
   - Candidates cannot access their own captures

3. **Data Retention**
   - Delete captures after 30 days
   - Delete embeddings after session complete
   - Allow manual deletion by admin

4. **Privacy Compliance**
   - Add privacy notice to candidates
   - Get consent before face capture
   - Allow opt-out (with consequences)
   - Provide data export functionality

5. **Audit Logging**
   - Log all AI detections
   - Log all capture events
   - Log all proctor actions
   - Retain logs for 90 days

---

### Task 7.9: Documentation & Training Materials ✅
**Objective**: Create comprehensive documentation

**Actions**:
- Update API documentation
- Create admin setup guide
- Create proctor user guide
- Create troubleshooting guide
- Create video tutorials

**Documentation Files**:

1. **MEDIAPIPE_SETUP_GUIDE.md**
   - Installation instructions
   - Model download steps
   - Configuration guide
   - Troubleshooting

2. **MEDIAPIPE_API_DOCS.md**
   - All API endpoints
   - Request/response examples
   - WebSocket events
   - Error codes

3. **PROCTOR_AI_GUIDE.md**
   - How to use AI monitoring
   - Understanding alerts
   - Reviewing captures
   - Configuring rules

4. **ADMIN_CONFIGURATION.md**
   - Environment variables
   - AI rule configuration
   - Performance tuning
   - Monitoring setup

5. **TROUBLESHOOTING.md**
   - Common issues
   - Error messages
   - Performance problems
   - Model issues

---

### Task 7.10: Production Deployment ✅
**Objective**: Deploy to production server

**Actions**:
- Create deployment script
- Deploy backend to production
- Deploy frontend to production
- Run smoke tests
- Monitor for issues

**Deployment Steps**:

1. **Backup Production**
```bash
# Backup database
pg_dump assessexpert > backup_$(date +%Y%m%d).sql

# Backup code
git tag -a v2.0.0-mediapipe -m "MediaPipe integration"
git push origin v2.0.0-mediapipe
```

2. **Deploy Backend**
```bash
ssh root@assessexpert.com
cd /var/www/html/assessexpert/backend

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Download models
./download-models.sh

# Run migration
npx prisma migrate deploy
npx prisma generate

# Build
npm run build

# Restart
pm2 restart assessexpert-backend
pm2 logs assessexpert-backend --lines 50
```

3. **Deploy Frontend**
```bash
cd /var/www/html/assessexpert/frontend/portal

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart
pm2 restart assessexpert-frontend
pm2 logs assessexpert-frontend --lines 50
```

4. **Verify Deployment**
```bash
# Check backend health
curl https://assessexpert.com/api/mediapipe/health

# Check frontend
curl https://assessexpert.com

# Check WebSocket
# Open browser console and check WebSocket connection
```

5. **Smoke Tests**
- Login as proctor
- Start test session
- Verify AI monitoring panel appears
- Verify capture gallery appears
- Trigger test alert (show 2 faces)
- Verify alert appears in panel
- Verify toast notification appears
- Check capture gallery updates

6. **Monitor Production**
```bash
# Watch logs
pm2 logs assessexpert-backend --lines 100
pm2 logs assessexpert-frontend --lines 100

# Check metrics
curl https://assessexpert.com/api/mediapipe/metrics

# Check active sessions
curl https://assessexpert.com/api/mediapipe/sessions/active
```

---

## 📋 BATCH 7 CHECKLIST

### Pre-Deployment
- [ ] Task 7.1: Database migration complete
- [ ] Task 7.2: Models downloaded and verified
- [ ] Task 7.3: Backend environment configured
- [ ] Task 7.4: Frontend environment configured
- [ ] Task 7.5: Integration tests passing
- [ ] Task 7.6: Performance metrics acceptable
- [ ] Task 7.7: Error handling tested
- [ ] Task 7.8: Security review complete
- [ ] Task 7.9: Documentation complete

### Deployment
- [ ] Task 7.10: Production backup created
- [ ] Task 7.10: Backend deployed
- [ ] Task 7.10: Frontend deployed
- [ ] Task 7.10: Smoke tests passing
- [ ] Task 7.10: Monitoring active

### Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Check error logs
- [ ] Verify performance metrics
- [ ] Gather user feedback
- [ ] Create incident response plan

---

## 🚀 DEPLOYMENT SCRIPT

Create `deploy-mediapipe.sh`:

```bash
#!/bin/bash

echo "🚀 Starting MediaPipe Deployment..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Check if on production server
if [ "$HOSTNAME" != "assessexpert.com" ]; then
  echo -e "${RED}❌ Not on production server${NC}"
  exit 1
fi

# Backup database
echo "📦 Backing up database..."
pg_dump assessexpert > backup_$(date +%Y%m%d_%H%M%S).sql
echo -e "${GREEN}✅ Database backed up${NC}"

# Backend deployment
echo "🔧 Deploying backend..."
cd /var/www/html/assessexpert/backend
git pull origin main
npm install
./download-models.sh
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart assessexpert-backend
echo -e "${GREEN}✅ Backend deployed${NC}"

# Frontend deployment
echo "🎨 Deploying frontend..."
cd /var/www/html/assessexpert/frontend/portal
git pull origin main
npm install
npm run build
pm2 restart assessexpert-frontend
echo -e "${GREEN}✅ Frontend deployed${NC}"

# Health checks
echo "🏥 Running health checks..."
sleep 5

# Check backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/mediapipe/health)
if [ "$BACKEND_STATUS" == "200" ]; then
  echo -e "${GREEN}✅ Backend health check passed${NC}"
else
  echo -e "${RED}❌ Backend health check failed (Status: $BACKEND_STATUS)${NC}"
  exit 1
fi

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3005)
if [ "$FRONTEND_STATUS" == "200" ]; then
  echo -e "${GREEN}✅ Frontend health check passed${NC}"
else
  echo -e "${RED}❌ Frontend health check failed (Status: $FRONTEND_STATUS)${NC}"
  exit 1
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo "📊 Monitor logs with: pm2 logs"
echo "📈 Check metrics at: https://assessexpert.com/api/mediapipe/metrics"
```

---

## 📊 SUCCESS CRITERIA

### Performance
- ✅ Face detection: <100ms
- ✅ Face comparison: <50ms
- ✅ Alert latency: <500ms
- ✅ Memory per session: <60MB
- ✅ CPU per session: <12%

### Reliability
- ✅ Uptime: >99.9%
- ✅ Error rate: <0.1%
- ✅ False positive rate: <5%
- ✅ False negative rate: <1%

### User Experience
- ✅ Proctor satisfaction: >4/5
- ✅ Candidate experience: >4/5
- ✅ Alert response time: <2 seconds
- ✅ UI responsiveness: <100ms

### Business
- ✅ Cost savings: 100% (vs AWS)
- ✅ Concurrent sessions: 50+
- ✅ Zero AWS dependencies
- ✅ GDPR compliant

---

## 🎯 ROLLBACK PLAN

If deployment fails:

```bash
# Rollback backend
cd /var/www/html/assessexpert/backend
git checkout <previous-commit>
npm install
npm run build
pm2 restart assessexpert-backend

# Rollback frontend
cd /var/www/html/assessexpert/frontend/portal
git checkout <previous-commit>
npm install
npm run build
pm2 restart assessexpert-frontend

# Rollback database
psql assessexpert < backup_YYYYMMDD_HHMMSS.sql
```

---

## 📞 SUPPORT & ESCALATION

### Issues During Deployment
1. Check logs: `pm2 logs`
2. Check health: `curl /api/mediapipe/health`
3. Check metrics: `curl /api/mediapipe/metrics`
4. Rollback if critical

### Post-Deployment Issues
1. Monitor error rate
2. Check user reports
3. Review performance metrics
4. Apply hotfixes if needed

---

## ✅ BATCH 7 COMPLETION

Once all 10 tasks are complete:
- ✅ MediaPipe fully deployed to production
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Monitoring active
- ✅ Team trained

**BATCH 7 STATUS**: READY TO START

---

**Next Steps**: Execute tasks 7.1 through 7.10 sequentially
