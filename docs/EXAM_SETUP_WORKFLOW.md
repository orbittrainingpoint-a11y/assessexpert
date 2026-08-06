# How to set up an exam (from empty CMS to first candidate session)

Every content object in the platform starts in **DRAFT** status. Nothing
reaches a real candidate until it is explicitly promoted to **ACTIVE**.
This is the single most common reason a session "isn't pushing" — the
content the proctor is trying to assign is still DRAFT.

There are four content object types with a DRAFT → ACTIVE gate:

| Object | Where it's created | Where it's activated |
|---|---|---|
| Assessment Type | `/admin/assessments` or `/exam-setup/assessments` | Auto-active? See notes |
| MCQ Question    | `/exam-setup/questions` (bulk or per-question) | Same page — "Activate" button |
| Practical Task  | `/exam-setup/practical` | Same page — "Activate" button (**new**) |
| Practical Paper Set | `/master-proctor/paper-sets/<setId>` (SetEditor) | Same page — "Activate Set" button |

---

## Full setup flow — first-time proctored exam

### 1. Assessment Type (once per role)

Path: `/admin/assessments` (SUPER_ADMIN) or `/exam-setup/assessments`
(EXAM_SETUP_MASTER).

Create an `AssessmentType` — this is the container for MCQ questions +
practical tasks for a specific job role (e.g. "AutoCAD Draftsman L2").

- Fill in name, description, industry, `mcqQuestionCount` (default 25),
  `mcqDurationMinutes` (default 30), `practicalDurationMinutes` (default 60).
- Save.

### 2. MCQ question bank (aim for 500 per role)

Path: `/exam-setup/questions?assessmentTypeId=<id>`

- **Add questions** individually OR upload CSV in bulk.
- Every new question lands in **DRAFT** by default.
- Click **"Activate <n> Drafts"** at the top to promote all drafts to
  ACTIVE in one click, or use the per-row **"Activate"** button.
- Only ACTIVE questions can appear in a live exam or the simulator.

### 3. Practical task (at least one per role)

Path: `/exam-setup/practical`

- Click **"Add Task"** — set title, description, task type
  (CAD / CODING / LAB / FILE), difficulty, estimated minutes.
- After save the task is **DRAFT**.
- **NEW: click the "Activate" button on the row** to flip it to ACTIVE.
- Before this fix, tasks stayed DRAFT forever and were invisible to
  both the simulator and the proctor's "Assign practical" panel.

### 4. Practical Paper Set (optional — multi-part practical)

Path: `/master-proctor/paper-sets` → click a set → SetEditor

A **Paper Set** is a wrapper around multiple **Practical Questions** so
you can ask a candidate several practical sub-tasks in sequence.

- Create the set (name, assessmentType).
- Add questions to it (per-question type: TEXT / FILE / CODE / etc.).
- Upload any reference files needed.
- Click **"Activate Set"** in SetEditor header to promote DRAFT → ACTIVE.
- Only ACTIVE sets appear in the proctor's "Assign practical set" dropdown.

### 5. Verify with the simulator

Path: `/exam-setup/simulation?assessmentTypeId=<id>`

- Pick the assessment type + mode (MCQ / Practical / Full).
- The simulator queries the API with `status=ACTIVE`; anything DRAFT
  will not appear.
- If MCQ mode returns "No questions" → step 2 wasn't finished.
- If Practical mode returns "No tasks" → step 3 wasn't finished
  (Activate button not clicked).

---

## Live session flow — proctored exam

Once content is set up:

### 6. Schedule a candidate

Path: `/hr/candidates` (HR_MANAGER)

- Add candidate → click **Schedule** → pick assessment type + slot.
- Magic-link email fires automatically.

### 7. Candidate joins on session day

- Clicks magic link → tech check → OTP → camera + reference photo →
  waiting room.

### 8. Proctor runs the checklist

Path: `/proctor/session/<sessionId>`

Complete all 10 checklist items in order:
1. Camera Verification
2. Verbal Identity (Name)
3. Verbal Identity (Email)
4. Identity Check (photo ID capture)
5. Environment Scan (360° rotation)
6. No Unauthorized Materials
7. Facial Recognition (auto-cosine against stored reference)
8. Screen Share (candidate shares whole screen)
9. GuardPro / Tech Check (manual confirm)
10. Guidelines & Agreement (candidate ticks "I Agree" on their end — OR
    proctor uses the new **"Manually confirm — candidate agreed verbally"**
    button if the socket event doesn't arrive)

### 9. Push the exam

- Bottom of ChecklistPanel: **"Begin MCQ Exam"** (per-candidate mark verified)
- Bottom of VerificationLayout: **"All Verified — Start Exam"** →
  chained now: this ONE click sets the session to MCQ_IN_PROGRESS,
  emits `exam.pushMCQ` socket, candidates advance to question 1.
- Post-verification screen still shows a **"Push MCQ Exam"** button for
  manual re-push if a candidate joined late.

### 10. After MCQ submission

- `allMcqSubmitted` flips true when every candidate has submitted.
- **"Push Practical Exam"** button in PostVerificationLayout becomes clickable.
- Click it → candidates receive `exam.pushPractical` → practical panel
  loads their assigned task.

### 11. Practical submission → report

- Candidates upload / submit their practical work.
- Proctor grades against rubric.
- Report auto-drafts → proctor reviews → publishes.

---

## Troubleshooting

**"Push MCQ is greyed out with ✓ MCQ Pushed already"**
Old bug: mcqPushed was pre-set true. Fixed 2026-08. If still seeing it,
your browser has a stale build — close tab, reopen fresh.

**"Simulator says no questions"**
Questions are DRAFT. Go to `/exam-setup/questions?assessmentTypeId=<id>`
and click "Activate N Drafts".

**"Proctor can't assign a practical"**
Task is DRAFT. Go to `/exam-setup/practical` and click Activate on the row.

**"Paper set doesn't appear in proctor's dropdown"**
Set is DRAFT. Go to `/master-proctor/paper-sets/<id>` → header → click
"Activate Set".

**"Candidate stuck at camera / verification never advances"**
- Proctor hasn't clicked "All Verified — Start Exam" yet, OR
- The socket connection dropped between proctor and backend. Check
  `pm2 logs assessexpert-backend --lines 40 --nostream | tail` for
  socket-disconnect entries around the click time.

**"Push Practical is disabled"**
No candidate has submitted MCQ yet. Wait for them, OR they're stuck on
a question. Check MonitorGrid on the proctor page for their current
question index.
