# Google MediaPipe Integration - Task Breakdown

## Overview
Replace AWS Rekognition with Google MediaPipe for AI-based exam monitoring including facial recognition, multiple face detection, pose detection, and automated capture during verification.

**Repository**: https://github.com/google-ai-edge/mediapipe

## Current System Analysis

### Existing AWS Rekognition Implementation
- **File**: `backend/src/modules/facial-recognition/facial-recognition.service.ts`
- **Features**:
  - Face comparison (ID verification)
  - Pre-exam identity check
  - Periodic face verification during exam
  - Similarity scoring (90%+ verified, 70-90% review, <70% rejected)
  - Image storage and logging

### Existing Proctoring System
- **File**: `backend/src/modules/proctoring/proctoring.service.ts`
- **Features**:
  - Event logging (AI flags, warnings, critical events)
  - Integrity score calculation
  - Proctor warnings and flag review

## MediaPipe Capabilities to Implement

1. **Face Detection** - Detect faces in video frames
2. **Face Landmark Detection** - 468 facial landmarks for identity verification
3. **Face Recognition** - Compare face embeddings for identity matching
4. **Multiple Face Detection** - Alert when >1 face detected
5. **Pose Detection** - Detect body posture (looking away, standing up)
6. **Hand Detection** - Detect hands near face (phone usage)
7. **Object Detection** - Detect unauthorized objects (phones, books)
8. **Gaze Tracking** - Detect eye movement and looking away

---

## TASK BREAKDOWN (48 TASKS - 6 BATCHES)

### 📦 BATCH 1: MediaPipe Setup & Infrastructure (8 tasks)

#### Task 1.1: Install MediaPipe Dependencies
- Install `@mediapipe/tasks-vision` npm package
- Install `@mediapipe/face_detection`
- Install `@mediapipe/face_mesh`
- Install `@mediapipe/pose`
- Install `@mediapipe/hands`
- Install `canvas` for Node.js image processing
- Update `package.json` with all dependencies

#### Task 1.2: Download MediaPipe Models
- Create `backend/ml-models/` directory
- Download face detection model (blaze_face_short_range.tflite)
- Download face landmark model (face_landmarker.task)
- Download pose detection model (pose_landmarker.task)
- Download hand detection model (hand_landmarker.task)
- Create model loader utility
- Add models to `.gitignore` (large files)

#### Task 1.3: Create MediaPipe Service Module
- Create `backend/src/modules/mediapipe/` directory
- Create `mediapipe.module.ts`
- Create `mediapipe.service.ts` with base structure
- Create `mediapipe.controller.ts`
- Register module in `app.module.ts`
- Create DTOs for request/response

#### Task 1.4: Implement Face Detection Service
- Create `detectFaces()` method
- Accept base64 image input
- Return array of detected faces with bounding boxes
- Return confidence scores
- Handle multiple faces detection
- Add error handling

#### Task 1.5: Implement Face Landmark Extraction
- Create `extractFaceLandmarks()` method
- Extract 468 facial landmarks
- Generate face embedding vector
- Normalize embedding for comparison
- Return landmark coordinates and embedding
- Cache embeddings for performance

#### Task 1.6: Implement Face Comparison Logic
- Create `compareFaceEmbeddings()` method
- Calculate cosine similarity between embeddings
- Set thresholds (>0.6 verified, 0.4-0.6 review, <0.4 rejected)
- Return similarity score and outcome
- Add confidence level calculation

#### Task 1.7: Create Image Processing Utilities
- Create `utils/image-processor.ts`
- Base64 to Buffer conversion
- Image resizing for optimal processing
- Image quality validation
- Format conversion (JPEG, PNG)
- Compression utilities

#### Task 1.8: Setup Model Caching & Performance
- Implement model singleton pattern
- Lazy load models on first use
- Cache loaded models in memory
- Add warmup function for faster first detection
- Monitor memory usage
- Add performance logging

---

### 📦 BATCH 2: Replace Facial Recognition Module (8 tasks)

#### Task 2.1: Update Facial Recognition Service
- Replace AWS Rekognition with MediaPipe in `facial-recognition.service.ts`
- Update `compareFaces()` to use MediaPipe
- Keep same interface for backward compatibility
- Update similarity thresholds
- Add fallback for missing models

#### Task 2.2: Update Pre-Exam ID Verification
- Modify `runPreExamCheck()` method
- Use MediaPipe for face comparison
- Store face embeddings in database
- Save reference embedding for periodic checks
- Update logging with MediaPipe metadata

