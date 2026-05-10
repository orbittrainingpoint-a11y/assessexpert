# MediaPipe Models

This directory contains the MediaPipe models required for AI-based exam monitoring.

## Required Models

1. **Face Detection** (`face_detection_short_range.tflite`) - ~1MB
   - Detects faces in images
   - Used for face counting and initial detection

2. **Face Landmarker** (`face_landmarker.task`) - ~3MB
   - Extracts 468 facial landmarks
   - Used for face recognition and identity verification

3. **Pose Landmarker** (`pose_landmarker_lite.task`) - ~5MB
   - Detects 33 body landmarks
   - Used for posture detection and looking away detection

4. **Hand Landmarker** (`hand_landmarker.task`) - ~8MB
   - Detects hand landmarks
   - Used for detecting phone usage and suspicious hand movements

## Download Instructions

### Windows
Run the batch script:
```bash
cd backend
download-models.bat
```

### Linux/Mac
Run the shell script:
```bash
cd backend
chmod +x download-models.sh
./download-models.sh
```

### Manual Download
If the scripts don't work, download manually from:
- https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite
- https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
- https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
- https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task

Place all files in the `backend/ml-models/` directory.

## Verification

After download, verify all files exist:
```bash
ls -lh ml-models/
```

You should see:
- face_detection_short_range.tflite
- face_landmarker.task
- pose_landmarker_lite.task
- hand_landmarker.task

## Git Ignore

These model files are added to `.gitignore` due to their size. Each developer must download them locally.

## Model Updates

Models are versioned by MediaPipe. Check for updates at:
https://developers.google.com/mediapipe/solutions/vision/face_detector
