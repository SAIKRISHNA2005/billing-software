# Requirements Traceability Checklist

This checklist itemizes every functional and technical requirement from `PROJECT_DETAILS.md` and maps it to its implementation phase.

---

| # | Requirement Description | Phase | Status |
|---|---|---|:---:|
| **Phase 0: Manual Setup** | | | |
| 0.1 | Repository directories created (`docs/`, `docs/reference-screenshots/`, `appsscript/`) | Phase 0 | [x] |
| 0.2 | Master Google Sheet created and Spreadsheet ID noted | Phase 0 | [x] |
| 0.3 | Apps Script project created and Script ID noted | Phase 0 | [x] |
| 0.4 | `clasp` installed and linked to the repository | Phase 0 | [x] |
| 0.5 | Throwaway test Google Sheet & script created for automated testing | Phase 0 | [x] |
| 0.6 | Project details and configuration saved in `docs/PROJECT_DETAILS.md` | Phase 0 | [x] |
| **Phase 1: Architecture & Rules Freeze** | | | |
| 1.1 | Permanent operating rules documented in `AI_RULES.md` (R1–R14) | Phase 1 | [x] |
| 1.2 | Business workflow lifecycle documented in `docs/BUSINESS_WORKFLOW.md` | Phase 1 | [x] |
| 1.3 | Google Sheets database design (all 20 tabs) in `docs/DATABASE_DESIGN.md` | Phase 1 | [x] |
| 1.4 | Single-user authentication and session security in `docs/AUTH.md` | Phase 1 | [x] |
| 1.5 | Bill lifecycle and financial year numbering in `docs/BILL_LIFECYCLE.md` | Phase 1 | [x] |
| 1.6 | Full API endpoint specification in `docs/API_PLAN.md` | Phase 1 | [x] |
| 1.7 | Requirements checklist compiled in `docs/REQUIREMENTS_CHECKLIST.md` | Phase 1 | [x] |
| 1.8 | Technical assumptions and architecture trade-offs in `docs/ASSUMPTIONS.md` | Phase 1 | [x] |
| 1.9 | Progress tracker created in `docs/PROGRESS.md` | Phase 1 | [x] |
| **Phase 2: Project Scaffolding** | | | |
| 2.1 | Next.js 14 App Router project setup with TypeScript strict in `/web` | Phase 2 | [x] |
| 2.2 | Ant Design 5, TanStack Query, Axios, React Hook Form, Zod configured | Phase 2 | [x] |
| 2.3 | Apps Script Web App entry point `doPost(e)` and `appsscript.json` configured | Phase 2 | [x] |
| 2.4 | Shared secret header validation between Next.js and Apps Script | Phase 2 | [x] |
| 2.5 | Health check endpoint (`/api/health`) connecting Next.js to Sheet via Apps Script | Phase 2 | [x] |
| 2.6 | Vitest, ESLint, Prettier configured; INR currency & date helpers with unit tests | Phase 2 | [x] |
| **Phase 3: Database (Google Sheets) & Data-Access Layer** | | | |
| 3.1 | Idempotent `createAllSheets()` creating all 20 tabs with frozen headers | Phase 3 | [x] |
| 3.2 | Generic data-access layer `SheetRepo.gs` with batched `getValues`/`setValues` | Phase 3 | [x] |
| 3.3 | Financial year helper `getFinancialYear()` (1 April - 31 March boundary logic) | Phase 3 | [x] |
| 3.4 | Development seed function `seedDevData()` with production guard check | Phase 3 | [x] |
| 3.5 | Apps Script custom assertion test harness `Tests_Harness.gs` | Phase 3 | [x] |
| **Phase 4: Single-User Auth & App Shell** | | | |
| 4.1 | Salted SHA-256 password verification and session token generation in Apps Script | Phase 4 | [x] |
| 4.2 | Next.js Route Handler setting `httpOnly` secure cookie | Phase 4 | [x] |
| 4.3 | Login page with form validation, rate-limiting lockout after 5 failed attempts | Phase 4 | [x] |
| 4.4 | Protected route layout with automatic 401 redirect to `/login` | Phase 4 | [x] |
| 4.5 | Responsive App Shell sidebar containing all modules without role restrictions | Phase 4 | [x] |
| **Phase 5: Master Data Management** | | | |
| 5.1 | Master CRUD for Companies, Clients, Vendors, Vehicles, Drivers | Phase 5 | [x] |
| 5.2 | Vehicle number uppercase validation (e.g. `TN04AB1234`) | Phase 5 | [x] |
| 5.3 | Driver 10-digit mobile number validation | Phase 5 | [x] |
| 5.4 | Soft deactivation preventing hard delete of in-use entities | Phase 5 | [x] |
| 5.5 | Reusable async-search dropdown select component with inline "+ Add New" | Phase 5 | [x] |
| **Phase 6: Enquiry Logic (Apps Script)** | | | |
| 6.1 | Atomic auto-increment Enquiry ID starting at 10001 under `LockService` | Phase 6 | [x] |
| 6.2 | Atomic Transaction Number `TXN/YYYY-YY/00001` resetting each financial year | Phase 6 | [x] |
| 6.3 | Dual-sheet atomic creation of enquiry and linked movement row | Phase 6 | [x] |
| 6.4 | 7-stage state machine with prerequisite validation for forward transitions | Phase 6 | [x] |
| 6.5 | Single reusable vendor payable calculation function `computeVendorPayable` | Phase 6 | [x] |
| 6.6 | Movement timestamp update and chronological order validation (out > in) | Phase 6 | [x] |
| **Phase 7: Enquiry Frontend (Next.js)** | | | |
| 7.1 | Add Enquiry page with 5 structured sections (Basic, Vehicle, Movement, Money, Vendor) | Phase 7 | [ ] |
| 7.2 | Real-time live Vendor Total Payable calculation matching backend formula | Phase 7 | [ ] |
| 7.3 | View / Edit Enquiry table with multi-criteria filters, search, and sorting | Phase 7 | [ ] |
| 7.4 | Enquiry detail page with 7-stage visual stepper and forward/backward stage controls | Phase 7 | [ ] |
| **Phase 8: Operations Management** | | | |
| 8.1 | Operations > Vehicle Movement page with inline quick-editing of gate times | Phase 8 | [ ] |
| 8.2 | Operations > Pending Jobs page with quick "Mark Completed" action | Phase 8 | [ ] |
| 8.3 | Operations > Completed Jobs page listing jobs ready for billing | Phase 8 | [ ] |
| **Phase 9: Expense Tracking & Auto-Sync** | | | |
| 9.1 | Loading Expenses CRUD with category breakdown and vehicle/enquiry linking | Phase 9 | [ ] |
| 9.2 | General Expenses CRUD for administrative and office overheads | Phase 9 | [ ] |
| 9.3 | Automatic sync of Diesel and Halting amounts from enquiry to `loading_expenses` | Phase 9 | [ ] |
| 9.4 | Read-only protection for `source = ENQUIRY` expenses on the Expenses page | Phase 9 | [ ] |
| **Phase 10: Vendor Settlement & Reporting** | | | |
| 10.1 | Vendor payments management (Cash, Bank Transfer, Cheque, UPI) | Phase 10 | [ ] |
| 10.2 | Vendor detail page showing summary cards, trips table, and payment history | Phase 10 | [ ] |
| 10.3 | Comprehensive Vendor Report with vehicle counts, trips, totals, paid, and balance | Phase 10 | [ ] |
| **Phase 11: Settings & Company Profile** | | | |
| 11.1 | Company profile settings (Name, Address, Phone, Email, GSTIN, PAN) | Phase 11 | [ ] |
| 11.2 | Google Drive-hosted seal and authorized signature image upload with preview | Phase 11 | [ ] |
| 11.3 | Numbering sequence configuration (Enquiry start number, Bill start number) | Phase 11 | [ ] |
| 11.4 | System audit log viewer with entity and date range filters | Phase 11 | [ ] |
| **Phase 12: Billing Logic (Apps Script)** | | | |
| 12.1 | Pending bills aggregation for completed, unbilled enquiries | Phase 12 | [ ] |
| 12.2 | Draft bill creation grouping enquiries of same Company + Client | Phase 12 | [ ] |
| 12.3 | Bill processing under `LockService` allocating sequential `<seq>/<FY>` number | Phase 12 | [ ] |
| 12.4 | Processed bill editability with immutable bill number and payment constraint | Phase 12 | [ ] |
| 12.5 | Audit logging of processed bill modifications | Phase 12 | [ ] |
| **Phase 13: Billing Frontend (Next.js)** | | | |
| 13.1 | Pending Bills screen with multi-enquiry selection restricted to same company/client | Phase 13 | [ ] |
| 13.2 | Create Bill page with line items editor, dynamic INR totals, and preview bill number | Phase 13 | [ ] |
| 13.3 | Processed Bills table with financial year, search, filters, and totals | Phase 13 | [ ] |
| 13.4 | Processed Bill edit page with confirmation dialogs and audit notices | Phase 13 | [ ] |
| **Phase 14: Bill PDF Generation** | | | |
| 14.1 | Google Docs invoice template with merge tags (`{{billNo}}`, `{{clientName}}`, etc.) | Phase 14 | [ ] |
| 14.2 | Apps Script PDF generator merging bill items, company seal, and signature | Phase 14 | [ ] |
| 14.3 | Explicit SEAL placeholder box positioned strictly ABOVE "Authorized Signature" | Phase 14 | [ ] |
| 14.4 | Download PDF and browser preview buttons on Processed Bills views | Phase 14 | [ ] |
| **Phase 15: Client Payment Tracking** | | | |
| 15.1 | Client payment recording against processed bills with payment modes | Phase 15 | [ ] |
| 15.2 | Dynamic payment status calculation (`UNPAID`, `PARTIAL`, `PAID`) | Phase 15 | [ ] |
| 15.3 | Validation preventing payments from exceeding remaining bill balance | Phase 15 | [ ] |
| 15.4 | Receivables Ageing Report (0-30, 31-60, 61-90, 90+ days) | Phase 15 | [ ] |
| **Phase 16: Reports** | | | |
| 16.1 | Daily Report displaying 6 key metrics and daily transaction drilldown | Phase 16 | [ ] |
| 16.2 | Company-wise Report with date range, loading type filters, and trip drilldown | Phase 16 | [ ] |
| 16.3 | Billing Report summarizing billed amounts, received payments, and balances | Phase 16 | [ ] |
| **Phase 17: Live Sheet & Snapshot Exports** | | | |
| 17.1 | Master Google Sheet configured with range protection and view-only sharing link | Phase 17 | [ ] |
| 17.2 | On-demand `.xlsx` snapshot download endpoint | Phase 17 | [ ] |
| 17.3 | Excel and PDF report exports respecting active UI filters | Phase 17 | [ ] |
| **Phase 18: Executive Dashboard** | | | |
| 18.1 | KPI summary cards (Today's Trips, Pending Bills, Processed Bills, Revenue, etc.) | Phase 18 | [ ] |
| 18.2 | Company-wise billing bar chart powered by Recharts | Phase 18 | [ ] |
| 18.3 | Recent 10 processed bills list with direct navigation links | Phase 18 | [ ] |
| **Phase 19: Polish & Security Hardening** | | | |
| 19.1 | End-to-end security review verifying session checks on 100% of actions | Phase 19 | [ ] |
| 19.2 | Execution quota budget review and batching validation for 5,000+ records | Phase 19 | [ ] |
| 19.3 | UX polish: responsive layouts, double-click submit prevention, empty states | Phase 19 | [ ] |
| **Phase 20: Comprehensive Testing Suite** | | | |
| 20.1 | Unit and boundary tests in Vitest for currency, dates, and preview formulas | Phase 20 | [ ] |
| 20.2 | Apps Script test harness suite running on throwaway TEST spreadsheet | Phase 20 | [ ] |
| 20.3 | Playwright end-to-end testing suite validating the complete transport lifecycle | Phase 20 | [ ] |
| **Phase 21: Final Audit, Deployment & Documentation** | | | |
| 21.1 | 100% line-by-line verification against `PROJECT_DETAILS.md` (`FINAL_AUDIT.md`) | Phase 21 | [ ] |
| 21.2 | Production deployment of Next.js to Render as a Web Service | Phase 21 | [ ] |
| 21.3 | Production deployment of Apps Script Web App via `clasp deploy` | Phase 21 | [ ] |
| 21.4 | Automated daily Google Drive spreadsheet backup script (`backup.gs`) | Phase 21 | [ ] |
| 21.5 | Complete system documentation (`README.md`, `USER_GUIDE.md`, `ARCHITECTURE.md`) | Phase 21 | [ ] |
