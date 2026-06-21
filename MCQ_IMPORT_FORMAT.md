# MCQ Question Bank — CSV / XLSX Import Format

The MCQ Question Bank page (`/exam-setup/questions` for Exam Setup
Master, `/master-proctor/questions` for Master Proctor) supports bulk
import of questions from a **CSV** or **XLSX** file.

Two buttons:
- **Download Template** — grabs a ready-to-edit CSV with the right
  headers and three sample rows (one of each question type).
- **Import CSV** — uploads your filled-in file. Pick the Assessment
  Type first; every imported question lands in that type's bank as a
  **DRAFT** for review.

---

## File format at a glance

| Property | Value |
|---|---|
| Encoding | UTF-8 (BOM accepted; Excel-on-Windows writes one) |
| Delimiter | Comma `,` |
| Quoting | Double quotes `"` around any field containing commas, newlines, or quotes |
| Escape inside quotes | Double up the quote — `"he said ""hi"""` |
| Row 1 | Header row (column names) |
| Row 2+ | One question per row |
| File extension | `.csv`, `.xlsx`, or `.xls` |

Column order **does not matter** — the importer reads headers from
row 1 and maps fields by name. Unknown columns are silently ignored,
so you can add notes columns without breaking the import.

---

## Column reference

| Header | Required | Type | Notes |
|---|---|---|---|
| `questionText` | **Yes** | string | The question stem. Can contain commas/newlines if the field is wrapped in `"..."`. |
| `optionA` | Yes for MCQ; opt for TRUE_FALSE | string | Choice A. |
| `optionB` | Yes | string | Choice B. |
| `optionC` | MCQ only | string | Choice C. Leave blank for TRUE_FALSE. |
| `optionD` | MCQ only | string | Choice D. Leave blank for TRUE_FALSE. |
| `optionE` | No | string | Choice E (optional fifth option). |
| `correctAnswers` | **Yes** | string | Letter(s) of the correct answer. See below. |
| `difficulty` | No (default `MEDIUM`) | enum | `EASY`, `MEDIUM`, or `HARD`. Case-insensitive. |
| `domain` | No (default `General`) | string | Topic/domain tag, e.g. `Networking`, `Algorithms`. |
| `explanation` | No | string | Shown to the candidate after submit (if enabled). |
| `tags` | No | string | Comma- or semicolon-separated, e.g. `tcp,protocols`. |
| `marks` | No (default `1`) | number | Points awarded for a correct answer. |
| `language` | No (default `en`) | string | ISO 639-1 code: `en`, `ar`, etc. |
| `type` | No (default `MCQ_SINGLE`) | enum | `MCQ_SINGLE`, `MCQ_MULTI`, or `TRUE_FALSE`. |

### Accepted aliases for headers

The importer is forgiving on header naming — these all map to the same
field:

| Aliases (case-insensitive) | Canonical field |
|---|---|
| `question`, `questiontext`, `Question Text` | `questionText` |
| `correct`, `correctanswer`, `Correct Answers` | `correctAnswers` |
| `topic` | `domain` |
| `points` | `marks` |
| `questiontype` | `type` |

Whitespace, underscores, and hyphens in headers are stripped before
matching — `Question Text`, `question_text`, and `question-text` all
work.

---

## `correctAnswers` — how to write it

| Question type | Format | Example |
|---|---|---|
| `MCQ_SINGLE` | Single letter | `C` |
| `MCQ_MULTI` | Comma-separated letters | `A,B,D` (spaces ok: `A, B, D`) |
| `TRUE_FALSE` | Single letter — `A` for True, `B` for False | `A` |

The importer rejects rows where:
- The key doesn't match a defined option (you wrote `C` but `optionC`
  is empty).
- `MCQ_SINGLE` rows have more than one correct answer.
- The keys are anything other than `A`, `B`, `C`, `D`, `E`.

---

## Enum values

```
type:        MCQ_SINGLE | MCQ_MULTI | TRUE_FALSE
difficulty:  EASY | MEDIUM | HARD
language:    en | ar | (any ISO 639-1 code)
```

All case-insensitive on input.

---

## Sample CSV

The template you can download from the UI matches this exactly:

