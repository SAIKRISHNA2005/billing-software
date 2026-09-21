# Technical Assumptions & Architectural Trade-offs

This document details the operational decisions, stack characteristics, and intentional engineering trade-offs adopted for the Transport & Logistics Management System (TMS).

---

## 1. Business Decisions (D1 – D13)

- **D1. Enquiry Lifecycle & Stage Machine:**
  An Enquiry represents a single transport job. It moves through 7 stages: `ENQUIRY_CREATED` → `VEHICLE_ASSIGNED` → `CONTAINER_MOVEMENT` → `PORT_MOVEMENT` → `COMPLETED` → `BILLING` → `PROCESSED`. Progression is forward-only by default with strict prerequisites. Backward movement is permitted for correction via a user confirmation dialog, but cannot be used to exit `BILLING` or `PROCESSED`.
- **D2. Atomic Numbering:**
  Enquiry ID is an auto-incrementing integer (starts at `10001`). Transaction Number is formatted as `TXN/YYYY-YY/00001` and resets each financial year. Both are generated atomically inside `LockService.getScriptLock()` from `number_sequences`.
- **D3. Financial Year Standard:**
  The financial year runs from **1 January to 31 December** (Calendar Year basis) using the two-year span format `YYYY-YY` (e.g. 2026 is `2026-27`). Bill numbers follow `<sequence>/<financialYear>` (e.g. `203/2026-27`), resetting to 1 each January 1st, and are allocated only when a bill transitions to `PROCESSED`.
- **D4. Pending Bills & Processed Bill Edits:**
  Pending Bills comprises all unbilled enquiries at `COMPLETED` stage. Draft bills do not receive numbers. When processed, bills receive immutable numbers. Processed bills can be edited by the operator, with all changes tracked in `audit_logs`.
- **D5. Bill Consolidation:**
  A single bill groups one or more completed enquiries belonging strictly to the same Company and same Client.
- **D6. Freight & Pre-filled Bill Items:**
  Enquiries capture `freightAmount` (client transportation charges). When generating a bill, items are pre-filled with Transportation Charges (`freightAmount`) and Halting Charges (`haltingAmount`), editable by the user.
- **D7. Vendor Payable Calculation:**
  Vendor total payable is defined by a single unified formula across the system:
  $$\text{Vendor Total Payable} = \text{Advance} + \text{Extra Advance} + \text{Diesel} + \text{Halting Amount} + \text{Bonus}$$
  $\text{Vendor Pending} = \text{Vendor Total Payable} - \text{Total Payments Recorded}$.
- **D8. Expense Auto-Synchronization:**
  Non-zero Diesel and Halting amounts entered on an enquiry automatically create and synchronize linked rows in `loading_expenses` (`source = ENQUIRY`). These rows cannot be edited directly on the Expenses screen.
- **D9. Expense Taxonomies:**
  - *Loading Expense Categories:* Diesel, Loading Charges, Unloading Charges, Parking, Halting, Other Trip Expenses.
  - *General Expense Categories:* Office Stationery, Internet, Electricity, Tea/Coffee, Maintenance, Salary-Related, Office Repairs, Other.
- **D10. Standardized Metrics:**
  - *Daily Report:* Enquiries created on date, Completed jobs, Pending jobs, Bills generated on date, Total billing amount, Total expenses (loading + general) dated on that date.
  - *Dashboard:* Today's Trips (any movement time today), Today's Enquiries, Today's Revenue (bills processed today), Pending Bills count, Pending Vendor Payments.
- **D11. Google Sheets as Live Database & Excel:**
  The master Google Sheet serves as the real-time database. View/copy-only sharing provides instant live visibility. On-demand `.xlsx` snapshots are downloadable via Apps Script's export endpoint.
- **D12. Master Data Format Validation:**
  - Vehicle Number: Uppercase alphanumeric (e.g., `TN04AB1234`).
  - Driver Number: Exactly 10-digit mobile number.
  - Container Number: 4 uppercase letters followed by 7 digits (e.g., `MSCU1234567`).
  - Seal Number: Free text.
- **D13. Movement Status & Temporal Validation:**
  Movement Status: `NOT_MOVED`, `MOVED`. Shipping Status: `PENDING`, `IN_PROGRESS`, `COMPLETED`. Out times must be chronologically equal to or later than corresponding In times.

---

## 2. Technical Stack Realities & Accepted Trade-offs

### 2.1 Concurrency & Mutexes vs. ACID Transactions
- **Constraint:** Google Sheets is not a relational database and provides no ACID row-level locking or multi-table transaction rollback.
- **Mitigation:**
  - Concurrency is managed via Google Apps Script's `LockService.getScriptLock()`.
  - All critical read-modify-write sequences (sequential IDs and bill numbers) acquire a script lock with a 30-second timeout.
  - Dual-sheet writes (e.g., creating an enquiry and its linked movement row) are wrapped with defensive error cleanup (reverting the first write if the second fails).

### 2.2 Execution Quotas & Batch Operations
- **Constraint:** Google Apps Script enforces execution time limits (~6 minutes per invocation) and daily quota limits on URL Fetch and Services calls.
- **Mitigation:**
  - Cell-by-cell calls (`getValue()`, `setValue()`) in loops are strictly prohibited.
  - All repository methods batch data operations using `sheet.getDataRange().getValues()` and write updates in batch using `setValues()`.
  - CacheService is utilized for transient, frequently requested data (e.g., dashboard summary with short TTL).

### 2.3 Volume & Scale Boundaries
- **Constraint:** Google Sheets performance begins degrading as individual spreadsheets exceed tens of thousands of rows.
- **Context:** The system is designed for a single logistics operator handling a few hundred to a few thousand transport jobs per year. At this volume, performance remains fast and reliable.

### 2.4 Custom Authentication vs. Native Auth Libraries
- **Constraint:** Native server authentication packages (e.g., bcrypt, NextAuth adapter for Sheets) are not compatible with the Google Apps Script V8 runtime.
- **Mitigation:**
  - Authentication is implemented using salted SHA-256 via `Utilities.computeDigest`.
  - Opaque random session tokens are tracked in the `sessions` sheet.
  - Session cookies (`httpOnly`, `Secure`, `SameSite=Strict`) are issued and managed by Next.js Route Handlers.
  - Login attempts are rate-limited via `CacheService` to prevent brute-force attacks.

### 2.5 Document Templating & PDF Generation
- **Constraint:** Standalone PDF generation libraries like PDFKit or Puppeteer cannot run directly inside Apps Script.
- **Mitigation:**
  - Invoice PDF generation leverages a Google Docs template containing merge tags (`{{tag}}`).
  - Apps Script duplicates the template, performs text replacement, injects seal/signature image assets, and exports the document as PDF bytes via Drive.

### 2.6 Excel Snapshot Protection vs. File Password
- **Constraint:** Google Apps Script's native `.xlsx` export API does not support setting open-passwords on generated Excel files.
- **Mitigation:**
  - Real-time protection is achieved via Google Sheets' protected ranges and Google Drive's "Viewer / Commenter" sharing permissions.
  - On-demand exported `.xlsx` snapshots represent point-in-time files without encryption passwords.

### 2.7 Deployment Target: Render Web Service
- **Choice:** Next.js is deployed as a long-lived Node.js Web Service on Render (`next build && next start`).
- **Characteristics:**
  - Route Handlers run in a standard Node.js server environment rather than ephemeral serverless edge functions.
  - On free or hobby tiers, idle services spin down after inactivity, resulting in a cold start latency on the next request. This is acknowledged and documented.
