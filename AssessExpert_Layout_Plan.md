# AssessExpert — Proctoring System Layout Plan

---

## PHASE 1A — Proctor Screen: When First Joining (No Candidate Selected Yet)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR          Live Session   |   Exam Name: AutoCAD Draftsman Level 1   Phase: Checklist │
├───────────────────────────────────────────────────┬───────────────┬─────────────────────────────┤
│                                                   │               │                             │
│                                                   │  Candidate 1  │                             │
│                                                   │  [ camera ]   │                             │
│                                                   │  ● Pending    │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│                                                   │               │                             │
│          MAIN ACTIVE PANEL                        │  Candidate 2  │      CHECKLIST PANEL        │
│                                                   │  [ camera ]   │                             │
│     ┌─────────────────────────────────┐           │  ● Pending    │   (Empty — select a         │
│     │                                 │           │               │    candidate to begin)      │
│     │   Click a candidate tile to     │           ├───────────────┤                             │
│     │   begin verification            │           │               │                             │
│     │                                 │           │  Candidate 3  │                             │
│     └─────────────────────────────────┘           │  [ camera ]   │                             │
│                                                   │  ● Pending    │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│                                                   │               │                             │
│                                                   │  Candidate 4  │                             │
│                                                   │  [ camera ]   │                             │
│                                                   │  ● Pending    │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│                                                   │               │                             │
│                                                   │  Candidate 5  │                             │
│  ┌──────────────────┐                             │  [ camera ]   │                             │
│  │  Proctor Self    │                             │  ● Pending    │                             │
│  │  Camera (small)  │                             │               │                             │
│  └──────────────────┘                             ├───────────────┤                             │
│                                                   │  [ DISABLED ] │                             │
│                                                   │ Verification  │                             │
│                                                   │  Done Button  │                             │
├───────────────────────────────────────────────────┴───────────────┴─────────────────────────────┤
│  FOOTER: Session info / proctor name / sign out                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

  │◄────────────────── 65% width ──────────────────►│◄── 15% ──────►│◄────── 20% ───────────────►│
