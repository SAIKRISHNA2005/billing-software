# Transport & Logistics Management System (TMS) — Next.js + Google Sheets/Apps Script Edition

Rewritten from your original React+Vite+Express+Postgres plan to: **Next.js frontend, no standalone backend server, Google Sheets as the database, Google Apps Script as the entire server-side logic/API layer.**

---

# PART A — What changed and why it matters

## New architecture in one picture

```
Next.js (Render web service)  --Route Handlers (server-side proxy)-->  Google Apps Script Web App  -->  Google Sheets (data)
        |                                                        |
   Ant Design UI                                       Auth, numbering, PDF (Docs API),
   TanStack Query                                       Excel export, business rules,
   React Hook Form + Zod                                 all validation, LockService
```

- **There is no Node/Express/Postgres/Prisma layer anymore.** The Apps Script Web App *is* the backend: it validates input, checks the session, generates numbers, writes to Sheets, builds PDFs, and returns JSON.
- **Next.js never talks to Apps Script from the browser.** Browser → Next.js Route Handler (server-side) → Apps Script `exec` URL. This keeps the Apps Script URL and its secret key off the client, lets Next.js set a real `httpOnly` session cookie (Apps Script cannot set cookies on your domain), and avoids CORS pain.
- **Google Sheets replaces PostgreSQL.** One spreadsheet = the whole database. One sheet (tab) = one table. Rows = records. A hidden `_meta` column pattern (`id`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy`, `updatedBy`) is kept on every business sheet, same as before.
- **"Excel export" is now almost free** — the database already *is* a spreadsheet. What used to be "auto-regenerate a protected Excel file" becomes "share this Sheet as view-only" plus an on-demand `.xlsx` snapshot export for people who want a downloadable file.
- **Single user, single role.** There is exactly one person using this app. Every Admin/Staff/Accounts role split, permission matrix, and user-management screen from the original plan is dropped — replaced with one login (so the deployed URL isn't wide open to strangers) and zero permission checks beyond "is this a valid session." Anything the original plan gated by role (deleting, moving a stage backwards, editing a processed bill, exporting Excel) is simply always allowed to the one user.

## Read this before anything else — real limits of this stack

Be upfront with yourself (and the AI IDE) about what you're trading away versus Postgres+Express:

1. **No real transactions.** Apps Script has `LockService` (a script-wide mutex), not row-level DB transactions. Every "must not duplicate" operation (bill numbers, enquiry numbers, transaction numbers) must acquire `LockService.getScriptLock()`, do its read-modify-write, then release — every single time, no exceptions.
2. **Quotas are real.** Apps Script execution time is capped per execution (~6 minutes), and Google enforces daily quotas on URL Fetch calls, triggers, and email. Bulk operations (e.g., regenerating a 20,000-row Excel export) must be written to stay well inside these limits — batch `getValues()`/`setValues()` calls, never loop cell-by-cell.
3. **Concurrency and scale are limited.** Sheets is not built for many simultaneous writers or huge tables. With a single user this is a non-issue for concurrency, but row-count/quota limits still apply as the years of data pile up. Say so explicitly in `docs/ASSUMPTIONS.md`.
4. **No native auth library.** Session handling and password hashing (salted SHA-256 via `Utilities.computeDigest`, since bcrypt isn't available) are hand-built inside Apps Script. With a single user there is no role matrix to build, but you still need a real login so the app isn't wide open to anyone who finds the URL.
5. **PDF generation goes through Google Docs**, not PDFKit: a template Google Doc with merge tags, filled by Apps Script, exported to PDF. Layout control is good but different from PDFKit's pixel-level drawing.
6. **"Locked" Excel can't carry a file password.** Apps Script cannot set an `.xlsx` open-password on an exported file. The real protection is Google Sheets' own protected ranges/sheets plus Drive sharing permissions (view/comment-only). Note this as a changed requirement, not a bug.
7. **Render, not Vercel.** Next.js runs on Render as a standard **Node web service** (`next build` + `next start`), not as edge/serverless functions — Route Handlers behave like normal long-lived server routes, which is actually simpler to reason about than Vercel's per-request functions. On Render's free/low tiers the service can spin down when idle and take a few seconds to wake on the next request (cold start) — mention this to users if login feels slow after inactivity, and consider Render's paid "always on" tier if that's unacceptable.

If any of these six points is a dealbreaker for your actual business needs (very high concurrent write volume, must-have password-protected Excel, strict ACID billing transactions), say so now — Phase 1 is where you'd flip back to a real database.

---

# PART B — Tech stack and phase map (updated)

## Tech stack (fixed)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | Server-rendered pages, Route Handlers double as the API proxy layer |
| UI library | Ant Design 5 | Same as before — tables, forms, date pickers |
| Data fetching | TanStack Query + Axios | Calls Next.js Route Handlers only, never Apps Script directly |
| Forms | React Hook Form + Zod | Same validation approach, duplicated server-side in Apps Script |
| "Backend" | Google Apps Script (V8 runtime) Web App, deployed with `clasp` | All business logic, numbering, auth, PDF, Excel |
| Database | Google Sheets (one spreadsheet, one sheet per table) | Matches "no backend/DB to host" requirement |
| Session layer | Next.js Route Handlers set `httpOnly` cookies; Apps Script issues/validates opaque session tokens stored in a `Sessions` sheet | Apps Script can't set cookies on your app's domain |
| Concurrency control | `LockService.getScriptLock()` | Stands in for DB row locks/transactions |
| PDF | Google Docs API (template doc + merge tags) via Apps Script, exported to PDF | No PDFKit; Drive holds the template |
| Excel | Native Google Sheets (source of truth) + Apps Script-driven `.xlsx` snapshot export | Sheets IS the "auto-updating workbook" |
| Charts | Recharts | Unchanged |
| Tests | Vitest + Testing Library (Next.js), a small custom GAS assertion harness (Apps Script), Playwright (end-to-end against a test spreadsheet + test deployment) | Apps Script has no native test runner |
| Local dev tooling | `clasp` (Google's Apps Script CLI) for pushing script code and managing deployments; no Docker | No local database to containerize |

## Phase map (same 22 phases, same order — only *what's inside* each phase changes)

| Phase | Name | What you get now | Depends on |
|---|---|---|---|
| 0 | Manual setup | Repo, Google Sheet + Apps Script project created, `clasp` linked, project details saved | — |
| 1 | Rules + business freeze | `AI_RULES.md` + design docs updated for the new stack | 0 |
| 2 | Scaffolding | Empty but running Next.js app; empty Apps Script Web App that responds to a health check; Sheets skeleton (tabs + headers only) | 1 |
| 3 | "Database" | All Sheets tabs with headers, Apps Script data-access layer, financial-year helper, seed function | 2 |
| 4 | Auth + app shell | Single-user login via Apps Script + Next.js cookie proxy, menu (no role gating) | 3 |
| 5 | Master data | Companies, clients, vendors, vehicles, drivers — CRUD via Apps Script actions | 4 |
| 6 | Enquiry logic | Apps Script actions: auto numbers (LockService), stages, movement | 5 |
| 7 | Enquiry frontend | Add/View/Edit Enquiry pages (Next.js) | 6 |
| 8 | Operations | Vehicle Movement, Pending Jobs, Completed Jobs | 7 |
| 9 | Expenses | Loading + General expenses, auto-sync from enquiry | 8 |
| 10 | Vendors | Vendor payments, vendor pending, Vendor Report | 9 |
| 11 | Settings | Company profile, seal/signature (Drive-hosted images), numbering | 10 |
| 12 | Billing logic | Pending bills, FY bill numbers (LockService), processed bills | 11 |
| 13 | Billing frontend | Pending Bills, Create Bill, Processed Bills pages | 12 |
| 14 | Bill PDF | Google Docs template → merge → PDF, with seal area | 13 |
| 15 | Payment tracking | Client payments, paid/balance/status | 14 |
| 16 | Reports | Daily, Company-wise, Billing reports | 15 |
| 17 | Excel export + sharing lock | Protected Sheet ranges/sharing + on-demand `.xlsx` snapshot | 16 |
| 18 | Dashboard | Cards, recent bills, Recharts charts | 17 |
| 19 | Polish + security | UX cleanup, session/rate-limit hardening, quota-aware batching | 18 |
| 20 | Testing | Vitest, GAS test harness, Playwright e2e | 19 |
| 21 | Final audit + deploy | Requirement audit, Render + Apps Script deployment, README | 20 |

---

# PART C — Helper prompts (unchanged usage, same rules)

### Continue prompt
```text
Read AI_RULES.md and docs/PROGRESS.md. You stopped in the middle of the current phase. Check what is already done, finish only the remaining work of this phase, then follow the finishing steps in AI_RULES.md rule R10. Do NOT run any git command.
```

### Fix prompt
```text
Read AI_RULES.md first. Do NOT run any git command.
Something is broken. Here is the exact error / wrong behaviour:
<PASTE ERROR OR DESCRIBE WHAT YOU SEE HERE>
Find the ROOT cause (do not hide the error), fix it properly, add a test if it is logic-related, run build + lint + tests, and tell me what was wrong and what you changed. Do not change unrelated code.
```

### Verify prompt
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md, docs/REQUIREMENTS_CHECKLIST.md and docs/PROGRESS.md. Do NOT run any git command.
Review the work of the phase I just finished. Start the app, test every feature of that phase end to end, and list: (1) what works, (2) what is missing or broken compared to PROJECT_DETAILS.md, (3) any placeholder/TODO/mock code. Fix everything you find in this phase only, then report.
```

---

# PART D — The phases

---

## PHASE 0 — Manual setup (you do this, no AI)

**Do this by hand**
1. Create a folder, e.g. `transport-logistics-system`, with `docs/` and `docs/reference-screenshots/`.
2. Paste your project details into `docs/PROJECT_DETAILS.md`.
3. Create a new Google Sheet (this is your database) and a bound or standalone Apps Script project for it. Note the Spreadsheet ID.
4. Install `clasp` (`npm i -g @google/clasp`), run `clasp login`, and `clasp clone <scriptId>` (or `clasp create`) into an `/appsscript` folder in your repo so the script code is version-controlled like everything else.
5. Create a second, throwaway "TEST" copy of the spreadsheet + a test Apps Script deployment for Phase 20's end-to-end tests, so tests never touch real data.
6. Run `git init` yourself.

**Commit message**
```text
chore: initial commit with project details, reference screenshots, Sheet and clasp project
```

---

## PHASE 1 — Rules file + business freeze (documents only, no app code)

**Prompt**
```text
You are a senior software architect starting a NEW project: a Transport & Logistics Management System (TMS), built on Next.js + Google Sheets/Apps Script (no separate backend server, no relational database).

GIT RULE: Do NOT run any git command. I do all git actions manually.

Read docs/PROJECT_DETAILS.md completely — single source of truth. Images in docs/reference-screenshots/ are reference only.

THIS PHASE CREATES DOCUMENTS ONLY. No application code, no packages installed.

STEP 1 - Create AI_RULES.md with these permanent rules:
R1  Never run git commands. I do git manually.
R2  Before any work, read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/. PROJECT_DETAILS.md wins on conflict.
R3  Do ONLY the current phase. No stubs, TODOs, mock data, or half-working buttons. Everything built must work end to end. Future-phase menu items may show "Coming in a later phase" (list in docs/PROGRESS.md).
R4  Fixed stack: Next.js 14 (App Router) + TypeScript + Ant Design 5 + TanStack Query + Axios + React Hook Form + Zod (frontend, in /web); Google Apps Script (V8 runtime), managed with clasp, deployed as a Web App, is the entire server side (in /appsscript); Google Sheets is the database (one spreadsheet, one sheet per table); Google Docs API (via Apps Script) for PDFs; native Google Sheets + on-demand xlsx export for Excel; Recharts for charts; Vitest + Testing Library for frontend unit tests, a custom Apps Script assertion harness for script logic, Playwright for end-to-end. Do not change the stack, and do not introduce a separate Node/Express server or any SQL database.
R5  Folders: /web (Next.js app, feature-organised), /appsscript (all .gs/.ts script files, one file per module: Auth.gs, Enquiry.gs, Billing.gs, etc.), /docs. The Next.js app never calls the Apps Script exec URL from the browser — only from Route Handlers under /web/app/api/**.
R6  Code quality: TypeScript strict in /web, no `any`; ESLint + Prettier; Zod validation of every Route Handler input AND re-validated inside Apps Script (never trust the client, and never trust that the proxy is the only caller); one standard response shape {success, data, message, errors}; correct HTTP status codes; pagination + search + filter + sort on every list action.
R7  Security: single user, no role matrix — but every Apps Script action still checks for a valid, unexpired session SERVER-SIDE (never trust that only the UI calls it); a shared secret header between Next.js Route Handlers and the Apps Script Web App so it can't be called by anyone else; session tokens are opaque random strings stored in a Sessions sheet with expiry, set as httpOnly secure cookies by Next.js; the password is salted + hashed with Utilities.computeDigest (SHA-256); login rate limiting; no secrets committed (use .env.local in /web and Script Properties in Apps Script); keep .env.example updated.
R8  Data rules: money stored as numbers with 2 decimal places, shown as Indian rupees like Rs 1,85,000.00; dates DD-MM-YYYY; times 12-hour AM/PM; timezone Asia/Kolkata; soft delete via a deletedAt column; every business sheet has id, createdAt, updatedAt columns (createdBy/updatedBy are optional since there's only one user).
R9  UI rules: Ant Design, responsive, loading + empty + error states everywhere, confirm before delete, toasts, validated forms, tables with search + filters + pagination. No role-based menu hiding — the one user sees everything.
R10 FINISHING STEPS after every phase: run build, lint and tests (both /web and /appsscript where applicable) and fix all errors; update docs/PROGRESS.md; tick finished items in docs/REQUIREMENTS_CHECKLIST.md; reply with (a) files created/changed, (b) how to run, (c) how I can test it by hand, (d) anything not finished.
R11 If unclear, choose the simplest option matching PROJECT_DETAILS.md and write it in docs/ASSUMPTIONS.md. Do not invent extra features.
R12 Do not rewrite earlier-phase code unless needed; say what and why if you do.
R13 Every write to the Sheets that must not duplicate a generated number (enquiry no, transaction no, bill no) MUST use LockService.getScriptLock() around the read-increment-write.
R14 Never loop row-by-row over the Sheet with individual getValue/setValue calls for anything that touches more than ~20 rows — always batch with getValues()/setValues() to respect Apps Script quotas.

STEP 2 - Create in docs/ (same 8 documents as a traditional-backend plan, adjusted content):
1) BUSINESS_WORKFLOW.md — same business flow explanation as before, using your PROJECT_DETAILS.md example.
2) DATABASE_DESIGN.md — but as a SHEETS DESIGN: one section per sheet/tab (same entity list as a relational design would have: users, companies, clients, vendors, vehicles, drivers, containers, enquiries, movements, stage_history, loading_expenses, general_expenses, bills, bill_items, bill_payments, vendor_payments, number_sequences, app_settings, audit_logs, sessions), each with an exact column list, column order, and data type, since Sheets has no schema enforcement — the column list IS the schema. Include a diagram of how sheets relate via id columns.
3) AUTH.md — replaces ROLES_PERMISSIONS.md: this is a single-user app, so there is no role matrix. Document instead: how the one login is created/stored (seeded once, changeable via "change password"), session token lifetime, what "no valid session" returns, and confirmation that every Apps Script action still requires a valid session even though there's only one possible user.
4) BILL_LIFECYCLE.md — same bill states/numbering rules (see decisions below), minus any role restriction on who can process/edit a bill (the one user can do all of it).
5) API_PLAN.md — list every Apps Script "action" (the Web App is called with a single doPost({action, payload, sessionToken}) shape — list each action name, purpose, request/response shape) AND every Next.js Route Handler that proxies to it.
6) REQUIREMENTS_CHECKLIST.md — numbered checklist from PROJECT_DETAILS.md, one line per requirement, with a Phase column and unticked box.
7) ASSUMPTIONS.md — decisions below, PLUS the architecture caveats about Sheets/Apps Script limits (no real transactions, quotas, scale limits, Docs-based PDF, no xlsx password) AND the single-user decision (no roles, no user management, no permission matrix) stated explicitly as accepted trade-offs.
8) PROGRESS.md — table of phases 0-21 with status.

BUSINESS DECISIONS (same as a traditional plan; use exactly these):
D1  Enquiry = one transport job. Stages: ENQUIRY_CREATED, VEHICLE_ASSIGNED, CONTAINER_MOVEMENT, PORT_MOVEMENT, COMPLETED, BILLING, PROCESSED. Forward-only by default, but the single user can move a stage backwards (with a confirm dialog, since it's a correction tool, not a role privilege).
D2  Auto numbers: Enquiry ID auto-increments (default start 10001, configurable). Transaction Number like TXN/2026-27/00001, resets each financial year. Both generated inside an Apps Script action holding LockService.getScriptLock(), reading the number_sequences sheet, incrementing, writing back, all before releasing the lock.
D3  Financial year 1 April - 31 March, written 2026-27. Bill number = <sequence>/<financial year>, e.g. 203/2026-27, per-FY sequence (default start 1, configurable), generated only when a bill is PROCESSED, under the same LockService pattern.
D4  Pending Bills = enquiries at COMPLETED not yet in a processed bill. Bill starts DRAFT (no number; enquiries move to BILLING), becomes PROCESSED (gets number; enquiries move to PROCESSED). Processed bills stay editable by the user; number never changes; every edit logged to audit_logs sheet (when, old value, new value as JSON strings in cells) so there's a history even without multiple users.
D5  One bill = one company + one client, one or more COMPLETED enquiries of that pair. Bill has line items (description + amount).
D6  Enquiry has freightAmount (Transportation Charges). Pending Bills suggests amount = freightAmount + halting amount; editable at bill creation.
D7  Vendor payable = advance + extraAdvance + diesel + haltingAmount + bonus, all stored on the enquiry row. Paid = sum of matching vendor_payments rows. Pending = payable - paid. This formula exists in exactly ONE Apps Script function, reused everywhere.
D8  Diesel/Halting on an enquiry auto-create/update a linked loading_expenses row (source=ENQUIRY, read-only in the Expenses page). Other loading expenses entered directly. Advance/bonus count only in vendor payable, not the expense ledger.
D9  Loading Expense categories: Diesel, Loading Charges, Unloading Charges, Parking, Halting, Other Trip Expenses. General Expense categories: Office Stationery, Internet, Electricity, Tea/Coffee, Maintenance, Salary-Related, Office Repairs, Other.
D10 Metric definitions: Daily Report for a date — Total Enquiries = created that date; Completed = of those, at COMPLETED or later; Pending = the rest; Bills Generated = bills processed that date; Total Billing = sum of those bills; Total Expenses = loading + general expenses dated that date. Dashboard "Today's Trips" = enquiries with any movement time today; "Today's Enquiries" = created today; "Today's Revenue" = total of bills processed today.
D11 Sheets IS the source of truth and the live "Excel". A protected/shared view of the spreadsheet is always current (no regeneration needed). A downloadable .xlsx snapshot is generated on demand via Apps Script's export endpoint, for people who want a file rather than a live Sheet link. Protection = Google Sheets protected ranges + Drive sharing set to viewer/commenter (no file-level password, since Apps Script cannot set one on an exported xlsx — record this as an accepted change from the original "password-protected Excel" idea).
D12 Validation: vehicle number uppercase letters+digits like TN04AB1234; driver number = 10-digit mobile number; container number = 4 letters + 7 digits like ABCU1234567; seal number free text.
D13 Movement Status: NOT_MOVED, MOVED. Shipping Status: PENDING, IN_PROGRESS, COMPLETED. Time order must be valid (out time not before in time).

Finish with R10 (no code this phase, just update PROGRESS.md).
```

**Check before commit**
1. `AI_RULES.md` has R1–R14.
2. `docs/` has all 8 files, with DATABASE_DESIGN.md written as a sheet-by-sheet column spec (no relational-DB language like "foreign key constraint" — Sheets has none, only id references).
3. `ASSUMPTIONS.md` states the architecture caveats and the single-user decision explicitly.
4. Compare `REQUIREMENTS_CHECKLIST.md` against your project details — nothing missing.

**Commit message**
```text
docs: add AI rules, business workflow, Sheets design, auth, bill lifecycle and requirements checklist
```

---

## PHASE 2 — Project scaffolding

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 2 - PROJECT SCAFFOLDING.

1. /web: Next.js 14 App Router + TypeScript strict. Install Ant Design 5, TanStack Query, Axios, React Hook Form, Zod, dayjs, Recharts. Set up: an Axios instance pointed at Next.js's own /api routes (never the Apps Script URL directly), a QueryClient provider, an Ant Design theme provider, a placeholder layout, shared utilities formatCurrencyINR, formatDate, formatDateTime with unit tests. Create one Route Handler /web/app/api/health/route.ts that calls the Apps Script health action and returns its result. ESLint + Prettier + Vitest + Testing Library configured. Scripts: dev, build, lint, test.
2. /appsscript: initialise via clasp with appsscript.json (V8 runtime, web app execute-as "Me", access "Anyone" but every action requires a valid shared-secret header). Create Code.gs (or Code.ts if using clasp+TypeScript) with a single doPost(e) entry point that: parses {action, payload, sessionToken}, checks a shared secret header, routes to an action handler map, wraps every response in {success, data, message, errors}, and catches all errors into a clean JSON error response (never leak a raw stack trace). Add one action: "health" → returns {ok: true, sheetConnected: true} after confirming it can open the target Spreadsheet by ID (from Script Properties).
3. Script Properties to set now (document in docs/SETUP.md, not committed): SPREADSHEET_ID, SHARED_SECRET, SESSION_TTL_MINUTES.
4. /web env vars (.env.example): APPS_SCRIPT_EXEC_URL, APPS_SCRIPT_SHARED_SECRET, SESSION_COOKIE_NAME, NODE_ENV, TZ=Asia/Kolkata.
5. Root: .gitignore (node_modules, .env*, .clasp.json if it contains secrets, dist, coverage, .next), .editorconfig, root README.md (what the project is, folder map: /web, /appsscript, /docs), root package.json with convenience scripts (dev, build, lint, test — running /web's scripts; note that /appsscript has its own clasp-based push/deploy flow, documented separately).
6. Write docs/SETUP.md: how to create the Sheet, deploy the Apps Script Web App, get its exec URL, set Script Properties and .env.local, then run /web.

Acceptance: `npm run dev` in /web starts the app; GET /api/health (Next.js) round-trips through Apps Script and shows the Sheet is reachable; build, lint and tests pass.

Follow the finishing steps in R10.
```

**Check before commit**
1. Next.js dev server starts and shows the placeholder layout.
2. `/api/health` returns success with `sheetConnected: true`.
3. No secrets are committed — only `.env.example` and a documented Script Properties list.

**Commit message**
```text
chore: scaffold Next.js app and Apps Script web app with health check
```

---

## PHASE 3 — Sheets schema, data-access layer, seed

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (especially DATABASE_DESIGN.md and ASSUMPTIONS.md). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 3 - "DATABASE" (GOOGLE SHEETS) + DATA-ACCESS LAYER.

1. In /appsscript, write a Setup.gs with a one-time-run function createAllSheets() that creates every sheet/tab listed in DATABASE_DESIGN.md with the exact header row (column order = schema), freezes the header row, and does nothing if a sheet already exists (idempotent). Sheets: users, companies, clients, vendors, vehicles, drivers, containers, enquiries, movements, stage_history, loading_expenses, general_expenses, bills, bill_items, bill_payments, vendor_payments, number_sequences, app_settings, audit_logs, sessions.
2. Write a generic data-access module SheetRepo.gs with reusable functions: getAllRows(sheetName) → array of objects keyed by header; getRowById(sheetName, id); insertRow(sheetName, obj) (auto id, createdAt, createdBy); updateRow(sheetName, id, patch) (auto updatedAt, updatedBy); softDeleteRow(sheetName, id) (sets deletedAt). All of these must batch-read with getValues() once and batch-write with setValues(), never per-cell. Use LockService.getScriptLock() around any insert/update that touches number_sequences.
3. FinancialYear.gs: getFinancialYear(date) → "2026-27" style label using the 1 April - 31 March rule, Asia/Kolkata. Write GAS test functions (in Tests_FinancialYear.gs using the custom assertion harness from R10/R14) covering 31 March 23:59, 1 April 00:00, and a leap year.
4. Seed.gs with a function seedDevData() (must check and refuse to run if a Script Property ENV=production is set) that inserts: 1 admin, 1 staff, 1 accounts user (password hashes from Script Properties SEED_*_PASSWORD, never hard-coded), the single app_settings row, sample companies (FIRST SOLAR, VALEO), clients (DHL Supply Chain, CEVA), one vendor (SPT).
5. A small custom assertion harness Tests_Harness.gs (assertEqual, assertTrue, a runAllTests() that logs pass/fail per test to the Apps Script execution log and writes a summary to a TestResults sheet) — this stands in for Vitest inside Apps Script, since Apps Script has no native test runner.
6. Update docs/DATABASE_DESIGN.md to match the final column lists exactly if anything changed.

Acceptance: running createAllSheets() then seedDevData() on the target Spreadsheet produces all 19 sheets with correct headers and sample rows; runAllTests() reports all green, including the financial-year boundary tests.

Follow the finishing steps in R10.
```

**Check before commit**
1. All 19 sheets exist with correct headers.
2. `runAllTests()` passes, financial-year boundaries included.
3. `seedDevData()` refuses to run when `ENV=production` in Script Properties.

**Commit message**
```text
feat(sheets): add sheet schema, generic data-access layer, financial year helper and dev seed
```

---

## PHASE 4 — Authentication (single user) and app shell

**Simple explanation**
- A. There's only one person using this app, so there's no role matrix, no user management screen, no "who can do what" logic. There's still a real login, so the deployed Render URL isn't open to anyone who finds it.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (especially AUTH.md). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 4 - AUTH (SINGLE USER) + APP SHELL.

APPS SCRIPT (/appsscript):
1. Auth.gs actions: "login" (email+password → checks the single row in the users sheet, verifies salted SHA-256 hash, creates a row in sessions with a random token + expiry, returns {token, user}); "logout" (deletes the session row); "me" (validates token, returns user); "changePassword". Rate-limit login attempts using CacheService (e.g., lock out after 5 fails in 10 minutes) — this still matters precisely because it's internet-exposed with one account.
2. Session.gs: a single requireSession(sessionToken) helper that every other action handler calls first (checks the token exists in sessions and hasn't expired). There is no permission map, no role check — a valid session can do everything, since there is only ever one user.
3. Audit.gs: a reusable writeAuditLog(entity, entityId, action, oldValue, newValue) appending to the audit_logs sheet (JSON-stringify old/new values, timestamp only — no userId needed with a single user, but keep the column for future-proofing).
4. GAS tests: login success/failure, wrong password, expired session rejected, rate limiting kicks in after repeated failures.

NEXT.JS (/web):
1. Route Handlers under /app/api/auth/*: login (calls Apps Script "login", then sets an httpOnly secure cookie holding the session token — the token itself, not a Next.js-issued one, so Apps Script remains the source of truth), logout, me. All other /app/api/** Route Handlers read the cookie, forward the token to Apps Script as sessionToken, and never let the browser see the Apps Script URL or shared secret.
2. Login page, auth context/provider, protected route layout, automatic redirect to /login on a 401 from any Route Handler.
3. App shell: sidebar + header (name, logout, change password) — no role indicator needed. Sidebar menu exactly:
   Dashboard | Enquiries (Add Enquiry, View / Edit Enquiry) | Operations (Vehicle Movement, Pending Jobs, Completed Jobs) | Expenses (Loading Expenses, General Expenses) | Billing (Pending Bills, Create Bill, Processed Bills) | Vendors (Vendor List, Vendor Payments, Vendor Report) | Reports (Daily Report, Company Report, Vendor Report, Billing Report) | Exports (Excel, PDF) | Settings (Master Data, Company Profile, Audit Log).
   No items hidden — the one user sees the full menu. Routes are still guarded (redirect to /login if not authenticated), just not by role.
4. Future-phase menu pages show "Coming in a later phase", tracked in docs/PROGRESS.md.
5. Update docs/API_PLAN.md and docs/SETUP.md (how the one login is seeded, and how to change the password).

Acceptance: log in with the one seeded account; every menu item and API action is reachable; a direct fetch to a Route Handler without a valid session cookie returns 401; logging out and hitting any Route Handler again also returns 401.

Follow the finishing steps in R10.
```

**Check before commit**
1. Login works; wrong password fails cleanly; 5 wrong attempts triggers the lockout.
2. Refreshing the page keeps you logged in (cookie persists); logout clears both the cookie and the Sessions sheet row.
3. Every menu item is visible and reachable — nothing hidden.

**Commit message**
```text
feat(auth): add single-user Apps Script auth with Next.js cookie proxy and app shell
```

---

## PHASE 5 — Master data

**Simple explanation**
- A. Master data = things that repeat in every job: companies, clients, vendors, vehicles, drivers.
- B. Users pick them from dropdowns instead of typing again (enter once, use everywhere).
- C. Containers are created automatically from enquiries later.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 5 - MASTER DATA.

APPS SCRIPT (/appsscript, MasterData.gs — one action group per entity: companies, clients, vendors, vehicles, drivers):
1. Actions "<entity>.list" (search, pagination, sort, active/inactive filter), "<entity>.get", "<entity>.create", "<entity>.update", "<entity>.deactivate" — all call requireSession first. Validation as per D12 (vehicle number uppercase pattern, 10-digit driver number). Unique names/numbers with clear error messages, case-insensitive uniqueness check, checked with a batched read of the sheet (never a per-row lookup loop).
2. A record already referenced by an enquiry/bill cannot be hard-deleted, only deactivated (soft flag column `active`). Deactivated records are excluded from lookups but still resolve correctly on old enquiries/bills.
3. Lightweight "<entity>.lookup" actions for dropdowns (id + label, search-as-you-type, limit 20) for companies, clients, vendors, vehicles, drivers, containers.
4. writeAuditLog on create/update/deactivate.
5. GAS tests for validation, uniqueness and the "in use, can't delete" rule.

NEXT.JS (/web): under Settings > Master Data, one tab per entity (Companies, Clients, Vendors, Vehicles, Drivers) using a reusable generic CRUD table + drawer form component (do not copy-paste five times) calling a single generic Route Handler pattern /app/api/master/[entity]/route.ts. Also build the Vendors > Vendor List page using the same vendors lookups. Reusable async-search Select component (used later in the Enquiry form) with an "+ Add new" inline action.

Follow the finishing steps in R10.
```

**Check before commit**
1. Add a duplicate company name → clear error.
2. Add vehicle `tn04ab1234` → saved as `TN04AB1234`.
3. Deactivate a vehicle used on an old enquiry → old enquiry still shows it correctly; it disappears from the "add enquiry" dropdown.

**Commit message**
```text
feat(master): add companies, clients, vendors, vehicles and drivers management
```

---

## PHASE 6 — Enquiry logic (Apps Script)

**Simple explanation**
- A. Enquiry = one transport job. It is the most important thing in the app.
- B. This phase builds all rules inside Apps Script: numbering, sections, stages, movement.
- C. The stage flow is: Created → Vehicle Assigned → Container Movement → Port Movement → Completed → Billing → Processed.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (especially BUSINESS_WORKFLOW.md, D1, D2, D12, D13). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 6 - ENQUIRY LOGIC (Enquiry.gs).

The enquiry has these sections (all fields from PROJECT_DETAILS.md must exist as columns on the enquiries sheet, plus a linked row on the movements sheet):
A. Basic: Enquiry ID, Transaction Number, Creation Date, Company, Client, Loading Type (Import/Export).
B. Vehicle: Vehicle Number, Driver Number, Container Number, Seal Number.
C. Movement: Company In Time, Company Out Time, Print In Time, Print Out Time, Port In Time, Port Out Time, Movement Status, Shipping Status.
D. Money: Diesel, Advance, Halting Days, Halting Amount, Bonus, extra advance, freightAmount.
E. Vendor: Vendor (optional) with the vendor money above.

Build these actions:
1. "enquiry.create": creates the enquiry row and its movement row together (write both sheets inside the same Apps Script execution, so a mid-way failure never leaves an enquiry without a movement row — if the movement write fails, delete the enquiry row you just wrote before returning the error, since there is no real cross-sheet transaction). Enquiry ID and Transaction Number are generated from the number_sequences sheet INSIDE `LockService.getScriptLock()` (acquire → read current value → increment → write back → release), so two rapid calls never collide even though there's only one user. Vehicle, driver and container can be sent as plain numbers: find-or-create them (validated by D12). Stage starts at ENQUIRY_CREATED.
2. "enquiry.list": pagination, sort, search (enquiry no, transaction no, vehicle, container, driver), filters (date range, company, client, loading type, stage, vendor, movement status, shipping status) — implemented as one batched `getValues()` read plus in-memory filter/sort/paginate (never a per-row API round trip).
3. "enquiry.get" (full detail incl. movement, vendor, stage history), "enquiry.update", "enquiry.delete" (soft delete, blocked if the enquiry is already in a bill).
4. "enquiry.updateMovement": update the six times + movement status + shipping status. Validate time order (D13).
5. "enquiry.moveStage" {id, toStage}: moves ONE stage forward with rules: VEHICLE_ASSIGNED needs vehicle + driver; CONTAINER_MOVEMENT needs container number; PORT_MOVEMENT needs company out time; COMPLETED needs port out time and sets shippingStatus=COMPLETED, movementStatus=MOVED and completedAt. BILLING and PROCESSED can only be set by the billing module's own actions (reject direct calls to moveStage for these). Backward moves are allowed (single user, no role gate) but never out of BILLING/PROCESSED, and always require a confirm on the frontend. Every change is written to stage_history and audit_logs.
6. Computed values (vendor total payable, D7) come from ONE shared Apps Script function `VendorFinance.gs::computeVendorPayable(enquiry)`, reused by every action that needs it — never recompute the formula inline in more than one place.
7. GAS tests: rapid-fire numbering (call enquiry.create twice back-to-back and assert different numbers — this is what actually exercises LockService, since there's no real concurrent user), stage rules, validations, soft delete, FY change on transaction number.

Update docs/API_PLAN.md.

Follow the finishing steps in R10.
```

**Check before commit**
1. Create 2 enquiries → Enquiry IDs 10001, 10002 (or your configured start) and different TXN numbers.
2. Try to jump stage without vehicle → clear error.
3. GAS tests for numbering pass.

**Commit message**
```text
feat(enquiry): add enquiry logic with auto numbering, movement and stage workflow
```

---

## PHASE 7 — Enquiry frontend

**Simple explanation**
- A. The screens you'll use all day: Add Enquiry and View / Edit Enquiry.
- B. The form is split into the same sections as your project details, so it feels natural.
- C. A stage bar shows exactly where the job is.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 7 - ENQUIRY FRONTEND (Next.js pages calling Route Handlers that proxy the Phase 6 Apps Script actions).

1. Enquiries > Add Enquiry page (/web/app/(app)/enquiries/new): a clean sectioned form with sections A Basic, B Vehicle, C Movement, D Money, E Vendor exactly as in PROJECT_DETAILS.md (all fields). Company/Client/Vendor use the async-search Select; Vehicle, Driver and Container are type-ahead inputs that pick an existing record or create it automatically. Enquiry ID and Transaction Number are NOT typed: show them as read-only after saving. Loading Type is Import/Export. Date-time pickers for the six movement times with a "Set now" button. Money fields use INR formatting and never accept negatives. Show live "Vendor total payable" as the user types, using a small TypeScript function that mirrors `computeVendorPayable` from Apps Script exactly (with a unit test comparing both against the same fixtures, so they can never silently drift apart).
2. Enquiries > View / Edit Enquiry page: a table with columns Enquiry ID, Transaction No, Date, Company, Client, Type, Vehicle, Container, Driver, Stage, Movement Status, Shipping Status. Search box, filters (date range, company, client, import/export, stage, vendor), pagination, sort, row actions View / Edit / Delete.
3. Enquiry detail page with a stage stepper (7 stages), a "Move to next stage" button showing the missing requirement if the backend rejects it, and a "Move back a stage" action behind a confirm dialog, and tabs: Basic, Vehicle, Movement, Money, Vendor, History (stage history). Leave no fake tabs: Expenses and Bill tabs come in later phases.
4. Editing is blocked (read-only) once the stage is BILLING or PROCESSED for fields that affect billing, with an "edit anyway" override behind a confirm (single user — no role gate needed, just a deliberate friction point so you don't accidentally edit a billed job).
5. Unsaved-changes warning, inline validation, loading/empty/error states, responsive layout.
6. Component tests for the form validation and the vendor total function.

Follow the finishing steps in R10.
```

**Check before commit**
1. Create an enquiry with all sections, reopen it, values are the same.
2. Stage stepper moves forward; error message shows when data is missing.
3. Filters and search give correct rows.

**Commit message**
```text
feat(enquiry-ui): add enquiry form, list, detail page and stage stepper
```

---

## PHASE 8 — Operations

**Simple explanation**
- A. Operations = daily control room for vehicles and jobs.
- B. Three pages: Vehicle Movement, Pending Jobs, Completed Jobs.
- C. Update in/out times quickly here without opening the full form.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 8 - OPERATIONS.

APPS SCRIPT: add operation-oriented actions on top of Enquiry.gs (reuse `enquiry.list` filtering logic, do not duplicate it): "operations.movements" (enquiries at stages VEHICLE_ASSIGNED to PORT_MOVEMENT), "operations.pending" (all stages before COMPLETED), "operations.completed" (stage COMPLETED or later). Each supports date range, company, client, loading type, vendor, vehicle, container search, pagination, sort, and returns the movement times and statuses.

NEXT.JS:
1. Operations > Vehicle Movement page: a compact table with inline quick-edit for the six times and the two statuses, calling "enquiry.updateMovement" directly from the row (no need to open the full enquiry).
2. Operations > Pending Jobs page: list with a "Mark Completed" quick action calling "enquiry.moveStage" when the rules allow it, with clear error messages when they don't.
3. Operations > Completed Jobs page: read-only list with a link into the enquiry detail and its Bill tab (once Phase 13 exists).
4. Tests for the operation queries and quick-edit flows.

Follow the finishing steps in R10.
```

**Check before commit**
1. Update times from Vehicle Movement; values appear in the enquiry detail too.
2. Completing a job moves it from Pending Jobs to Completed Jobs.

**Commit message**
```text
feat(operations): add vehicle movement, pending jobs and completed jobs pages
```

---

## PHASE 9 — Expenses

**Simple explanation**
- A. Two kinds of expenses: **Loading Expenses** (tied to a job/vehicle) and **General Expenses** (office costs).
- B. Diesel and halting typed on the enquiry are automatically added as expenses, so nobody types them twice.
- C. Later, reports use these numbers for "Total Expenses".

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (D8, D9). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 9 - EXPENSES.

APPS SCRIPT (Expenses.gs):
1. Loading Expenses actions (list/get/create/update/delete): expense date, category (Diesel, Loading Charges, Unloading Charges, Parking, Halting, Other Trip Expenses), amount, description, linked enquiry and/or vehicle (if an enquiry is chosen, its vehicle is filled automatically). Filters: date range, category, enquiry, vehicle, company, client. Totals returned with the list.
2. General Expenses actions: date, category (Office Stationery, Internet, Electricity, Tea/Coffee, Maintenance, Salary-Related, Office Repairs, Other), amount, description. Filters and totals.
3. Auto-sync rule D8: inside "enquiry.create" and "enquiry.update" (Phase 6), after saving the enquiry, call a shared `syncEnquiryExpenses(enquiry)` function in Expenses.gs that creates/updates/removes exactly one linked loading-expense row each for diesel and halting (source = ENQUIRY, dated with the enquiry date). ENQUIRY-sourced rows are rejected by "loadingExpense.update"/"loadingExpense.delete" (clear error: "Edit this from the enquiry").
4. writeAuditLog on all changes. GAS tests for the sync logic (create, change, set to zero, delete enquiry).

NEXT.JS:
1. Expenses > Loading Expenses and Expenses > General Expenses pages: table, filters, totals row, add/edit drawer, delete with confirm. ENQUIRY-sourced rows show a lock icon and link to the enquiry.
2. Add the "Expenses" tab on the enquiry detail page (list + quick add of loading expenses for that enquiry).

Follow the finishing steps in R10.
```

**Check before commit**
1. Save an enquiry with diesel ₹3,000 → a Diesel loading expense of ₹3,000 appears automatically once.
2. Change diesel to ₹3,500 → the same row updates (no duplicate).
3. General expense add/edit/delete works with correct totals.

**Commit message**
```text
feat(expenses): add loading and general expenses with automatic enquiry expense sync
```

---

## PHASE 10 — Vendors (payments, pending, Vendor Report)

**Simple explanation**
- A. Vendor = the provider who actually runs the vehicle.
- B. We track: advance, extra advance, diesel, halting, total to pay, already paid, still pending.
- C. The Vendor Report gives these totals per vendor.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (D7). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 10 - VENDORS.

APPS SCRIPT (Vendor.gs):
1. "vendorPayment.create/update/delete/list": vendor, optional enquiry, payment date, amount, mode (Cash, Bank Transfer, Cheque, UPI, Other), reference, notes. Payment amount must be greater than 0. Warn (do not block) when paying more than the pending amount — return a warning flag in the response. writeAuditLog on every change.
2. "vendor.trips" {vendorId}: per vendor, list enquiries with vehicle, container, advance, extra advance, diesel, halting, bonus, total payable, paid, pending — using `computeVendorPayable` from Phase 6, never a second copy of the formula. Paid per enquiry = payments linked to that enquiry; payments with no enquiry count towards the vendor total and are shown as "unallocated".
3. "vendor.report": for each vendor → Vehicles (distinct count), Trips, Advance, Diesel, Halting, Extra Advance, Bonus, Total Amount, Paid, Pending. Filters: date range, vendor, company, client, loading type. Grand totals row, computed with a single batched pass over the enquiries + vendor_payments sheets.
4. GAS tests for the totals with several trips and payments, including partial payment and unallocated payment.

NEXT.JS:
1. Vendors > Vendor Payments page (list, add, edit, delete, filters).
2. Vendor detail page (opened from Vendor List): summary cards (Total, Paid, Pending), trips table, payments table.
3. Vendors > Vendor Report page with filters and totals (this same page is also the Reports > Vendor Report menu item). Exports come in Phase 17.
4. Add the "Vendor" figures (total payable, paid, pending) to the enquiry detail Vendor tab.

Follow the finishing steps in R10.
```

**Check before commit**
1. Vendor SPT with trips totalling ₹1,45,000 and payments ₹1,20,000 shows Pending ₹25,000.
2. Report totals equal the sum of the rows.

**Commit message**
```text
feat(vendor): add vendor payments, pending tracking and vendor report
```

---

## PHASE 11 — Settings (company profile, seal, numbering)

**Simple explanation**
- A. The bill PDF needs your company details and the seal image.
- B. Bill number start value and financial-year info are managed here.
- C. Seal/signature images live in a Google Drive folder, not a local disk (Render's filesystem is not persistent between deploys).

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 11 - SETTINGS.

APPS SCRIPT (Settings.gs):
1. "settings.get" / "settings.update": company name, address, phone, email, GSTIN, PAN — stored as the single row in the app_settings sheet.
2. "settings.uploadSeal" / "settings.uploadSignature" (PNG/JPG, max 2 MB, validate real content type and size from the base64 payload before writing): save into a dedicated "TMS Assets" Google Drive folder (created once, its ID stored in Script Properties), set the file's sharing to "anyone with the link can view" so the Next.js frontend and the PDF template can both reference it, store the Drive file ID + a direct view URL in app_settings. "settings.removeSeal"/"removeSignature" delete the Drive file and clear the reference.
3. Numbering settings: bill start number for a new financial year (default 1) and enquiry start number (default 10001; changing it only affects numbers not yet generated and can never create a number that already exists — check the current max in number_sequences before allowing the change). "settings.previewNextBillNumber" returns the current financial year label and the next bill number preview without reserving it.
4. writeAuditLog on every settings change. GAS tests for file validation.

NEXT.JS: Settings > Company Profile page (form + seal/signature upload with preview and remove, images rendered from their Drive view URL), numbering settings section, current financial year display. Settings > Audit Log page: table with filters (entity, date range) showing old and new values.

Follow the finishing steps in R10.
```

**Check before commit**
1. Upload a seal image and see the preview after refresh (served from Drive).
2. Uploading a `.exe` renamed to `.png` is rejected.
3. Audit Log page shows your changes.

**Commit message**
```text
feat(settings): add company profile, Drive-hosted seal/signature upload, numbering settings and audit log page
```

---

## PHASE 12 — Billing logic (Apps Script)

**Simple explanation**
- A. Completed jobs wait in **Pending Bills**.
- B. You create a bill from them. When the bill is **processed**, it gets an automatic number like `203/2026-27`.
- C. The number restarts in the new financial year (2026-27 → 2027-28).
- D. Processed bills can still be edited later, and every edit is recorded.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (BILL_LIFECYCLE.md, D3, D4, D5, D6). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 12 - BILLING LOGIC (Billing.gs).

1. "bill.pending": enquiries at stage COMPLETED that are not in any bill. Fields: enquiry no, company, client, vehicle, container, loading type, suggested amount (freightAmount + halting amount), completed date. Filters: date range, company, client, loading type, search. Pagination.
2. "bill.create": create a DRAFT bill from one or more enquiry IDs. All must be COMPLETED, unbilled, and have the SAME company and client (clear error otherwise). Pre-fill line items: "Transportation Charges" = freightAmount and "Halting Charges" = haltingAmount (only if greater than 0), each linked to its enquiry. Enquiries move to stage BILLING (stage_history + audit). Total is calculated server-side, never trusted from the client.
3. "bill.update" (DRAFT only): edit lines (add, edit, remove, reorder), remarks, billing date. "bill.deleteDraft": deletes the draft and returns its enquiries to COMPLETED.
4. "bill.process": inside `LockService.getScriptLock()` — get the financial year of the billing date, read+increment the sequence row for (bill, financialYear) in number_sequences, create the bill number "<seq>/<FY>" (for example 203/2026-27), save financialYear + billSeq on the bill row, set status PROCESSED, billingDate (default today, editable), processedAt, and move all its enquiries to PROCESSED — release the lock only after every write completes. First bill of a new FY starts at the configured start number. A bill with total 0 or no lines cannot be processed. The number is NEVER reused or changed.
5. "bill.updateProcessed": edit a processed bill's lines, amounts, remarks and billing date. The bill number can never change. If the new billing date falls in a different financial year, reject with a clear message. writeAuditLog with old and new values. Payments already recorded (Phase 15) must never exceed the new total — design this check now (the bill_payments sheet already exists in the schema).
6. "bill.list" (processed bills): search by bill no, filters (date range, company, client, financial year), pagination, sort, totals. "bill.get" (with items, enquiries, audit trail). "bill.nextNumberPreview" (preview only, does not reserve).
7. GAS tests (important): sequence per FY; first bill of a new FY restarts; two rapid "bill.process" calls give unique numbers (exercises LockService); FY boundary (31 March vs 1 April); draft delete restores stages; mixed company/client rejected; processed edit is audited.

Update docs/BILL_LIFECYCLE.md and docs/API_PLAN.md to match the final behaviour.

Follow the finishing steps in R10.
```

**Check before commit**
1. Process two bills → numbers `1/2026-27` and `2/2026-27` (or your configured start).
2. Process with a billing date of 01-04-2027 → `1/2027-28`.
3. Mixed company/client selection is rejected.

**Commit message**
```text
feat(billing): add pending bills, draft and processed bills with financial-year bill numbering
```

---

## PHASE 13 — Billing frontend

**Simple explanation**
- A. Three screens: **Pending Bills**, **Create Bill**, **Processed Bills**.
- B. Nobody types the bill number; it appears automatically after processing.
- C. Processed bills can be viewed and edited any time.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 13 - BILLING FRONTEND (calls the Phase 12 Apps Script actions via Route Handlers).

1. Billing > Pending Bills: table matching PROJECT_DETAILS.md (Client, Company, Vehicle, Amount, Status = Pending) plus Enquiry No, Container, Type, Completed date. Row selection with checkboxes; selection is allowed only for rows with the same company + client (disable/explain others). Filters and search. Button "Create Bill" for the selected rows.
2. Billing > Create Bill page: header with Company, Client, Vehicle(s), Container(s) (read-only, from the enquiries), Billing Date, a preview of the NEXT bill number (read-only, labelled "assigned when processed"), editable line items table (description, amount, add/remove rows) with a live total in INR, remarks. Buttons: Save Draft, Process Bill (with a confirm dialog that says the number is final), Cancel Draft. Also open existing drafts from a "Drafts" tab.
3. Billing > Processed Bills: table with Bill No, Date, Company, Client, Vehicle(s), Container(s), Amount, Financial Year. Search, filters (date range, company, client, financial year), pagination, totals. Actions: View, Edit — a Download PDF button placeholder is NOT allowed yet; the PDF button is added in Phase 14 (leave it out for now).
4. Bill view page: all details, line items, linked enquiries (click to open), audit trail of edits.
5. Bill edit page for processed bills: edit lines/amount/remarks/date, the bill number is shown read-only, clear message about audit logging, server errors shown properly.
6. Add the "Bill" tab on the enquiry detail page (shows its bill number/status or "Not billed yet") and Billing/Processed states in the Completed Jobs page.
7. Component tests for the line-items total and the selection rule.

Follow the finishing steps in R10.
```

**Check before commit**
1. Select 2 rows of different clients → blocked with a message.
2. Create → Process → bill number appears and enquiry becomes PROCESSED.
3. Editing a processed bill's amount is reflected immediately in the view page and the audit trail.

**Commit message**
```text
feat(billing-ui): add pending bills, create bill, processed bills and bill edit pages
```

---

## PHASE 14 — Bill PDF (Google Docs template)

**Simple explanation**
- A. A professional invoice PDF, like the sample in your project details.
- B. There must be a separate **seal area above the signature**, then "Authorized Signature".
- C. Instead of drawing the PDF pixel-by-pixel (PDFKit), we fill in a Google Doc template and export it — Apps Script's native way to make PDFs, and it handles the ₹ symbol correctly for free since it's just Google Fonts.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (section "Bill PDF"). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 14 - BILL PDF.

1. One-time manual step (document in docs/SETUP.md): create a Google Doc "TMS Bill Template" in the "TMS Assets" Drive folder (from Phase 11) with merge tags {{companyName}}, {{companyAddress}}, {{companyPhone}}, {{companyEmail}}, {{gstin}}, {{pan}}, {{billNo}}, {{billingDate}}, {{clientName}}, {{companyPartyName}}, {{vehicleNumbers}}, {{containerNumbers}}, a table with a repeating row region for line items ({{itemDescription}} / {{itemAmount}}), {{totalAmount}}, and a bottom section with a SEAL placeholder image box positioned ABOVE a signature line reading "Authorized Signature". Store its Doc ID in Script Properties as BILL_TEMPLATE_DOC_ID.
2. Apps Script action "bill.generatePdf" {billId} (PROCESSED bills only): copies the template Doc, opens the copy with DocumentApp, replaces every merge tag (looping the line-items table region to add one row per item, growing the table before filling it), inserts the seal image (from Settings, Phase 11's Drive file) into the seal placeholder if one is uploaded — otherwise leaves the drawn "SEAL" box — and the signature image above the signature line if uploaded. Export the filled copy to PDF bytes via Drive's export endpoint, return it as base64 (or, for very large bills, save it to Drive and return a short-lived link), then delete the temporary Doc copy so your Drive doesn't fill up with old copies.
3. The PDF is generated fresh from the current saved data every time, so an edited processed bill always downloads the latest version — never cache a generated PDF.
4. Next.js Route Handler /app/api/bills/[id]/pdf/route.ts calls "bill.generatePdf", decodes the base64, and streams it back with Content-Type application/pdf and a filename like Bill_203-2026-27.pdf (replace "/" safely). Frontend: add a "Download PDF" button on the Processed Bills table, the bill view page and the bill edit page (with loading state and error handling), and a "Preview" that opens the PDF in a new tab.
5. GAS tests: the action returns non-empty PDF bytes for a normal bill and for a bill with many line items (table growth works without breaking the layout); a DRAFT bill is rejected.

Follow the finishing steps in R10. Also save a sample generated PDF (dev-data only, no real data) into docs/samples/ and describe in docs how to check it visually against the sample layout in PROJECT_DETAILS.md.
```

**Check before commit**
1. Download the PDF: the ₹ symbol shows correctly.
2. Seal box is above "Authorized Signature".
3. Edit the bill amount → new PDF shows the new total.

**Commit message**
```text
feat(billing-pdf): add Google Docs template based bill PDF with seal area and signature block
```

---

## PHASE 15 — Payment tracking

**Simple explanation**
- A. After billing comes **payment**. We record what the client has paid.
- B. Each bill shows: total, paid, balance, and status (Unpaid / Partial / Paid).

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 15 - PAYMENT TRACKING (client payments against processed bills).

APPS SCRIPT (Payments.gs):
1. "billPayment.create/update/delete/list": bill, payment date, amount, mode (Cash, Bank Transfer, Cheque, UPI, Other), reference, notes. Only PROCESSED bills accept payments. Amount must be > 0 and must not exceed the current balance. Editing a payment re-checks the balance. writeAuditLog on every change.
2. Computed fields on the bill list/detail: paid amount, balance, paymentStatus (UNPAID / PARTIAL / PAID) — computed in one shared function `computeBillPaymentStatus(bill)` in Payments.gs, reused everywhere. Filters on "bill.list": payment status, date range for payments.
3. Also make the Phase 12 rule real: "bill.updateProcessed" cannot reduce the total below the amount already paid — call the balance check before saving.
4. "reports.outstanding": total billed, total received, total outstanding, optionally grouped by company and by client with an ageing split (0-30, 31-60, 61-90, 90+ days from billing date).
5. GAS tests for partial, full and over-payment attempts, editing/deleting payments, and the bill-edit rule.

NEXT.JS:
1. Processed Bills table gets Paid, Balance and Payment Status columns (colour tags) and a Payment filter.
2. Bill view page: Payments section (list, add, edit, delete with confirm, running balance).
3. Billing > "Outstanding" sub-page (add it to the Billing menu) using "reports.outstanding".

Follow the finishing steps in R10.
```

**Check before commit**
1. Bill ₹15,000 + payment ₹5,000 → PARTIAL, balance ₹10,000.
2. Paying ₹11,000 next is rejected.
3. Full payment → PAID.

**Commit message**
```text
feat(payments): add bill payment tracking with balance, status and outstanding summary
```

---

## PHASE 16 — Reports

**Simple explanation**
- A. You want summaries, not to open each enquiry.
- B. Reports: Daily, Company-wise, Vendor (already built in Phase 10), Billing.
- C. Every report has filters and totals. Exports come in Phase 17.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (D10 and the Reports sections). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 16 - REPORTS.

APPS SCRIPT (Reports.gs):
1. "reports.daily" {date}: Total Enquiries, Completed Jobs, Pending Jobs, Bills Generated, Total Billing, Total Expenses (definitions in D10), plus a detail table of that day's enquiries and bills. Compute with one batched read per sheet, in-memory aggregation (never a getValue-per-cell loop).
2. "reports.company": for each company → Total Trips, Completed, Pending, Total Billing. Filters: date range, company, client, Import/Export, status (stage). Grand total row and optional drill-down per company (its trips list).
3. "reports.billing": list of bills with filters (date range, company, client, financial year, payment status) and totals (billed, paid, balance).
4. Vendor Report already exists (Phase 10) — make sure the Reports > Vendor Report menu item calls the same "vendor.report" action.
5. All date-boundary logic uses Asia/Kolkata, via the FinancialYear/day-boundary helper from Phase 3.
6. GAS tests with a known dataset checking every number, including day boundaries and filters.

NEXT.JS under Reports:
1. Daily Report page: date picker, summary cards (the six numbers), and detail tables.
2. Company Report page: filter bar (Date, Company, Client, Import/Export, Status), table with totals, click a company to see its trips.
3. Billing Report page with filters and totals.
4. Consistent filter component, INR formatting, loading/empty states.

Follow the finishing steps in R10.
```

**Check before commit**
1. Compare each report number with manual counts on test data.
2. Filters combine correctly (company + import + date).

**Commit message**
```text
feat(reports): add daily, company-wise and billing reports with filters
```

---

## PHASE 17 — Excel (live Sheet + protected export) and PDF report exports

**Simple explanation**
- A. Your project details say: data must go to Excel automatically, and it must be **locked (view and copy only)**.
- B. Here, "automatically up to date" is free — Google Sheets *is* the database, so it's never stale.
- C. "Locked" becomes Sheets protection + Drive sharing, not a file password (see the caveat in Part A).
- D. Each report can also be exported as a downloadable .xlsx snapshot and as PDF.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (Excel sections, D11). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 17 - EXCEL AND PDF EXPORTS.

1. One-time manual + scripted setup: on the master Spreadsheet, use Apps Script's `Protection` API (a one-off setup function `protectMasterSheets()` in Settings.gs) to protect every business sheet's data range so only the script's own actions (running as the deployment owner) can write to it, while the sheet itself stays "Anyone with the link: Viewer" or "Commenter" if you want to check figures from your phone without going through the app. This makes the live Sheet the always-current, view/copy-only master — the direct equivalent of the original "auto-updating locked Excel".
2. "export.masterXlsx" action: fetches the whole Spreadsheet as `.xlsx` bytes using `UrlFetchApp.fetch` against the Sheets export endpoint (`.../export?format=xlsx`) with `ScriptApp.getOAuthToken()`, returns it as base64. This is a point-in-time snapshot for anyone who wants a downloadable file rather than a live link — note in docs/ASSUMPTIONS.md that this exported file carries no open-password (D11).
3. Report exports: "export.reportXlsx" {report, filters} builds a small ad-hoc workbook (via a temporary Spreadsheet created with `SpreadsheetApp.create`, filled with the already-computed report rows from Reports.gs/Vendor.gs, exported to xlsx bytes the same way as step 2, then the temporary Spreadsheet is trashed) for: Enquiries list, Loading Expenses, General Expenses, Processed Bills, Vendor Report, Daily Report, Company Report, Billing Report, Outstanding — each honouring the same filters as the screen. PDF exports for the same reports reuse the Google-Docs-template technique from Phase 14 (a simple table-based template) with a header and page numbers, paginating properly for long tables.
4. writeAuditLog on every export. GAS tests: xlsx export returns non-empty valid bytes (check the zip signature), the report export applies filters correctly.

NEXT.JS:
1. Exports > Excel page: a permanent "Open live Sheet" link (the view-only share link) plus a "Download Excel Snapshot (.xlsx)" button.
2. Exports > PDF page: choose a report + filters → download PDF.
3. Add "Export Excel" / "Export PDF" buttons on each list/report page (respecting current filters).
4. Write in docs/SETUP.md exactly how the Sheets protection is configured and the honest note that the exported .xlsx carries no file password — protection is via sharing settings, not encryption.

Follow the finishing steps in R10.
```

**Check before commit**
1. Create an enquiry, open the live Sheet link immediately: the new row is already there (no waiting, no sync job).
2. Downloaded `.xlsx` snapshot opens correctly in Excel and matches the Sheet at that moment.
3. Report export honours the filters.

**Commit message**
```text
feat(export): add protected live Sheet, downloadable Excel snapshot and PDF report exports
```

---

## PHASE 18 — Dashboard

**Simple explanation**
- A. The first page you see: a quick overview of today's business.
- B. Cards + lists + a small chart, all with real data.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first (Dashboard section, D10). Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 18 - DASHBOARD.

APPS SCRIPT: "dashboard.summary" action returning (Asia/Kolkata "today"):
- Cards: Today's Trips, Pending Bills, Processed Bills (today), Today's Revenue (total of bills processed today), Today's Enquiries, Today's Expenses (loading + general dated today), Pending Vendor Payments (total pending amount across vendors).
- Company-wise Billing (current financial year, top companies + total).
- Recent Bills (latest 10 processed bills).
Compute with batched reads and simple in-memory aggregation; this is the one action worth a short `CacheService` cache (a few seconds) since the dashboard may be opened/refreshed often.

NEXT.JS: Dashboard page with the cards laid out like the sample in PROJECT_DETAILS.md (Today's Trips, Pending Bills, Processed Bills, Today's Revenue, then Today's Enquiries, Today's Expenses, Pending Vendor Payments), a Company-wise Billing bar chart (Recharts), and a Recent Bills table (click opens the bill). Cards are clickable and open the matching page with filters applied. Auto-refresh every 60 seconds (mindful this re-triggers Apps Script — keep the interval no shorter than 60s to respect quotas) and a manual refresh button. INR formatting, skeleton loaders, responsive.

GAS tests for every dashboard number with a known dataset.

Follow the finishing steps in R10.
```

**Check before commit**
1. Numbers match the reports for today.
2. Clicking "Pending Bills" opens the Pending Bills page.

**Commit message**
```text
feat(dashboard): add management dashboard with today's cards, company billing chart and recent bills
```

---

## PHASE 19 — Polish and security hardening

**Simple explanation**
- A. Make the app feel professional and safe, even with just one user on the public internet.
- B. Fix small UX problems and close security gaps before testing everything.
- C. Confirm the app stays inside Google's Apps Script quotas as data grows.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 19 - POLISH AND SECURITY HARDENING. Do not add new business features; improve what exists.

SECURITY REVIEW (fix everything you find):
1. Check EVERY Apps Script action calls `requireSession` and the shared-secret header check; produce docs/SECURITY_CHECKLIST.md with a table action → session-checked yes/no → tested yes/no.
2. Input validation on all Route Handlers AND re-validated in the matching Apps Script action (never trust the proxy is the only caller); safe error messages (no raw Apps Script stack traces sent to the browser); rate limits already added to login (Phase 4) — extend basic rate limiting (via `CacheService`) to any other unauthenticated endpoint; secure cookie flags (httpOnly, secure, sameSite); session token expiry + rotation on login; password rules (minimum length, no trivial password) enforced in "changePassword".
3. Sensitive fields (password hash, session tokens, the shared secret) never logged. Run `npm audit` in /web and fix or document high-severity issues.
4. QUOTA BUDGET REVIEW: write docs/QUOTA_NOTES.md listing, for each Apps Script action, a rough worst-case execution time and URL Fetch/row-read count, and confirm none can approach the ~6 minute execution cap or a meaningful fraction of the daily URL Fetch quota under realistic single-user daily use. Generate a dev-only batch of ~5,000 seed enquiries (via a batched Apps Script seed function, using setValues in chunks, never row-by-row) and confirm list pages, reports and the dashboard stay responsive against that volume.

UX POLISH:
1. Consistent page titles, breadcrumbs, empty states, error boundaries, 404 page, session-expired handling (redirect to /login with a friendly message, not a raw 401 screen).
2. Keyboard-friendly forms (Enter to save where safe, Esc to close drawers), consistent button placement, disabled buttons while saving (avoid double-submit — this matters even more here since there's no DB unique constraint backstopping a double-click the way Postgres would), unsaved-changes prompts.
3. Every table: sensible default sort (newest first), column widths, horizontal scroll on mobile, sticky headers where useful.
4. Accessibility basics: labels, focus states, contrast.
5. Make sure EVERY item on docs/REQUIREMENTS_CHECKLIST.md that belongs to phases 1-18 is really working; list any gap in docs/PROGRESS.md.

Follow the finishing steps in R10.
```

**Check before commit**
1. Open `docs/SECURITY_CHECKLIST.md`: no action without a session check.
2. Double-click on "Save" never creates two records.
3. Pages stay responsive with the ~5,000-row dev dataset; `docs/QUOTA_NOTES.md` shows healthy margin under Apps Script's limits.

**Commit message**
```text
chore: security hardening, UX polish, quota budget review and security checklist
```

---

## PHASE 20 — Testing

**Simple explanation**
- A. Tests protect money and numbering logic from future mistakes.
- B. Unit tests check small rules; end-to-end tests click through the real app like a user.
- C. Apps Script has no native test runner, so we use the small harness built in Phase 3, run against the throwaway TEST spreadsheet from Phase 0.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 20 - TESTING.

1. Apps Script: extend Tests_Harness.gs coverage (running against the TEST spreadsheet + TEST deployment from Phase 0, never the real data) for the critical logic: financial-year helper day-boundary cases, enquiry/transaction/bill numbering including rapid back-to-back calls and the year rollover (31 March → 1 April), stage rules, vendor payable formula, expense auto-sync, bill create/process/edit/delete-draft, audit logging, payment balance rules, report and dashboard numbers, xlsx export validity, PDF generation. Run `runAllTests()` and require all-green before continuing; write results to the TestResults sheet.
2. Next.js: Vitest + Testing Library component/unit tests for forms, INR/date formatting, and the shared vendor-payable / bill-payment-status TypeScript mirrors used for live previews.
3. End-to-end with Playwright (separate folder /e2e, its own README, configured to hit a locally-running `next dev` pointed at the TEST Apps Script deployment/TEST spreadsheet, reset between runs by re-running the Phase 3 seed against the TEST spreadsheet). Write these scenarios:
   a) Log in, create company, client, vendor.
   b) Create an enquiry with all sections, update movement times, move it stage by stage to COMPLETED.
   c) Diesel/halting expenses appear automatically; a general expense is added.
   d) See it in Pending Bills, create a bill, process it and see the number in the format N/YYYY-YY.
   e) Download the bill PDF (check it is a valid non-empty PDF) and edit the processed bill.
   f) Record a partial and then a full payment; status changes.
   g) Record a vendor payment; vendor report shows the right pending amount.
   h) Reports (daily, company, vendor, billing) show correct numbers; the live Sheet link opens and shows the same data; the .xlsx snapshot downloads and is a valid workbook; dashboard cards match.
   i) A raw fetch to any /app/api/** Route Handler without the session cookie returns 401.
4. Add npm scripts test:unit, test:e2e, test:all (test:e2e runs Playwright; a separate `clasp run runAllTests` or manual trigger note covers the Apps Script side, since clasp can't run GAS tests headlessly the way Vitest runs locally — document this limitation and the manual step in docs/TESTING.md). Fix every bug the tests reveal (in code, never by weakening a test).

Follow the finishing steps in R10.
```

**Check before commit**
1. `test:all` passes on your machine; `runAllTests()` on the TEST spreadsheet is all green.
2. Watch one Playwright run: the full flow works against the TEST spreadsheet, and your real spreadsheet is untouched.

**Commit message**
```text
test: add Apps Script test harness coverage, Next.js unit tests and Playwright end-to-end suite
```

---

## PHASE 21 — Final requirement audit + Render/Apps Script deployment + documentation

**Simple explanation**
- A. Now we check the app against your project details, line by line.
- B. We deploy `/web` to Render and `/appsscript` as a versioned Apps Script Web App, and write proper documentation.

**Prompt**
```text
Read AI_RULES.md, docs/PROJECT_DETAILS.md and every file in docs/ first. Do NOT run any git command; I do git manually. Work on this phase only.

PHASE 21 - FINAL AUDIT, DEPLOYMENT, DOCUMENTATION.

1. REQUIREMENT AUDIT: go through docs/REQUIREMENTS_CHECKLIST.md line by line against docs/PROJECT_DETAILS.md. For every line, run the real app and verify it works (do not tick from memory). Fix every gap or mismatch. Special attention to: all enquiry fields and sections; all movement fields; Import/Export; money fields; vendor tracking; automatic bill number 203/2026-27 style and financial-year restart; Pending Bills; Processed Bills view/edit/PDF; PDF layout with the seal area above the signature; loading + general expenses; Daily, Company-wise, Vendor reports and their filters; the live Sheet + Excel snapshot and its view/copy-only protection; dashboard cards; the full menu structure; the Sheets-based entity list from DATABASE_DESIGN.md. Produce docs/FINAL_AUDIT.md: a table Requirement → Where implemented (page/action) → Verified yes/no → Notes. Nothing may remain "no" without a written reason.
2. DEPLOYMENT (Render + Apps Script, no Docker/Postgres required):
   - /web: a `render.yaml` (or documented dashboard steps) for a Render **Web Service**: build command `npm install && npm run build`, start command `npm run start`, Node version pinned, environment variables APPS_SCRIPT_EXEC_URL, APPS_SCRIPT_SHARED_SECRET, SESSION_COOKIE_NAME, NODE_ENV=production, TZ=Asia/Kolkata set in the Render dashboard (documented, not committed). Note Render's free-tier idle spin-down in docs/DEPLOYMENT.md and how to avoid it (paid "always on" plan, or an external uptime pinger hitting /api/health every few minutes if acceptable).
   - /appsscript: `clasp deploy --description "vX.Y.Z - <summary>"` against the PRODUCTION spreadsheet's script project (never the TEST one), producing a versioned Web App URL; document the exact promotion steps (test on the TEST deployment first, then deploy prod) in docs/DEPLOYMENT.md.
   - A production-safe check: `seedDevData()` must refuse to run when Script Property ENV=production (already built in Phase 3) — confirm it's actually set on the production script project.
3. BACKUP: scripts/backup.gs — an Apps Script time-driven trigger (e.g. daily) that makes a timestamped copy of the whole Spreadsheet into a "TMS Backups" Drive folder via `DriveApp.makeCopy`, with a retention function that deletes copies older than N days. docs/RESTORE.md: step-by-step (open a backup copy, or copy its sheets back into the live Spreadsheet) — no `pg_dump`/`pg_restore` needed since a full Sheets copy is a complete, human-readable backup.
4. DOCUMENTATION: final README.md (what the app does, features by module, tech stack, quick start for local dev, environment variables table, Script Properties table, folder structure /web + /appsscript + /docs, testing, deployment to Render, backup, troubleshooting including "cold start on Render free tier" and "Apps Script quota exceeded"), docs/USER_GUIDE.md (simple step-by-step: create enquiry, update movement, complete, bill, PDF, payment, expenses, reports, Excel/live Sheet), docs/ARCHITECTURE.md (diagram + the browser → Next.js (Render) → Apps Script → Sheets flow), docs/API_PLAN.md updated to the final action list.
5. Run everything one last time: clean install, build, lint, all tests, and a full manual walkthrough of the flow on the deployed Render URL against the PRODUCTION Apps Script deployment. Report the results honestly, including anything you could not verify.

Follow the finishing steps in R10.
```

**Check before commit**
1. `docs/FINAL_AUDIT.md` has no unexplained "no".
2. Fresh clone → follow the README only → app runs locally, and the same steps get it live on Render.
3. Backup trigger creates a dated Drive copy; restore steps work on a dummy edit.

**Commit message**
```text
chore: final requirement audit, Render + Apps Script deployment setup, backup script and documentation
```

---

# PART E — Requirement traceability

Unchanged from your original plan — every requirement still lands in the same phase number; only the implementation technology under that phase changed (see Part D above).

---

# PART F — Assumptions to confirm (decided in Phase 1, change them there if needed)

| # | Assumption | Why it was needed |
|---|---|---|
| 1 | Financial year = 1 April to 31 March | Indian standard; matches `2026-27` |
| 2 | Transaction Number format `TXN/2026-27/00001` | Only "Transaction Number" was specified, no format |
| 3 | Vendor total payable = advance + extra advance + diesel + halting + bonus | Matches your sample (80,000 + 45,000 + 20,000 = 1,45,000) |
| 4 | Enquiry has a `freightAmount` (Transportation Charges) | No rate field was listed but bills/PDF show amounts |
| 5 | Diesel/halting on the enquiry auto-create expense rows | Avoids double entry/double counting |
| 6 | Bill number is assigned only when a bill is processed | Prevents gaps and unused numbers |
| 7 | Single user, no roles — everything the original plan gated by role is available to the one account | You confirmed only one person will use this app |
| 8 | Excel "lock" = Sheets protected ranges + Drive sharing, not a file password | Apps Script cannot set an xlsx open-password |
| 9 | No relational-DB-style transactions; `LockService` is the only atomicity guarantee | Google Sheets/Apps Script has no ACID transactions |
| 10 | Data volume stays in the low-thousands-of-rows-per-year range | Sheets performance and Apps Script quotas degrade at large scale |
| 11 | `/web` deploys to Render as a Node Web Service (not Vercel) | You confirmed Render as the deployment target |

---

**Tip:** Same as before — if a phase prompt is too long for your AI IDE, split it into "read the rules and start" then the rest, or ask for a plan first, then implementation. Never let it start the next phase early.