```csv
questionText,optionA,optionB,optionC,optionD,optionE,correctAnswers,difficulty,domain,explanation,tags,marks,language,type
"What does the OSI model's Layer 3 primarily handle?","Physical bits","Data link framing","Routing and logical addressing","Transport segments","Session control","C",EASY,"Networking","Layer 3 is the Network layer — IP, routing, logical addressing.","fundamentals,osi",1,en,MCQ_SINGLE
"Which of these are valid HTTP methods? (select all that apply)","GET","POST","FETCH","DELETE","CONNECT","A,B,D,E",MEDIUM,"Web APIs","FETCH is a JavaScript fetch() call, not an HTTP method.","http,web",2,en,MCQ_MULTI
"TCP guarantees in-order delivery of packets.","True","False",,,,"A",EASY,"Networking","TCP is a reliable, in-order transport protocol.","tcp,protocols",1,en,TRUE_FALSE
```

Notes on the rows above:
- Row 2 — MCQ_SINGLE — exactly one correct answer (`C`).
- Row 3 — MCQ_MULTI — comma-separated correct answers in **one
  CSV cell**, hence wrapped in `"..."` so the inner comma isn't
  treated as a column separator.
- Row 4 — TRUE_FALSE — `optionC/D/E` left empty; correct answer `A`
  means True.

---

## Common errors and how to fix them

| Error reported on import | Cause | Fix |
|---|---|---|
| `questionText is empty` | Row has no question stem. | Put text in the `questionText` column or delete the row. |
| `correctAnswers is empty` | Correct answer cell blank. | Add the letter(s) — `A`, or `A,C`. |
| `correctAnswers references "C" but optionC is empty` | Marked an empty option as correct. | Either fill in `optionC` or change `correctAnswers`. |
| `MCQ_SINGLE expects exactly one correct answer, got 2` | Multi-letter correct value on a SINGLE row. | Change `type` to `MCQ_MULTI` or remove extra letters. |
| `type "MCQ" is not valid` | Used the wrong enum value. | Use `MCQ_SINGLE`, `MCQ_MULTI`, or `TRUE_FALSE`. |
| `difficulty "Med" is not valid` | Used a partial enum value. | Use the full word: `EASY`, `MEDIUM`, `HARD`. |
| `No data rows found in file` | Wrong file shape — usually no header row. | Make sure row 1 contains the column headers (see template). |

Errors are returned **per row** with the original row number — so if
row 47 fails, the response says `row 47: <message>`. Failed rows are
**skipped**; everything else still imports. You don't need to re-upload
the whole file — fix only the failed rows in a smaller follow-up CSV.

---

## Quoting rules — when do I need quotes?

Wrap a field in double quotes whenever it contains:
- A comma (`,`) — otherwise it splits into two columns.
- A newline — for multi-line explanations.
- A double quote (`"`) — and double it: `"She said ""yes""."`

You can quote any field even if it doesn't need it; the importer
treats `"EASY"` and `EASY` the same.

Excel and Google Sheets handle quoting automatically when you save
as CSV — you only need to think about it when hand-writing CSV in a
text editor.

---

## Excel / Google Sheets workflow

1. Download the template from the **Download Template** button.
2. Open it in Excel or Google Sheets (it opens as a normal
   spreadsheet).
3. Add your rows below the sample rows. Delete the sample rows once
   you have your own.
4. Save As → **CSV (Comma delimited)** in Excel, or
   **File → Download → CSV** in Sheets.
5. Click **Import CSV** in the question bank UI and pick the file.

XLSX upload also works if you'd rather not convert.

---

## API reference (for integrations)

| Method | URL | Notes |
|---|---|---|
| `GET`  | `/api/questions/import/template` | Returns the CSV template as an attachment. Role: `SUPER_ADMIN`, `MASTER_PROCTOR`, `EXAM_SETUP_MASTER`. |
| `POST` | `/api/questions/import` | Multipart upload. Fields: `file` (CSV/XLSX), `assessmentTypeId` (required). Returns `{ success: number, errors: [{row, error, questionText}] }`. |

Both endpoints require a valid JWT and one of the roles above.

---

## What the importer does NOT do

- It does **not** auto-activate imported questions. Every imported
  question lands as `DRAFT`. Use **Activate Drafts** in the same
  page to move them to `ACTIVE`.
- It does **not** deduplicate. Importing the same file twice creates
  two copies. Track your imports.
- It does **not** validate question quality (only structure). A
  well-formed but content-wrong question imports successfully — that's
  what the review/activation step is for.
- It does **not** upload images. Image-based questions need to be
  added via the **Add Question** form, which has an image upload
  field.