```

---

## PHASE 1B — Proctor Screen: Active Candidate Verification

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR          Live Session   |   Exam Name: AutoCAD Draftsman Level 1   Phase: Checklist │
├───────────────────────────────────────────────────┬───────────────┬─────────────────────────────┤
│                                                   │               │                             │
│  ACTIVE VERIFICATION: Candidate 2                 │  Candidate 1  │   CHECKLIST — Candidate 2   │
│                                                   │  [ camera ]   │   ─────────────────────     │
│  ┌────────────────────────────────────────────┐   │  ✔ Done       │   Progress: 3 of 7 done     │
│  │                                            │   │               │   ░░░░░░░░░░░░░░░░░░░░░     │
│  │                                            │   ├───────────────┤                             │
│  │                                            │   │               │   ☑  ID Verified            │
│  │     CANDIDATE 2 LIVE CAMERA FEED           │   │  Candidate 2  │   ☑  Face Match Confirmed   │
│  │     (large, full panel)                    │   │  [ camera ]   │   ☑  Room Scan Done         │
│  │                                            │   │  ◉ Active     │   ☐  No Phone on Desk       │
│  │                                            │   │               │   ☐  No Notes Visible       │
│  │                                            │   ├───────────────┤   ☐  Lighting Adequate      │
│  │                                            │   │               │   ☐  Single Monitor Only    │
│  │                                            │   │  Candidate 3  │                             │
│  │                                            │   │  [ camera ]   │                             │
│  └────────────────────────────────────────────┘   │  ● Pending    │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│                                                   │               │                             │
│                                                   │  Candidate 4  │                             │
│                                                   │  [ camera ]   │                             │
│                                                   │  ● Pending    │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│  ┌──────────────────┐                             │               │                             │
│  │  Proctor Self    │                             │  Candidate 5  │                             │
│  │  Camera (small)  │                             │  [ camera ]   │                             │
│  └──────────────────┘                             │  ● Pending    │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│                                                   │  [ DISABLED ] │                             │
│                                                   │ Verification  │                             │
│                                                   │  Done Button  │                             │
├───────────────────────────────────────────────────┴───────────────┴─────────────────────────────┤
│  FOOTER: Proctor: Ali Hassan  |  proctor@assessexpert.ae  |  Sign Out                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1C — Proctor Screen: All Candidates Verified (Button Unlocks)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR          Live Session   |   Exam Name: AutoCAD Draftsman Level 1   Phase: Checklist │
├───────────────────────────────────────────────────┬───────────────┬─────────────────────────────┤
│                                                   │               │                             │
│  ACTIVE VERIFICATION: Candidate 5                 │  Candidate 1  │   CHECKLIST — Candidate 5   │
│                                                   │  [ camera ]   │   ─────────────────────     │
│  ┌────────────────────────────────────────────┐   │  ✔ Done       │   Progress: 7 of 7 done     │
│  │                                            │   │               │   ████████████████████      │
│  │                                            │   ├───────────────┤                             │
│  │                                            │   │               │   ☑  ID Verified            │
│  │     CANDIDATE 5 LIVE CAMERA FEED           │   │  Candidate 2  │   ☑  Face Match Confirmed   │
│  │     (large, full panel)                    │   │  [ camera ]   │   ☑  Room Scan Done         │
│  │                                            │   │  ✔ Done       │   ☑  No Phone on Desk       │
│  │                                            │   │               │   ☑  No Notes Visible       │
│  │                                            │   ├───────────────┤   ☑  Lighting Adequate      │
│  │                                            │   │               │   ☑  Single Monitor Only    │
│  │                                            │   │  Candidate 3  │                             │
│  │                                            │   │  [ camera ]   │   ✔ All Items Complete      │
│  └────────────────────────────────────────────┘   │  ✔ Done       │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│                                                   │               │                             │
│                                                   │  Candidate 4  │                             │
│                                                   │  [ camera ]   │                             │
│                                                   │  ✔ Done       │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│  ┌──────────────────┐                             │               │                             │
│  │  Proctor Self    │                             │  Candidate 5  │                             │
│  │  Camera (small)  │                             │  [ camera ]   │                             │
│  └──────────────────┘                             │  ✔ Done       │                             │
│                                                   │               │                             │
│                                                   ├───────────────┤                             │
│                                                   │  [ ENABLED ]  │                             │
│                                                   │ Verification  │                             │
│                                                   │  Done — Start │                             │
│                                                   │    Exam  ►    │                             │
├───────────────────────────────────────────────────┴───────────────┴─────────────────────────────┤
│  FOOTER: Proctor: Ali Hassan  |  proctor@assessexpert.ae  |  Sign Out                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 2 — Proctor Screen: Exam Monitoring Phase

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR     Live Session  |  Exam Name: AutoCAD Draftsman Level 1  |  Phase: Exam Running   │
├─────────────────────────────────────────────────────────────────┬───────────────────────────────┤
│                                                                 │                               │
│   ┌───────────────────────┐   ┌───────────────────────┐        │  ┌─────────────────────────┐  │
│   │  Candidate 1          │   │  Candidate 2          │        │  │   Push MCQ Exam         │  │
│   │  ┌─────────────────┐  │   │  ┌─────────────────┐  │        │  │   [ SEND TO ALL ]       │  │
│   │  │  Screen Share   │  │   │  │  Screen Share   │  │        │  └─────────────────────────┘  │
│   │  │  (exam screen)  │  │   │  │  (exam screen)  │  │        │                               │
│   │  └─────────────────┘  │   │  └─────────────────┘  │        │  ┌─────────────────────────┐  │
│   │  [cam] bottom corner  │   │  [cam] bottom corner  │        │  │  Push Practical Exam    │  │
│   └───────────────────────┘   └───────────────────────┘        │  │  [ DISABLED until MCQ   │  │
│                                                                 │  │    all submitted ]      │  │
│   ┌───────────────────────┐   ┌───────────────────────┐        │  └─────────────────────────┘  │
│   │  Candidate 3          │   │  Candidate 4          │        │                               │
│   │  ┌─────────────────┐  │   │  ┌─────────────────┐  │        │  ┌─────────────────────────┐  │
│   │  │  Screen Share   │  │   │  │  Screen Share   │  │        │  │   Disqualify Candidate  │  │
│   │  │  (exam screen)  │  │   │  │  (exam screen)  │  │        │  │   [ Select ▼ ] [ Mark ] │  │
│   │  └─────────────────┘  │   │  └─────────────────┘  │        │  └─────────────────────────┘  │
│   │  [cam] bottom corner  │   │  [cam] bottom corner  │        │                               │
│   └───────────────────────┘   └───────────────────────┘        │  ─────────────────────────    │
│                                                                 │  LIVE NOTIFICATIONS           │
│   ┌───────────────────────┐                                     │  ─────────────────────────    │
│   │  Candidate 5          │                                     │  ● Candidate 2 submitted MCQ  │
│   │  ┌─────────────────┐  │                                     │  ● Candidate 1 tab switched   │
│   │  │  Screen Share   │  │                                     │  ● Candidate 4 submitted MCQ  │
│   │  │  (exam screen)  │  │                                     │  ● Candidate 3 submitted MCQ  │
│   │  └─────────────────┘  │                                     │  ● Candidate 5 submitted MCQ  │
│   │  [cam] bottom corner  │                                     │                               │
│   └───────────────────────┘                                     │                               │
│                                                                 │                               │
│  ┌──────────────────┐                                           │                               │
│  │  Proctor Self    │                                           │                               │
│  │  Camera (small)  │                                           │                               │
│  └──────────────────┘                                           │                               │
├─────────────────────────────────────────────────────────────────┴───────────────────────────────┤
│  FOOTER: Proctor: Ali Hassan  |  proctor@assessexpert.ae  |  Sign Out                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

  │◄────────────────────────────── 75% width ───────────────────────────────►│◄───── 25% ────────►│
```

