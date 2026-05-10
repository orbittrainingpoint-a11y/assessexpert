@echo off
REM MediaPipe Model Download Script for Windows
REM Run this script to download all required MediaPipe models

echo Downloading MediaPipe models...

REM Create ml-models directory if not exists
if not exist ml-models mkdir ml-models

REM Face Detection Model (BlazeFace Short Range)
echo Downloading Face Detection model...
curl -L -o ml-models\face_detection_short_range.tflite https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite

REM Face Landmarker Model
echo Downloading Face Landmarker model...
curl -L -o ml-models\face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task

REM Pose Landmarker Model (Lite)
echo Downloading Pose Landmarker model...
curl -L -o ml-models\pose_landmarker_lite.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task

REM Hand Landmarker Model
echo Downloading Hand Landmarker model...
curl -L -o ml-models\hand_landmarker.task https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task

echo All models downloaded successfully!
echo Models location: .\ml-models\
pause