#### Task 2.3: Update Periodic Face Verification
- Modify `runPeriodicCheck()` method
- Compare against stored reference embedding
- Optimize for real-time processing
- Add frame skipping (check every 5 seconds)
- Update event logging

#### Task 2.4: Create Face Embedding Storage
- Add `faceEmbedding` field to database schema
- Create migration for new field
- Store embedding as JSON array
- Index for fast retrieval
- Add embedding versioning

#### Task 2.5: Update Controller Endpoints
- Keep existing API endpoints unchanged
- Update request/response types
- Add new MediaPipe-specific endpoints
- Add health check endpoint
- Update API documentation

#### Task 2.6: Remove AWS Dependencies
- Remove AWS SDK from `package.json`
- Remove AWS configuration from `.env`
- Remove AWS credential checks
- Update error messages
- Clean up unused imports

#### Task 2.7: Add Unit Tests
- Test face detection accuracy
- Test face comparison logic
- Test embedding generation
- Test error handling
- Mock MediaPipe models for testing

#### Task 2.8: Update Documentation
- Document MediaPipe setup process
- Document model download instructions
- Update API documentation
- Add troubleshooting guide
- Create performance benchmarks

---

### 📦 BATCH 3: Multiple Face Detection & Alerts (8 tasks)

#### Task 3.1: Implement Real-Time Face Counting
- Create `countFaces()` method in MediaPipe service
- Process video frames from candidate camera
- Return number of faces detected
- Add confidence threshold filtering
- Optimize for real-time performance

#### Task 3.2: Create Multiple Face Alert System
- Detect when >1 face appears
- Generate AI flag event
- Set severity to CRITICAL
- Include screenshot with bounding boxes
- Send real-time alert to proctor

#### Task 3.3: Implement Face Tracking
- Track face IDs across frames
- Detect when new face enters frame
- Detect when face leaves frame
- Calculate duration of multiple faces
- Store tracking data in events

#### Task 3.4: Add Bounding Box Visualization
- Draw rectangles around detected faces
- Add face count overlay
- Color code by confidence (green/yellow/red)
- Save annotated screenshots
- Send to proctor dashboard

#### Task 3.5: Configure Alert Thresholds
- Set minimum duration for alert (2 seconds)
- Set confidence threshold (>0.7)
- Add cooldown period between alerts
- Make thresholds configurable per assessment
- Store in database settings

#### Task 3.6: Integrate with WebSocket Gateway
- Emit `ai.multiple_faces` event
- Send to proctor in real-time
- Include face count and screenshot
- Update candidate status indicator
- Add to notification queue

#### Task 3.7: Update Proctoring Service
- Add `MULTIPLE_FACES` event type
- Log to `sessionEvent` table
- Update integrity score calculation
- Add to proctor review queue
- Generate report entry

#### Task 3.8: Create Proctor UI Alert Component
- Show real-time multiple face alert
- Display annotated screenshot
- Add "Review" and "Dismiss" buttons
- Show alert history
- Add sound notification

---

### 📦 BATCH 4: Advanced AI Monitoring (8 tasks)

#### Task 4.1: Implement Pose Detection
- Create `detectPose()` method
- Detect body landmarks (33 points)
- Identify sitting/standing posture
- Detect head orientation
- Calculate confidence scores

#### Task 4.2: Detect Looking Away Behavior
- Analyze head pose angles
- Detect when candidate looks away from screen
- Set threshold (>45° for 3+ seconds)
- Generate AI flag event
- Track frequency and duration

#### Task 4.3: Implement Hand Detection
- Create `detectHands()` method
- Detect hands near face
- Identify phone-holding gesture
- Detect writing/typing motions
- Generate alerts for suspicious behavior

#### Task 4.4: Detect Absence from Frame
- Monitor face presence in frame
- Detect when candidate leaves camera view
- Set timeout threshold (5 seconds)
- Generate CRITICAL alert
- Pause exam automatically

#### Task 4.5: Implement Gaze Tracking
- Extract eye landmarks from face mesh
- Calculate gaze direction vector
- Detect looking at secondary screen
- Track eye movement patterns
- Generate alerts for suspicious gaze

#### Task 4.6: Create Behavior Pattern Analysis
- Track frequency of suspicious events
- Calculate behavior score
- Identify patterns (repeated looking away)
- Generate summary reports
- Update integrity score