---

## PHASE 1 — Candidate Screen: Verification Waiting Phase

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR    Candidate Screen  |  AutoCAD Draftsman Level 1  |  Phase: Verification           │
├─────────────────────────────────────┬───────────────────────────────────────────────────────────┤
│                                     │                                                           │
│   PROCTOR CAMERA FEED               │   YOUR CAMERA FEED                                        │
│                                     │                                                           │
│   ┌─────────────────────────────┐   │   ┌─────────────────────────────────────────────────┐    │
│   │                             │   │   │                                                 │    │
│   │                             │   │   │                                                 │    │
│   │  (Blank until proctor       │   │   │     Candidate live camera feed                  │    │
│   │   enters your tile)         │   │   │     (always visible from start)                 │    │
│   │                             │   │   │                                                 │    │
│   │  Waiting for proctor        │   │   │                                                 │    │
│   │  to connect...              │   │   │                                                 │    │
│   │                             │   │   │  ● Camera Active                                │    │
│   └─────────────────────────────┘   │   └─────────────────────────────────────────────────┘    │
│                                     │                                                           │
├─────────────────────────────────────┴───────────────────────────────────────────────────────────┤
│                                                                                                 │
│   VERIFICATION CHECKLIST STATUS  (read-only — updates live as proctor checks items)             │
│                                                                                                 │
│   Progress: 3 of 7 items verified    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│                                                                                                 │
│   ☑  ID Verified                                                                                │
│   ☑  Face Match Confirmed                                                                       │
│   ☑  Room Scan Done                                                                             │
│   ☐  No Phone on Desk                          (pending — proctor has not checked yet)          │
│   ☐  No Notes Visible                          (pending)                                        │
│   ☐  Lighting Adequate                         (pending)                                        │
│   ☐  Single Monitor Only                       (pending)                                        │
│                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

  │◄───────────── 50% width ────────────►│◄───────────────── 50% width ──────────────────────────►│
  (Proctor camera panel)                  (Candidate own camera panel)
