# Project Implementation Progress

This document tracks phase-by-phase completion across the 22 designated phases of the Transport & Logistics Management System (TMS).

---

## Phase Status Summary

| Phase | Name | Description | Status | Completed Date |
|:---:|---|---|:---:|:---:|
| **0** | **Manual Setup** | Repo, Google Sheet + Apps Script project created, clasp linked, project details saved | **Completed** | 21-09-2026 |
| **1** | **Rules & Architecture Freeze** | `AI_RULES.md` + 8 foundational design documents in `docs/` | **Completed** | 21-09-2026 |
| **2** | **Project Scaffolding** | Next.js 14 app + Apps Script Web App skeleton + health check | **Completed** | 21-09-2026 |
| **3** | **Database & Data-Access** | 20 Sheets tabs, `SheetRepo.gs`, financial year helper, seed dev data | **Completed** | 21-09-2026 |
| **4** | **Auth & App Shell** | Single-user login, session proxy cookie, Ant Design App Shell | **Completed** | 21-09-2026 |
| **5** | **Master Data** | Companies, clients, vendors, vehicles, drivers management | **Completed** | 21-09-2026 |
| **6** | **Enquiry Logic (Backend)** | Auto numbering (`LockService`), 7-stage state machine, movement | Not Started | — |
| **7** | **Enquiry Frontend** | Add/View/Edit Enquiry screens, live vendor payable calculation | Not Started | — |
| **8** | **Operations** | Vehicle Movement, Pending Jobs, Completed Jobs control room | Not Started | — |
| **9** | **Expenses** | Loading & General expenses, automatic enquiry sync | Not Started | — |
| **10** | **Vendors** | Vendor payments, trip settlements, Vendor Report | Not Started | — |
| **11** | **Settings** | Company profile, Drive-hosted seal/signature upload, numbering | Not Started | — |
| **12** | **Billing Logic (Backend)** | Pending bills, FY bill numbers (`LockService`), processed bills | Not Started | — |
| **13** | **Billing Frontend** | Pending Bills, Create Bill, Processed Bills, bill edit pages | Not Started | — |
| **14** | **Bill PDF** | Google Docs invoice template → merge → PDF generation | Not Started | — |
| **15** | **Payment Tracking** | Client payments against processed bills, ageing report | Not Started | — |
| **16** | **Reports** | Daily, Company-wise, and Billing reports with filters | Not Started | — |
| **17** | **Exports & Sharing Lock** | Protected Google Sheet live link + on-demand `.xlsx` snapshot | Not Started | — |
| **18** | **Executive Dashboard** | Summary KPI cards, Recharts company billing chart, recent bills | Not Started | — |
| **19** | **Polish & Security Hardening**| Security audit, quota review, UX refinements, double-submit lock | Not Started | — |
| **20** | **Comprehensive Testing** | Vitest unit tests, Apps Script test harness, Playwright e2e | Not Started | — |
| **21** | **Final Audit & Deployment** | Requirement audit, Render + Apps Script deployment, documentation | Not Started | — |

---

## Phase Details

### Phase 0: Manual Setup
- Repository folder initialized.
- Master Google Sheet created and Spreadsheet ID recorded in `docs/PROJECT_DETAILS.md`.
- Bound Apps Script project created and Script ID recorded.
- Test Google Sheet and Apps Script project created for Phase 20 testing.
- `clasp` installed and linked into `/appsscript`.
- Git initialized manually by the operator.

### Phase 1: Rules & Architecture Freeze
- Created `AI_RULES.md` containing mandatory permanent rules R1 through R14.
- Authored 8 core architecture and design documents in `/docs`:
  1. `docs/BUSINESS_WORKFLOW.md`: 7-stage enquiry flow, operations, billing, and settlements.
  2. `docs/DATABASE_DESIGN.md`: Complete 20-sheet schema specifications, column orders, and data types.
  3. `docs/AUTH.md`: Single-user authentication, salted SHA-256, session tokens, and security proxy.
  4. `docs/BILL_LIFECYCLE.md`: Draft vs processed bills, `<seq>/<FY>` numbering under `LockService`, audit trail.
  5. `docs/API_PLAN.md`: Full mapping of Next.js Route Handlers and Apps Script `doPost` action dispatcher.
  6. `docs/REQUIREMENTS_CHECKLIST.md`: Itemized traceability checklist mapped to development phases.
  7. `docs/ASSUMPTIONS.md`: Technical assumptions, trade-offs (LockService, quotas, scale, Render).
  8. `docs/PROGRESS.md`: 22-phase status tracking.

### Phase 2: Project Scaffolding
- Next.js 14 App Router + TypeScript (strict) set up in `/web`.
- Installed Ant Design 5, TanStack Query, Axios, React Hook Form, Zod, dayjs, Recharts.
- Set up SSR style registry (`AntdRegistry.tsx`), theme provider, QueryClient provider, and placeholder layout.
- Created shared formatting utilities (`formatCurrencyINR`, `formatDate`, `formatDateTime`) with unit tests (all passing).
- Configured ESLint, Prettier, Vitest, and Testing Library.
- Created Next.js Route Handler `/api/health` calling Apps Script.
- Created Apps Script `Code.js` with `doPost` dispatcher, shared secret verification, and `health` check action.
- Configured `appsscript.json` (V8, webapp execution).
- Created root `package.json` convenience scripts, `.gitignore`, `.editorconfig`, and root `README.md`.
- Wrote `docs/SETUP.md` with complete guide for Sheet ID, Script Properties, clasp push/deploy, and `.env.local`.