#### Task 4.7: Add Configurable AI Rules
- Create `aiRules` table in database
- Define rules per assessment type
- Enable/disable specific detections
- Set custom thresholds
- Allow proctor override

#### Task 4.8: Optimize Processing Pipeline
- Implement frame sampling (process every 3rd frame)
- Use Web Workers for parallel processing
- Add GPU acceleration support
- Monitor CPU/memory usage
- Add performance metrics

---

### 📦 BATCH 5: Automated Capture & Verification (8 tasks)

#### Task 5.1: Implement Auto-Capture on ID Verification
- Capture frame when ID shown to camera
- Detect ID card in frame
- Extract face from ID photo
- Store both ID and live capture
- Trigger automatic comparison

#### Task 5.2: Create ID Document Detection
- Detect rectangular objects (ID cards)
- Identify document corners
- Validate document is in focus
- Check for glare/reflections
- Guide candidate for better positioning

#### Task 5.3: Implement Face Extraction from ID
- Detect face region on ID card
- Crop and enhance face image
- Normalize lighting and contrast
- Resize to standard dimensions
- Store as reference image

#### Task 5.4: Auto-Capture During Checklist
- Capture at specific checklist steps
- Capture when "Show ID" step active
- Capture after environment scan
- Capture before exam starts
- Store with checklist item reference

#### Task 5.5: Implement Periodic Auto-Capture
- Capture every 2 minutes during exam
- Capture on suspicious AI events
- Capture on proctor request
- Store with timestamp and context
- Compress and optimize storage

#### Task 5.6: Create Capture Quality Validation
- Check image brightness
- Check image sharpness
- Detect motion blur
- Validate face visibility
- Retry if quality insufficient

#### Task 5.7: Build Capture Gallery UI
- Show all captures for session
- Display capture timeline
- Show verification results
- Allow proctor to review
- Add manual capture button

#### Task 5.8: Implement Capture Storage & Cleanup
- Store captures in organized folders
- Compress images for storage
- Auto-delete after retention period (30 days)
- Generate thumbnails
- Add metadata (timestamp, event type)

---

### 📦 BATCH 6: Frontend Integration & Testing (8 tasks)

#### Task 6.1: Create MediaPipe Client Hook
- Create `useMediaPipe` hook in frontend
- Load MediaPipe models in browser
- Process video frames client-side
- Send results to backend
- Handle errors gracefully

#### Task 6.2: Implement Client-Side Face Detection
- Run face detection in candidate browser
- Show face detection feedback
- Guide candidate for proper positioning
- Show face count indicator
- Display confidence level

#### Task 6.3: Add Visual Feedback for Candidate
- Show green border when face detected
- Show red border for multiple faces
- Display "Face not detected" warning
- Show "Looking away" indicator
- Add positioning guides

#### Task 6.4: Update Proctor Dashboard
- Add AI monitoring panel
- Show real-time AI alerts
- Display face detection status
- Show behavior score
- Add alert history

#### Task 6.5: Create AI Settings Panel
- Allow proctor to configure AI rules
- Enable/disable specific detections
- Adjust sensitivity thresholds
- Set alert preferences
- Save per-assessment settings

#### Task 6.6: Implement Alert Notification System
- Show toast notifications for AI alerts
- Play sound for critical alerts
- Show badge count on alerts
- Add alert filtering
- Mark alerts as reviewed

#### Task 6.7: Add Capture Review Interface
- Show capture gallery in proctor view
- Display verification results
- Allow manual verification override
- Add notes to captures
- Export captures for reports

#### Task 6.8: End-to-End Testing
- Test face detection accuracy
- Test multiple face alerts
- Test pose detection
- Test auto-capture workflow
- Test performance under load
- Test with different lighting conditions
- Test with different camera qualities
- Generate test report

---

## BATCH SUMMARY

| Batch | Tasks | Focus Area | Estimated Complexity |
|-------|-------|------------|---------------------|
| BATCH 1 | 8 | MediaPipe Setup & Infrastructure | Medium |
| BATCH 2 | 8 | Replace Facial Recognition Module | Medium |
| BATCH 3 | 8 | Multiple Face Detection & Alerts | High |
| BATCH 4 | 8 | Advanced AI Monitoring | High |
| BATCH 5 | 8 | Automated Capture & Verification | Medium |
| BATCH 6 | 8 | Frontend Integration & Testing | High |
| **TOTAL** | **48** | **Complete MediaPipe Integration** | **High** |

