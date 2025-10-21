# One-Click Bug Report MVP — Context for Cursor (Read Only)

Status: Planning and incremental build.  
Action: Do not write code from this file. Read and acknowledge. Wait for explicit step instructions.

## 1) What we are building
A minimal one click bug reporting product inspired by Jam.dev. A single script tag adds a floating button and a modal. Submissions go to a small backend that stores a bug and enqueues a background job. A worker picks the job, runs an AI analysis, and writes back an analysis plus an optional unified diff patch and a confidence score.

## 2) Why this exists
We need a production quality MVP that is fast to set up, stable to demo, and clean to review. Scope is strict to avoid overruns. Optional integrations are not in scope.

## 3) In scope for MVP
- Client snippet: floating button, modal, telemetry capture, optional screenshot
- Backend API: create bug, list bugs, get bug by id
- Storage: SQLite via Prisma with migrations and a seed
- Background worker: polling loop, AI provider abstraction, deterministic fallback if no API key
- Simple token model: public key in payload, secret header for writes
- Tiny demo pages to validate end to end and record a Loom

## 4) Out of scope for MVP
- GitHub App or real PR creation
- Auth UI, dashboards, roles, multi tenant UX
- Third party tools like Linear, Datadog, PostHog
- Heavy screenshot or file uploads

## 5) Monorepo layout
- `packages/snippet`: browser IIFE bundle `bugger.min.js`
- `packages/server`: Express API, Prisma, SQLite, static file serving, demo pages
- `packages/worker`: Node worker that polls the DB and calls AI

## 6) Data model
**Project**
- id (cuid) primary key
- name, publicKey unique, secretKey unique
- createdAt

**Bug**
- id (cuid) primary key
- title, steps, expected, actual, severity
- url, userAgent
- viewport JSON, consoleLogs JSON optional, networkErrors JSON optional
- screenshotDataUrl optional
- status: new, queued, analyzing, analyzed, error
- aiAnalysis optional markdown
- aiPatchDiff optional unified diff text
- confidence optional float
- createdAt, projectId FK to Project
- indexes on status, severity, createdAt, projectId

**Job**
- id (cuid) primary key
- type string, payload JSON
- status: queued, processing, done, error
- error optional, createdAt, updatedAt
- indexes on status, type, createdAt

## 7) Token rules
- Client payload includes `projectPublicKey`
- Header `x-bugger-key` must match the same Project.secretKey for writes
- For the demo page only, we may use the secret in fetch headers. This is for demo only

## 8) API surface
- `POST /api/bugs`  
  Auth header `x-bugger-key`, payload validated against CreateBugPayload. Creates Bug with status queued and enqueues Job ANALYZE_BUG. Returns `{ id, status: "queued" }`.
- `GET /api/bugs`  
  Auth header required. Optional filters `status`, `severity`, `from`, `to`. Returns only that Project's bugs.
- `GET /api/bugs/:id`  
  Auth header required. Returns the full bug record.
- Static
  - `/cdn/bugger.min.js` serves the built snippet
- Demo helpers
  - `/demo` simple testing page
  - `/demo-404` endpoint that returns 404 to trigger network error capture
  - `/bugs/:id/view` read only bug viewer

## 9) Snippet behavior
- One script tag usage:
  ```html
  <script src="http://localhost:8787/cdn/bugger.min.js"
          data-bugger-key="public_demo_key"
          data-bugger-origin="http://localhost:8787"></script>
Shows a floating, draggable button

Modal fields: title, steps, expected, actual, severity

Telemetry auto captured:

URL, userAgent, viewport

Last 20 console logs (log, warn, error)

Failed fetch or XHR entries with url, status, method, timestamp

Optional screenshot on submit via lazy html2canvas

On submit, POST payload and show a toast with the created id

10) Worker behavior
Poll every 5 seconds for one queued ANALYZE_BUG Job

Mark processing atomically to avoid races

Load Bug and Project

Build a thin code context list by scanning repo paths. File names only, top 30 by keyword and URL overlap

Provider selects Anthropic if key is set, otherwise fallback

Provider returns:

analysis markdown, under 250 words

a single unified diff or the literal string NONE

confidence float 0..1

Worker stores aiAnalysis, aiPatchDiff (or null), confidence, sets bug status to analyzed, marks job done

11) Validation and contracts
Shared contracts define:

BugSeverity: low, medium, high, critical

Viewport, ConsoleLog, NetworkError

CreateBugPayload fields

BugRecord fields

ListBugsQuery filters

Use Zod for schema validation in the server

12) Environment and scripts
.env.example in server:

DATABASE_URL="file:./prisma/dev.db"

PORT=8787

FALLBACK_AI=true

ANTHROPIC_API_KEY= optional

Root scripts typically include:

setup to migrate and seed

dev:server and dev:worker

build and start:* variants

13) Current status
Step 1 scaffold complete

Step 2 shared contracts wired

Step 3 Prisma schema, migration, and seed complete

Step 4 API routes and token rules complete

Step 5 snippet complete

Step 6 worker poller complete

Step 7 demo pages complete

Step 8 polish, tests, and submission kit complete

14) Step 7 demo pages acceptance targets
/demo shows the floating button, a fake error button, a 404 button, and a Recent Bugs panel that auto refreshes and links to /bugs/:id/view

Posting a bug flips from queued to analyzed within a few seconds

/bugs/:id/view renders all fields, sanitizes markdown, shows confidence and diff if present

15) Security notes
The secret header must not be exposed in production pages. Demo page only can include it for fetch calls, with a clear warning

Rate limit POST to reduce abuse in a public demo

Error messages should be generic and must not leak which credential failed

16) Performance and reliability
Snippet bundle target under 20 KB without html2canvas

Worker processes at most one job per poll cycle

Job selection and updates are atomic to prevent double processing

If the worker is killed mid run, restart resumes safely

17) Loom checklist for submission
Start server and worker in two terminals

Open /demo. Trigger a console error and a 404, then submit a bug

Show Network tab for the POST call

Show Recent Bugs list flipping to analyzed

Open /bugs/:id/view, scroll through telemetry, analysis, confidence, and any patch diff

Show the one line script tag and remind that secrets on the demo page are for demo only

18) Working agreement for Cursor
Do not code based on this file

Wait for explicit numbered steps

Work in small edits, touch only named files, and summarize changed files when done

