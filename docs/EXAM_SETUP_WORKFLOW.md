# Exam setup — the simple flow

**One role does everything: Master Proctor.**

Log in as `MASTER_PROCTOR` and the sidebar shows every screen you need
in order — content setup at the top, live operations below, settings
at the bottom.

```
Overview                    ← dashboard
──── Content setup ────
Assessment Types            ← create the exam container (per role/skill)
MCQ Question Bank           ← add + activate multiple-choice questions
Practical Paper Sets        ← add + activate practical papers
Exam Simulation             ← rehearse the full exam before it goes live
──── Live operations ────
Live Sessions               ← monitor everything running now
Proctors                    ← manage proctor accounts
Reports                     ← review + publish reports
──── Config ────
Settings
```

The old EXAM_SETUP_MASTER role still exists for backwards compatibility
but you don't need it any more — everything is now reachable from the
Master Proctor sidebar.

---

## The 5-step flow, first time

### Step 1: Assessment Type — the container

Path: **Assessment Types** → click **+ New Exam**

Fields to set (these become the exam's defaults):
- Name, code, category, industry, job role, description
- **MCQ Time Limit** — how long the MCQ round runs (default 30 min)
- **MCQ Question Count** — how many questions the candidate gets (default 25)
- **MCQ Pass Threshold** — % correct needed (default 60)
- **Practical Time Limit** — how long the practical runs (default 60 min)
- **Practical Pass Threshold** — % score needed (default 60)

Save → the exam is DRAFT. Come back and click **Activate** once you've
added enough content in steps 2 and 3.

### Step 2: MCQ Question Bank

Path: **MCQ Question Bank** → filter by the assessment type you just made

Two ways to add:
- **Add per question** — form with text + options + correct answer
- **Bulk CSV upload** — many at once from a spreadsheet

Every new question lands as **DRAFT**. Click **"Activate N Drafts"** at
the top of the page in one shot, or **Activate** per row.

**Target: 500 active questions per assessment type.** The exam picks 25
at random from the active pool (Fisher-Yates shuffle) so a big pool
means no two candidates ever see the same paper.

### Step 3: Practical Paper Set

Path: **Practical Paper Sets** → click **+ New Set**

- Give it a name, pick the assessment type
- Add practical questions (text / file-upload / code / etc.)
- Upload any reference files the candidate needs

Save → **click "Activate Set"** in the SetEditor header.

The exam auto-picks a random ACTIVE paper set per candidate when they
finish the MCQ round. So the more sets you have per assessment type,
the more variety across candidates. Minimum: **one active paper set per
assessment type**.

### Step 4: Verify with the Simulator

Path: **Exam Simulation** → pick the assessment type + mode → **Start**

- Runs a real MCQ round (only pulls ACTIVE questions)
- Shows correct/wrong feedback per question
- Lets you preview the practical assignment too

If the simulator says "no questions" or "no practical" → something
above is still DRAFT. Go back and click Activate.

### Step 5: Activate the Assessment Type

Once MCQ questions + at least one practical paper set are ACTIVE, go
back to **Assessment Types** and click **Activate** on the row.

That's it. HR can now schedule candidates for this assessment type from
their side, and the whole exam is ready to run.

---

## Live session flow (proctor side)

Once content is set up, live sessions work automatically:

1. HR schedules a candidate → magic-link email fires
2. Candidate joins via link → tech check → OTP → camera → waiting room
3. Proctor opens `/proctor/session/<sessionId>` and runs the 10-item
   checklist for each candidate
4. Proctor clicks **All Verified — Start Exam** → single click now:
   - Marks all candidates verified
   - Transitions to MCQ phase
   - Calls backend `POST /sessions/:id/begin`
   - Emits `exam.pushMCQ` socket → candidates advance to question 1
5. MCQ round runs (candidates get 25 random questions, 30 min)
6. On MCQ submit, backend **auto-assigns a random ACTIVE paper set** per
   candidate. Proctor sees "Push Practical Exam" button light up.
7. Proctor clicks **Push Practical Exam** → candidates load the practical
   paper set and start
8. Candidates submit → proctor grades against rubric → report drafts →
   proctor reviews → publish

Proctor's role in the live session is mostly monitoring + integrity —
they don't have to pick which content to serve; the setup you did in
steps 1–5 already decided that.

---

## Which content actually runs in an exam?

**MCQ round** — only from `Question` table (MCQ Question Bank). Master
Proctor now owns this via the consolidated nav.

**Practical round** — priority chain:
1. **Practical Paper Set** — if any ACTIVE set exists for the assessment
   type → auto-picked at random when MCQ finishes. **This is the
   recommended path.** One content model, one place to edit.
2. **Legacy Practical Task** — the older `PracticalTask` library (still
   at `/exam-setup/practical` for backwards compat, not surfaced in the
   consolidated Master Proctor nav any more). Live proctor can manually
   assign a task from this library if no paper set is available.

**Going forward: use Practical Paper Sets only.** They support multiple
sub-questions, reference files, per-question rubric — a superset of what
the older Practical Task library offered. If you have legacy sessions
using PracticalTask, those keep working.

---

## DRAFT → ACTIVE gate — every content type has one

| Content | Where | How to activate |
|---|---|---|
| Assessment Type | Assessment Types page | Click **Activate** on row (after MCQ + practical are ready) |
| MCQ Question | MCQ Question Bank | **"Activate N Drafts"** button (bulk) or per row |
| Practical Paper Set | SetEditor (inside Practical Paper Sets) | **"Activate Set"** in header |
| (Legacy) Practical Task | /exam-setup/practical | **"Activate"** per row |

Rule: if something isn't showing up in the simulator or during a live
session, 99% of the time it's still DRAFT.

---

## Troubleshooting

**"Simulator has no MCQ questions"**
Questions are DRAFT. Open MCQ Question Bank, click "Activate N Drafts".

**"Simulator has no practical"**
Only checks the legacy `PracticalTask` library — not paper sets.
If you're using paper sets (recommended), test them via a real session
instead. Or create one standalone PracticalTask + activate it just to
verify the simulator surface.

**"Candidate reaches practical screen with nothing to do"**
No active paper set for this assessment type + proctor didn't manually
assign a task. Activate a paper set OR have proctor assign one during
the session.

**"Start Exam button is disabled"**
One of the 10 checklist items isn't marked done for at least one
candidate. Usually the last one — Guidelines & Agreement — because the
candidate hasn't clicked "I Agree". Proctor now has a
**"Manually confirm — candidate agreed verbally"** escape hatch in that
checklist step.

**"Push MCQ Exam shows ✓ MCQ Pushed already but candidates never advanced"**
Stale build — close the tab, open fresh. The old bug pre-set the button;
the current build only marks it pushed AFTER the backend confirms.

**"Push Practical Exam is greyed out"**
Not a bug — it enables only when every candidate has submitted MCQ.
Wait for them, or check MonitorGrid to see who's stuck on what
question.