```

---

## PHASE 1 — Candidate Screen: When Proctor Enters Their Tile (Audio + Video Active)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR    Candidate Screen  |  AutoCAD Draftsman Level 1  |  Phase: Verification           │
├─────────────────────────────────────┬───────────────────────────────────────────────────────────┤
│                                     │                                                           │
│   PROCTOR CAMERA FEED               │   YOUR CAMERA FEED                                        │
│                                     │                                                           │
│   ┌─────────────────────────────┐   │   ┌─────────────────────────────────────────────────┐    │
│   │                             │   │   │                                                 │    │
│   │                             │   │   │                                                 │    │
│   │   Proctor live camera feed  │   │   │     Candidate live camera feed                  │    │
│   │   (now visible and active)  │   │   │     (always visible from start)                 │    │
│   │                             │   │   │                                                 │    │
│   │                             │   │   │                                                 │    │
│   │  ● Live — Proctor Connected │   │   │                                                 │    │
│   │  🔊 Audio Active            │   │   │  ● Camera Active                                │    │
│   └─────────────────────────────┘   │   └─────────────────────────────────────────────────┘    │
│                                     │                                                           │
├─────────────────────────────────────┴───────────────────────────────────────────────────────────┤
│                                                                                                 │
│   VERIFICATION CHECKLIST STATUS  (updating live)                                                │
│                                                                                                 │
│   Progress: 5 of 7 items verified    ████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░        │
│                                                                                                 │
│   ☑  ID Verified                                                                                │
│   ☑  Face Match Confirmed                                                                       │
│   ☑  Room Scan Done                                                                             │
│   ☑  No Phone on Desk                                                                           │
│   ☑  Lighting Adequate                                                                          │
│   ☐  No Notes Visible                          (pending)                                        │
│   ☐  Single Monitor Only                       (pending)                                        │
│                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 2 — Candidate Screen: Exam Running Phase

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR    AutoCAD Draftsman Level 1  |  Phase: MCQ Exam  |  Time Remaining: 01:24:37       │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│                                                                                                 │
│                                                                                                 │
│                                                                                                 │
│                                                                                                 │
│                           EXAM INTERFACE LOADS HERE                                             │
│                                                                                                 │
│                    (MCQ questions / Practical task — full viewport)                             │
│                                                                                                 │
│                    No proctor camera visible                                                     │
│                    No candidate camera visible to candidate                                      │
│                    No checklist visible                                                          │
│                    No verification UI                                                            │
│                                                                                                 │
│                    Candidate camera stream continues silently                                    │
│                    in background to proctor — hidden from candidate UI                           │
│                                                                                                 │
│                                                                                                 │
│                                                                                                 │
│                                                                                                 │
│                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## STATE FLOW SUMMARY

```
PROCTOR FLOW:
─────────────────────────────────────────────────────────────────────────────
  Join Session
       │
       ▼
  Phase 1A: Idle — waiting for candidates to join
       │
       ▼ (candidates appear as tiles)
  Phase 1B: Click candidate tile → verify one by one
       │      ├── Large cam view loads in left panel
       │      ├── Checklist loads in right panel
       │      ├── Audio connects to that candidate only
       │      └── On checklist complete → tile marks Done
       │
       ▼ (all tiles marked Done)
  Phase 1C: "Verification Done" button activates → proctor clicks
       │
       ▼
  Phase 2: Exam Monitoring
             ├── Push MCQ Exam → all candidates start MCQ
             ├── Monitor screen shares and cameras in grid
             ├── Wait for all MCQ submitted or timer expired
             └── Push Practical Exam button activates → push

CANDIDATE FLOW:
─────────────────────────────────────────────────────────────────────────────
  Join Session
       │
       ▼
  Phase 1 (Waiting): See own camera. Proctor panel is blank.
       │
       ▼ (proctor clicks their tile)
  Phase 1 (Active): Proctor camera and audio become visible/audible.
                    Checklist updates live from proctor actions.
       │
       ▼ (proctor moves to next candidate)
  Phase 1 (Waiting again): Proctor panel goes blank. Checklist frozen at last state.
       │
       ▼ (proctor clicks "Verification Done — Start Exam")
  Phase 2: Exam screen loads. All camera and proctor feeds hidden.
           Candidate camera continues streaming silently to proctor.
```

---

## SOCKET.IO EVENT MAP

```
EVENT NAME                          DIRECTION           TRIGGERS
────────────────────────────────────────────────────────────────────────────────
proctor:joined                      Server → All        Proctor session confirmed
candidate:joined(candidateId)       Server → Proctor    New candidate tile appears
proctor:enterVerification(id)       Proctor → Server    Audio+video opens to candidate
  └→ candidate:proctorActive(id)    Server → Candidate  Candidate sees proctor feed
proctor:leaveVerification(id)       Proctor → Server    Audio+video closes to candidate
  └→ candidate:proctorLeft(id)      Server → Candidate  Candidate panel goes blank
checklist:itemUpdated(id,item)      Proctor → Server    Checklist item checked
  └→ candidate:checklistUpdate      Server → Candidate  Checklist UI updates live
checklist:candidateComplete(id)     Server → Proctor    Tile marks Done
proctor:allVerified                 Server → Proctor    Unlock Verification Done button
exam:pushMCQ                        Proctor → Server    MCQ starts on all candidates
  └→ candidate:startMCQ             Server → All        Candidate screen switches to exam
exam:mcqSubmitted(candidateId)      Candidate → Server  Proctor sidebar updates
exam:allMCQDone                     Server → Proctor    Unlock Push Practical button
exam:pushPractical                  Proctor → Server    Practical starts on all candidates
candidate:disqualified(id)          Proctor → Server    Candidate locked out, tile flagged
```
