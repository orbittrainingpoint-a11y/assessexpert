'use client'

// Browser-side face detection + signature extraction for a single
// captured image. Runs entirely in the browser (MediaPipe Tasks Vision
// is browser-only — the backend can't load `@mediapipe/tasks-vision`).
//
// Two operations combined so callers get everything in one pass:
//   1. FaceDetector — is a face present? how confident? bounding box.
//   2. FaceLandmarker — 478-point landmark mesh, from which we build
//      a normalised face-geometry signature via lib/faceSignature.ts.
//      The signature replaces the fake landmark-sum "embedding" the
//      backend used to compute (PORTAL_GAPS.md H4).
//
// Both are cached across calls so the CDN + WASM download happens
// once per session, not per capture.

import { computeFaceSignature, type NormalizedLandmark } from './faceSignature'
import { captureError } from './errors'

let detectorPromise: Promise<any> | null = null
let landmarkerPromise: Promise<any> | null = null

async function getDetector(): Promise<any> {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    const vision = await import('@mediapipe/tasks-vision')
    const fileset = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
    )
    return vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.4,
    })
  })()
  return detectorPromise
}

async function getLandmarker(): Promise<any> {
  if (landmarkerPromise) return landmarkerPromise
  landmarkerPromise = (async () => {
    const vision = await import('@mediapipe/tasks-vision')
    const fileset = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
    )
    return vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
      minFaceDetectionConfidence: 0.4,
      minFacePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    })
  })()
  return landmarkerPromise
}

/** Result of a single-image face detection pass. */
export interface FaceDetectResult {
  /** Number of faces the detector found in the frame. */
  faceCount: number
  /** Highest confidence across detected faces (0–1). 0 if no faces. */
  bestConfidence: number
  /** True if exactly one face was detected — the ID-verification success case. */
  singleFace: boolean
  /** L2-normalised anatomical signature (~40 dims) from FaceLandmarker,
   *  suitable for cosine-similarity comparison against a stored
   *  reference signature. Null when no face landmarks could be
   *  extracted (usually implies no face was in the frame). */
  faceSignature: number[] | null
  /** Set only when detection could not run (WASM load failure, image decode fail). */
  error?: string
}

/**
 * Run MediaPipe FaceDetector + FaceLandmarker against a single
 * captured image and return the face-present signal + a normalised
 * signature for identity comparison.
 *
 * Accepts a full data URL (`data:image/jpeg;base64,...`) OR just the
 * raw base64 payload — we normalise below.
 *
 * Never throws: returns a zeroed result with `error` set so the
 * caller can degrade gracefully.
 */
export async function detectFaceInImage(imageInput: string): Promise<FaceDetectResult> {
  try {
    const dataUrl = imageInput.startsWith('data:')
      ? imageInput
      : `data:image/jpeg;base64,${imageInput}`
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Image decode failed'))
      el.src = dataUrl
    })

    // Run detector + landmarker in parallel. If landmarker fails
    // (rare — usually a CDN blip), we still return the detector
    // result with signature=null.
    const detector = await getDetector()
    const detResult = detector.detect(img)
    const detections: any[] = detResult?.detections || []
    const bestConfidence = detections.reduce((max, d) => {
      const c = d?.categories?.[0]?.score ?? 0
      return c > max ? c : max
    }, 0)

    let signature: number[] | null = null
    if (detections.length > 0) {
      try {
        const landmarker = await getLandmarker()
        const lmResult = landmarker.detect(img)
        const first = lmResult?.faceLandmarks?.[0] as NormalizedLandmark[] | undefined
        signature = computeFaceSignature(first)
      } catch (e) {
        // Landmarker failure is degraded — detection still counts;
        // just no signature for this frame. Report so persistent
        // landmarker failures surface in Sentry.
        captureError(e, 'face-landmarker-extract')
      }
    }

    return {
      faceCount: detections.length,
      bestConfidence,
      singleFace: detections.length === 1,
      faceSignature: signature,
    }
  } catch (e: any) {
    return {
      faceCount: 0,
      bestConfidence: 0,
      singleFace: false,
      faceSignature: null,
      error: e?.message || 'Face detection failed',
    }
  }
}