---

## DEPENDENCIES & PREREQUISITES

### Backend Dependencies
```json
{
  "@mediapipe/tasks-vision": "^0.10.8",
  "@mediapipe/face_detection": "^0.4.1646425229",
  "@mediapipe/face_mesh": "^0.4.1633559619",
  "@mediapipe/pose": "^0.5.1675469404",
  "@mediapipe/hands": "^0.4.1646424915",
  "canvas": "^2.11.2",
  "@tensorflow/tfjs-node": "^4.11.0"
}
```

### Frontend Dependencies
```json
{
  "@mediapipe/tasks-vision": "^0.10.8",
  "@mediapipe/camera_utils": "^0.3.1620248357",
  "@mediapipe/drawing_utils": "^0.3.1620248257"
}
```

### Model Files (Download Required)
- `face_detection_short_range.tflite` (~1MB)
- `face_landmarker.task` (~3MB)
- `pose_landmarker_lite.task` (~5MB)
- `hand_landmarker.task` (~8MB)

### Database Schema Updates
```prisma
model FacialRecognitionLog {
  // Add new fields
  faceEmbedding    Json?
  landmarkData     Json?
  detectionMethod  String @default("MEDIAPIPE")
  faceCount        Int?
  poseData         Json?
}

model AIRule {
  id               String @id @default(cuid())
  assessmentTypeId String?
  ruleType         String // MULTIPLE_FACES, LOOKING_AWAY, etc.
  enabled          Boolean @default(true)
  threshold        Float
  duration         Int // seconds
  severity         String // WARNING, CRITICAL
  createdAt        DateTime @default(now())
}
```

---

## PERFORMANCE TARGETS

- **Face Detection**: <100ms per frame
- **Face Comparison**: <200ms per comparison
- **Multiple Face Alert**: <500ms from detection to proctor
- **Pose Detection**: <150ms per frame
- **Memory Usage**: <500MB per session
- **CPU Usage**: <30% average per session

---

## TESTING STRATEGY

### Unit Tests
- Test each MediaPipe method independently
- Mock model outputs
- Test error handling
- Test edge cases (no face, multiple faces, poor lighting)

### Integration Tests
- Test full verification workflow
- Test real-time monitoring
- Test alert generation
- Test database operations

### Performance Tests
- Test with 10 concurrent sessions
- Test with poor network conditions
- Test with low-end devices
- Measure latency and throughput

### User Acceptance Tests
- Test with real proctors
- Test with real candidates
- Test different camera setups
- Gather feedback and iterate

---

## ROLLOUT PLAN

### Phase 1: Development (BATCH 1-2)
- Setup MediaPipe infrastructure
- Replace AWS Rekognition
- Test basic face detection

### Phase 2: Enhanced Monitoring (BATCH 3-4)
- Add multiple face detection
- Add pose and gaze tracking
- Test alert system

### Phase 3: Automation (BATCH 5)
- Implement auto-capture
- Add ID verification
- Test capture workflow

### Phase 4: Integration & Testing (BATCH 6)
- Frontend integration
- End-to-end testing
- Performance optimization

### Phase 5: Deployment
- Deploy to staging
- Run pilot with 10 sessions
- Gather feedback
- Deploy to production

---

## RISK MITIGATION

### Risk 1: Model Performance
- **Mitigation**: Test with various devices, add fallback to simpler models

### Risk 2: False Positives
- **Mitigation**: Tune thresholds, add proctor override, collect feedback

### Risk 3: Privacy Concerns
- **Mitigation**: Process locally when possible, encrypt stored data, clear retention policy

### Risk 4: Browser Compatibility
- **Mitigation**: Test on Chrome, Firefox, Safari, Edge, add polyfills

---

## SUCCESS CRITERIA

- ✅ 100% removal of AWS Rekognition dependencies
- ✅ Face detection accuracy >95%
- ✅ Multiple face detection <1 second latency
- ✅ Zero false negatives for identity verification
- ✅ <5% false positive rate for AI alerts
- ✅ Proctor satisfaction score >4/5
- ✅ Candidate experience score >4/5
- ✅ System handles 50+ concurrent sessions

---

## NEXT STEPS

1. Review and approve task breakdown
2. Start with BATCH 1 (MediaPipe Setup)
3. Complete each batch sequentially
4. Test after each batch
5. Deploy incrementally

**Ready to start BATCH 1?**
