'use client'

// Face-geometry signature derived from MediaPipe FaceLandmarker output.
// Replaces the fake "embedding" that used to sum landmark coordinates
// (PORTAL_GAPS.md H4).
//
// The output is a fixed-length vector suitable for cosine-similarity
// comparison. Two vectors from the same person (different frames,
// mild pose / lighting changes) should score high; two vectors from
// different people should score low.
//
// Approach — anatomical pairwise distances:
//
//   1. Pick ~40 stable landmark pairs from the 478-point mesh
//      (eye corners, nose ridge, mouth corners, jaw, brow, etc.).
//   2. Compute the 3D Euclidean distance for each pair.
//   3. Normalise by the inter-eye distance (canonical scale) so the
//      signature is invariant to how close the face is to the camera.
//   4. Emit as a Float32Array + rescale to unit L2 norm so downstream
//      cosine similarity is a proper dot product.
//
// Trade-offs (versus a trained face-recognition embedding):
//   + Zero new deps — leans on the MediaPipe FaceLandmarker we already
//     ship.
//   + Deterministic, no ML training required, works in Node too if
//     ever needed (just needs landmarks as input).
//   - Weaker than a proper 128-d face-net descriptor for
//     cross-lighting / cross-expression matching. For our use case
//     (compare a fresh proctor capture against a reference photo
//     taken minutes ago on the same setup) it's more than enough.
//   - Fragile under heavy pose change / partial occlusion. The
//     proctor UI already requires a straight-on look for capture, so
//     this is a minor concern.

// MediaPipe FaceLandmarker returns 478 landmarks numbered 0..477 in a
// well-documented topology. The pairs below are chosen so each captures
// a distinct facial ratio; the set covers eyes, brows, nose, mouth,
// cheekbones, and jawline.
//
// See: https://developers.google.com/mediapipe/solutions/vision/face_landmarker
// for the landmark index diagram.
const PAIRS: [number, number][] = [
  // Eyes
  [33, 133],   // right eye outer → right eye inner
  [362, 263],  // left eye inner → left eye outer
  [159, 145],  // right eye top → right eye bottom
  [386, 374],  // left eye top → left eye bottom
  [33, 362],   // right eye outer → left eye inner (inter-eye anchor)
  // Brows
  [70, 63],    // right brow outer → inner
  [336, 296],  // left brow inner → outer
  [70, 336],   // right brow outer → left brow outer (brow span)
  // Nose
  [6, 197],    // nose bridge top → nose bridge bottom
  [1, 5],      // nose tip → nose base
  [98, 327],   // right nostril → left nostril
  [1, 168],    // nose tip → glabella (between brows)
  // Mouth
  [61, 291],   // right mouth corner → left mouth corner
  [13, 14],    // upper lip centre → lower lip centre
  [78, 308],   // right inner lip corner → left inner lip corner
  [17, 200],   // lower lip bottom → chin (mouth-to-chin ratio)
  // Cheekbones
  [234, 454],  // right cheek → left cheek (face width)
  [93, 323],   // right sideburn → left sideburn
  // Jawline / chin
  [172, 397],  // right jaw hinge → left jaw hinge
  [152, 175],  // chin bottom → chin base (chin height)
  // Vertical proportions
  [10, 152],   // forehead top → chin bottom (face height)
  [10, 168],   // forehead top → glabella
  [168, 1],    // glabella → nose tip
  [1, 17],     // nose tip → lower lip bottom
  [17, 152],   // lower lip → chin
  // Diagonal spans (help disambiguate wider vs longer faces)
  [234, 152],  // right cheek → chin
  [454, 152],  // left cheek → chin
  [10, 234],   // forehead top → right cheek
  [10, 454],   // forehead top → left cheek
  // Fine ratios
  [61, 17],    // right mouth → lower lip bottom
  [291, 17],   // left mouth → lower lip bottom
  [33, 61],    // right eye → right mouth
  [263, 291],  // left eye → left mouth
  [33, 152],   // right eye → chin
  [263, 152],  // left eye → chin
  [70, 152],   // right brow outer → chin
  [336, 152],  // left brow outer → chin
  [70, 61],    // right brow → right mouth
  [336, 291],  // left brow → left mouth
  [93, 61],    // right sideburn → right mouth
]

export type NormalizedLandmark = { x: number; y: number; z: number }

/**
 * Compute a normalised, unit-length face signature from a set of
 * MediaPipe FaceLandmarker landmarks.
 *
 * Returns null if the input doesn't look like a valid landmark array
 * (wrong length, missing indices). Never throws.
 */
export function computeFaceSignature(landmarks: NormalizedLandmark[] | undefined | null): number[] | null {
  if (!landmarks || landmarks.length < 468) return null

  // Canonical scale: distance between the outer eye corners. This is
  // fairly stable to expression + partial occlusion.
  const rightEye = landmarks[33]
  const leftEye = landmarks[263]
  if (!rightEye || !leftEye) return null
  const eyeSpan = dist(rightEye, leftEye)
  if (!isFinite(eyeSpan) || eyeSpan <= 0) return null

  const raw: number[] = []
  for (const [a, b] of PAIRS) {
    const pa = landmarks[a]
    const pb = landmarks[b]
    if (!pa || !pb) return null
    raw.push(dist(pa, pb) / eyeSpan)
  }

  // L2-normalise so the vector sits on the unit hypersphere; cosine
  // similarity is then a plain dot product.
  return l2Normalise(raw)
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z || 0) - (b.z || 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function l2Normalise(v: number[]): number[] {
  let sum = 0
  for (const x of v) sum += x * x
  const mag = Math.sqrt(sum)
  if (mag === 0) return v.slice()
  return v.map(x => x / mag)
}