### Phase 3: Database (Google Sheets) & Data-Access Layer
- Authored `appsscript/Setup.js` with idempotent `createAllSheets()` creating all 20 business sheets with frozen, styled header rows matching `DATABASE_DESIGN.md`.
- Authored `appsscript/SheetRepo.js` generic data-access layer implementing batched `getValues()` and `setValues()`, with `LockService.getScriptLock()` on `number_sequences`.
- Authored `appsscript/FinancialYear.js` calculating Indian FY (`YYYY-YY`) with January 1 to December 31 calendar year boundary logic in `Asia/Kolkata`.
- Created unit tests for financial year boundaries in Vitest (all 12 tests passing).
- Authored `appsscript/Tests_FinancialYear.js` and `appsscript/Tests_Harness.js` custom assertion harness writing test results to Logger and `TestResults` sheet.
- Authored `appsscript/Seed.js` with `seedDevData()` guarded by `ENV=production` check, seeding the primary user (`admin@tms.local`) with salted SHA-256 passwords, `DEFAULT` app settings, sample companies, clients, vendor, and initial sequential counters.
- Registered `setup`, `seedDev`, and `runTests` in `appsscript/Code.js`'s `ACTION_HANDLERS`.

### Phase 4: Single-User Authentication & App Shell
- **Apps Script (`/appsscript`):**
  - Authored `Auth.js` with actions `login`, `logout`, `me`, and `changePassword`.
  - Implemented salted SHA-256 password hash verification (`Utilities.computeDigest`).
  - Added rate-limiting via `CacheService.getScriptCache()` (5 failed attempts locks out for 10 minutes).
  - Authored `Session.js` with `requireSession(sessionToken)` verifying session row and expiration date.
  - Authored `Audit.js` with `writeAuditLog(entity, entityId, action, oldValue, newValue, userId)` appending JSON-serialized records to `audit_logs`.
  - Created `Tests_Auth.js` and registered auth test cases in `Tests_Harness.js`.
- **Next.js (`/web`):**
  - Created Route Handlers under `/app/api/auth/*`: `/login` (sets `httpOnly` secure `tms_session` cookie), `/logout` (invalidates session & clears cookie), `/me` (validates session token & returns user profile), `/change-password` (updates password & clears session).
  - Created server helper `web/lib/server/session.ts` for reading and manipulating the `tms_session` cookie.
  - Created client-side `AuthProvider` & `useAuth()` hook in `web/lib/auth/AuthContext.tsx` with automatic 401 redirect to `/login`.
  - Implemented modern Ant Design 5 login page at `/login` with clean validation, alerts, and loading states.
  - Implemented complete `AppShell` with collapsible sidebar, header with user avatar, name, Change Password modal, and Logout.
  - Sidebar menu configured exactly to the 9 primary modules with 20 navigation routes: Dashboard, Enquiries, Operations, Expenses, Billing, Vendors, Reports, Exports, Settings.
  - Future-phase route placeholders created using reusable `ComingSoon` component.
  - Authenticated `/dashboard` page displaying session metadata, quick actions, and business status.
  - Updated `docs/SETUP.md` with seeded credentials (`admin@tms.local` / `Admin@12345`), session configuration, and password change instructions.

### Phase 5: Master Data Management
- **Apps Script (`/appsscript`):**
  - Authored `MasterData.js` managing Companies, Clients, Vendors, Vehicles, Drivers, and Containers lookup.
  - Implemented `<entity>.list`, `<entity>.get`, `<entity>.create`, `<entity>.update`, `<entity>.deactivate`, `<entity>.reactivate`, and `<entity>.lookup` actions.
  - Enforced D12 uppercase vehicle formatting regex (`^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$`) with automatic space/hyphen stripping.
  - Enforced D12 driver 10-digit mobile number validation (`^[6-9]\d{9}$`).
  - Implemented case-insensitive batched uniqueness checks (`SheetRepo.getAllRows`) preventing duplicate names, vehicle numbers, and driver mobile numbers.
  - Soft deactivation (`active: false`) preserving historical references on enquiries and bills.
  - Automated audit logging (`AuditModule.writeAuditLog`) on create, update, deactivate, and reactivate.
  - Created `Tests_MasterData.js` GAS test suite covering creation, format validation, duplicate rejection, and lookup exclusion; registered in `Tests_Harness.js`.
- **Next.js (`/web`):**
  - Implemented generic API Route Handlers:
    - `/api/master/[entity]` (GET for list/lookup with pagination & filters, POST for create).
    - `/api/master/[entity]/[id]` (GET, PUT, DELETE for deactivate, PATCH for reactivate).
  - Built reusable `GenericMasterManager` component with Ant Design 5 Table, search, active/all filter, pagination, create/edit Drawer form, and Popconfirm deactivation.
  - Built reusable `AsyncMasterSelect` search-as-you-type dropdown component with inline **`+ Add New`** creation modal and automatic selection.
  - Implemented tabbed `Settings > Master Data` screen (`/settings/master`) for Companies, Clients, Vendors, Vehicles, Drivers.
  - Implemented dedicated `Vendors > Vendor List` screen (`/vendors`) powered by the vendor master manager.
  - Authored unit test suite for format validation helpers (`web/lib/utils/masterValidation.test.ts`, all 19 tests passing).

