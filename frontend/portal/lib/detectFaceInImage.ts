'use client'

// Browser-side face detection for a single captured image (base64 or dataURL).
//
// Why this exists:
//   The backend runs `@mediapipe/tasks-vision` in Node, which fails with
//   `navigator is not defined` because the package is browser-only. Rather
//   than polyfill a moving target of DOM globals, we detect the face where
//   it actually works — in the proctor's browser — and send the result to
//   the backend alongside the raw image.
//
// Caches the FaceDetector instance across calls so the CDN + WASM download
// happens once per session, not per capture.

let detectorPromise: Promise<any> | null = null

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
      // Same threshold as useFaceDetection.ts. Below 0.4 the detector
      // starts returning false positives on cluttered backgrounds; above
      // 0.5 it misses blurry / low-light frames on cheap laptop webcams.
      minDetectionConfidence: 0.4,
    })
  })()
  return detectorPromise
}

/** Result of a single-image face detection pass. */
export interface FaceDetectResult {
  /** Number of faces the detector found in the frame. */
  faceCount: number
  /** Highest confidence across detected faces (0–1). 0 if no faces. */
  bestConfidence: number
  /** True if exactly one face was detected — the ID-verification success case. */
  singleFace: boolean
  /** Set only when detection could not run (WASM load failure, image decode fail). */
  error?: string
}

/**
 * Run MediaPipe FaceDetector against a single captured image.
 *
 * Accepts a full data URL (`data:image/jpeg;base64,...`) OR just the raw
 * base64 payload — we normalise below.
 *
 * Never throws: returns `{ faceCount: 0, bestConfidence: 0, singleFace: false, error }`
 * so the caller can degrade gracefully (e.g. still send the image to the
 * server with a "detection unavailable" flag).
 */
export async function detectFaceInImage(imageInput: string): Promise<FaceDetectResult> {
  try {
    const dataUrl = imageInput.startsWith('data:')
      ? imageInput
      : `data:image/jpeg;base64,${imageInput}`
    // Decode into an HTMLImageElement — MediaPipe FaceDetector accepts
    // that shape directly for runningMode: 'IMAGE'.
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Image decode failed'))
      el.src = dataUrl
    })
    const detector = await getDetector()
    const result = detector.detect(img)
    const detections: any[] = result?.detections || []
    const bestConfidence = detections.reduce((max, d) => {
      const c = d?.categories?.[0]?.score ?? 0
      return c > max ? c : max
    }, 0)
    return {
      faceCount: detections.length,
      bestConfidence,
      singleFace: detections.length === 1,
    }
  } catch (e: any) {
    return {
      faceCount: 0,
      bestConfidence: 0,
      singleFace: false,
      error: e?.message || 'Face detection failed',
    }
  }
}
