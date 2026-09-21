# Permanent AI Operating Rules

These rules are permanent and mandatory for all phases of development on the Transport & Logistics Management System (TMS). Every AI agent and contributor must adhere strictly to these principles.

---

### R1. Git Command Prohibition
**Never run git commands.** The user manages all git commits, branches, merges, and pushes manually. Under no circumstances should any tool execute `git` or git-related CLI commands.

### R2. Hierarchy of Truth
Before starting any work, read `AI_RULES.md`, `docs/PROJECT_DETAILS.md`, and all documents in `docs/`. In any case of conflict or ambiguity, `docs/PROJECT_DETAILS.md` is the **single source of truth** and wins over all other documents.

### R3. Strict Phase Scoping
Do **ONLY** the current phase. Never jump ahead to future phases.
- Build clean, complete, fully working features end-to-end within the phase.
- No stubs, no fake mock data, no `// TODO` items, and no non-functional placeholder buttons.
- Future-phase menu items may be displayed with an informational tag "Coming in a later phase", tracked explicitly in `docs/PROGRESS.md`.

### R4. Fixed Technology Stack
The stack is strictly fixed. Do not introduce a standalone Node/Express server, Prisma, Docker, or any SQL/NoSQL database:
- **Frontend (`/web`):** Next.js 14 (App Router) + TypeScript (strict) + Ant Design 5 + TanStack Query + Axios + React Hook Form + Zod.
- **Server / Backend (`/appsscript`):** Google Apps Script (V8 runtime), managed via `clasp`, deployed as a Web App (`doPost`).
- **Database:** Google Sheets (One spreadsheet represents the database; one sheet/tab per table).
- **Concurrency & Locking:** `LockService.getScriptLock()` for atomicity and sequential numbering.
- **PDF Generation:** Google Docs API (Template Doc with `{{mergeTags}}`) via Apps Script, exported to PDF.
- **Excel & Exports:** Native Google Sheets (live view/comment) + Apps Script on-demand `.xlsx` export.
- **Charts:** Recharts.
- **Testing:** Vitest + React Testing Library (frontend), Custom Apps Script Assertion Harness (backend logic), Playwright (E2E against test spreadsheet).

### R5. Project Directory & Communication Architecture
- Folders:
  - `/web`: Next.js application, organized by feature.
  - `/appsscript`: Google Apps Script source files (.gs/.ts), modularized (e.g., `Code.gs`, `Auth.gs`, `Enquiry.gs`, `Billing.gs`, etc.).
  - `/docs`: Specifications, design documentation, and tracking.
- **Communication Pattern:** The Next.js client-side code *never* directly talks to the Google Apps Script execution URL. All browser communication routes through Next.js Route Handlers (`/web/app/api/**`), which act as a secure server-side proxy to Apps Script.

### R6. Code Quality & Standards
- Strict TypeScript in `/web` — zero `any` types.
- ESLint and Prettier for linting and formatting.
- **Dual Validation:** Every Route Handler input must be validated with Zod, and Apps Script must re-validate the payload (never trust the client or proxy implicitly).
- Standardized API Response Envelope:
  ```json
  {
    "success": true,
    "data": {},
    "message": "Operation successful",
    "errors": []
  }
  ```
- Correct HTTP status codes on Route Handlers (200, 400, 401, 403, 404, 500).
- Every listing action must support pagination, search, filtering, and sorting.

### R7. Security & Session Management
- **Single User:** No role matrix or permission tiers exist (single operator access).
- **Server-Side Authentication:** Every Apps Script action (except public login and health check) must strictly verify a valid, unexpired session token from the `sessions` sheet.
- **Shared Secret:** A shared secret header (`x-tms-proxy-secret`) between Next.js Route Handlers and Apps Script prevents unauthorized direct invocation.
- **Opaque Session Tokens:** Apps Script issues opaque tokens stored in the `sessions` sheet; Next.js stores the token in an `httpOnly`, `secure`, `sameSite` cookie.
- **Password Security:** Password salted and hashed using `Utilities.computeDigest` (SHA-256).
- **Rate Limiting:** Login attempts rate-limited via `CacheService` (lockout after 5 consecutive failures in 10 minutes).
- **No Committed Secrets:** Secrets reside in `.env.local` for Next.js and Script Properties for Apps Script. Keep `.env.example` updated.

### R8. Data & Formatting Standards
- **Currency:** Numeric values stored with 2 decimal places; formatted as Indian Rupees (`₹1,85,000.00`).
- **Dates:** `DD-MM-YYYY` (e.g., `21-09-2026`).
- **Times:** 12-hour format with AM/PM (e.g., `02:30 PM`).
- **Timezone:** `Asia/Kolkata` across frontend, backend, and database timestamps.
- **Soft Deletes:** Rows marked deleted via a `deletedAt` ISO timestamp column.
- **Standard Columns:** Every business sheet contains `id`, `createdAt`, `updatedAt`, and `deletedAt`.

### R9. UI / UX Principles
- Built with Ant Design 5. Fully responsive layout.
- Explicit states everywhere: loading skeletons/spinners, empty states, error boundaries, and informative toasts/notifications.
- Modals/Popconfirm dialogs for destructive actions (delete, backward stage movement).
- No role-based menu hiding — the single user has access to all features and screens.

### R10. Finishing Steps After Every Phase
Upon completing each phase:
1. Run build, lint, and tests (both `/web` and `/appsscript` where applicable) and resolve all errors.
2. Update `docs/PROGRESS.md`.
3. Tick completed items in `docs/REQUIREMENTS_CHECKLIST.md`.
4. Report:
   - (a) Files created or modified
   - (b) How to run the application
   - (c) How to manually verify the features
   - (d) Anything left incomplete or deferred.

### R11. Simplicity & Assumption Logging
When requirements are ambiguous or unspecified, choose the simplest design that completely satisfies `docs/PROJECT_DETAILS.md`. Document the decision immediately in `docs/ASSUMPTIONS.md`. Do not invent unrequested features.

### R12. Code Preservation
Do not rewrite code from previous phases unless strictly required by a defect or requirement change. If earlier code must be modified, clearly explain what was changed and why.

### R13. Concurrency & Numbering Lock
Every operation that generates a sequential identifier (Enquiry ID, Transaction Number, Bill Number) **MUST** acquire `LockService.getScriptLock()` around the entire read-increment-write cycle before releasing the lock.

### R14. Batching for Quota Conservation
Never loop row-by-row with individual `getValue()` or `setValue()` calls for operations touching more than ~20 rows. Always batch data operations using `getValues()` and `setValues()` to respect Google Apps Script execution quotas and maintain sub-second response times.
