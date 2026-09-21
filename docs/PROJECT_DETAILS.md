# Transport & Logistics Management System (TMS) — Project Details

> **Single Source of Truth** for business requirements, rules, workflows, fields, and calculations.

---

## 1. System Overview & Architecture

- **Application Type:** Transport & Logistics Management System (TMS)
- **Target User:** Single-user business operator (no role-based access matrix, single secure login).
- **Frontend:** Next.js 14 (App Router) + TypeScript + Ant Design 5 + TanStack Query + Axios + React Hook Form + Zod.
- **Backend / API Layer:** Google Apps Script (V8 runtime) Web App, deployed and managed with `clasp`.
  - Next.js acts as a secure server-side proxy (`/api/**` Route Handlers) calling the Google Apps Script Web App execution URL (`doPost`).
  - Browser never directly calls Apps Script.
  - Next.js manages `httpOnly` secure session cookies; Apps Script manages opaque session tokens stored in a `sessions` sheet.
- **Database:** Google Sheets (One spreadsheet is the entire database; one sheet/tab per entity/table).
- **Concurrency & Locking:** `LockService.getScriptLock()` used for all sequential number generation (Enquiry ID, Transaction Number, Bill Number).
- **Document & PDF Generation:** Google Docs template with merge tags (`{{tag}}`), filled via Apps Script `DocumentApp`, exported to PDF.
- **Excel & Reporting:** Native Google Sheets (live read/comment view) + on-demand `.xlsx` snapshot export via Sheets export API.
- **Hosting / Deployment:**
  - Next.js: Render (Node.js Web Service)
  - Backend: Google Apps Script Web App (execute-as "Me", access "Anyone")

---

## 2. Configuration & Google IDs (Fill in from Phase 0)

| Setting | Description | Value |
|---|---|---|
| **Production Spreadsheet ID** | Google Sheet ID for live production data | 11PvzwwPpFwHlZ-05WmJ4cMLMX3d4UEzhA8Z0Amx3ZM4 |
| **Production Apps Script ID** | Script ID linked to the production sheet | 1loTjhVuqP4DFJrChavoZWzfGj57sjZRneDGuzeLMBwo7BItcHV2bcBLs |
| **Test Spreadsheet ID** | Google Sheet ID for Phase 20 automated e2e tests | 1MrSn7hRyaPT2Qq9XeXB-oSbY8-z1-XXSG6R0RMVF_Zw |
| **Test Apps Script ID** | Script ID linked to the test sheet | 1loTjhVuqP4DFJrChavoZWzfGj57sjZRneDGuzeLMBwo7BItcHV2bcBLs |
| **TMS Assets Drive Folder ID** | Google Drive folder for company seal/signatures | *[Created in Phase 11]* |
| **Bill Template Doc ID** | Google Docs template ID for bill generation | *[Created in Phase 14]* |

---

## 3. Core Business Workflow & Lifecycle

### 3.1 Enquiry (Transport Job) Stages
An **Enquiry** represents a single transport job. It moves through 7 stages:

```
1. ENQUIRY_CREATED
   └──> 2. VEHICLE_ASSIGNED (Requires vehicle number + driver number)
         └──> 3. CONTAINER_MOVEMENT (Requires container number)
               └──> 4. PORT_MOVEMENT (Requires company out time)
                     └──> 5. COMPLETED (Requires port out time; sets shippingStatus=COMPLETED, movementStatus=MOVED)
                           └──> 6. BILLING (Assigned to a DRAFT bill)
                                 └──> 7. PROCESSED (Bill is finalized & assigned FY Bill Number)
```

- **Forward Flow:** Forward-only progression strictly validated by prerequisites.
- **Backward Movement:** The single user can move an enquiry backward with a confirmation dialog (for data entry corrections), except:
  - An enquiry in `BILLING` or `PROCESSED` cannot be moved backward directly via enquiry actions; it must be managed through the billing module.

---

## 4. Entity Structure & Form Fields

### 4.1 Master Data
- **Companies:** Company Name, Address, Contact Person, Phone, Email, GSTIN, PAN, Status (Active/Inactive).
- **Clients:** Client Name, Company Affiliation, Contact Person, Phone, Email, Address, GSTIN, Status (Active/Inactive).
- **Vendors:** Vendor Name, Contact Person, Phone, Email, Address, PAN/Bank Details, Status (Active/Inactive).
- **Vehicles:** Vehicle Number (e.g., uppercase format like `TN04AB1234`), Vehicle Type/Capacity, Owner/Vendor Link, Status.
- **Drivers:** Driver Name, Driver Mobile (10 digits), License Number, Status.
- **Containers:** Container Number (4 uppercase letters + 7 digits, e.g. `MSCU1234567`), Type/Size (20ft, 40ft, etc.).

### 4.2 Enquiry Form Sections
1. **Section A: Basic**
   - Enquiry ID (Auto-increment, read-only, default starts at `10001`)
   - Transaction Number (Auto-generated, e.g. `TXN/2026-27/00001`, resets every FY)
   - Creation Date (Date picker, default today, Asia/Kolkata)
   - Company (Dropdown lookup)
   - Client (Dropdown lookup filtered by Company or direct select)
   - Loading Type (`Import` / `Export`)
2. **Section B: Vehicle**
   - Vehicle Number (Lookup or type-ahead create, uppercase validation)
   - Driver Number (10-digit mobile number, lookup or type-ahead)
   - Container Number (4 letters + 7 digits)
   - Seal Number (Free text)
3. **Section C: Movement (Times & Statuses)**
   - Company In Time & Company Out Time
   - Print In Time & Print Out Time
   - Port In Time & Port Out Time
   - Movement Status (`NOT_MOVED`, `MOVED`)
   - Shipping Status (`PENDING`, `IN_PROGRESS`, `COMPLETED`)
   - *Rule:* Out times cannot be earlier than corresponding In times.
4. **Section D: Money & Charges**
   - Freight Amount (Transportation Charges to client, e.g., ₹25,000.00)
   - Diesel Amount (Advance fuel given to vendor/driver)
   - Advance Amount (Initial cash advance to vendor)
   - Extra Advance (Subsequent cash advance)
   - Halting Days (Integer count)
   - Halting Amount (Amount for halting days)
   - Bonus (Incentive amount)
5. **Section E: Vendor**
   - Vendor (Dropdown selection)
   - Vendor Total Payable (Live calculated preview)

---

## 5. Calculations & Business Formulas

### 5.1 Vendor Total Payable
The single centralized formula for vendor liability on an enquiry:
$$\text{Vendor Total Payable} = \text{Advance} + \text{Extra Advance} + \text{Diesel} + \text{Halting Amount} + \text{Bonus}$$

- **Vendor Paid:** Sum of all payments recorded in `vendor_payments` linked to this enquiry (plus unallocated payments at vendor level).
- **Vendor Pending:** $\text{Vendor Total Payable} - \text{Vendor Paid}$.

### 5.2 Auto-Sync of Enquiry Expenses to Loading Expenses
When an enquiry is saved or updated:
- If **Diesel Amount > 0**, an automatic row is upserted in `loading_expenses` (`category = "Diesel"`, `source = "ENQUIRY"`).
- If **Halting Amount > 0**, an automatic row is upserted in `loading_expenses` (`category = "Halting"`, `source = "ENQUIRY"`).
- If modified on the enquiry, the corresponding loading expense updates automatically.
- Direct editing or deletion of `source = "ENQUIRY"` rows on the Expenses page is blocked (must be edited from the enquiry).

### 5.3 Financial Year (FY) Definition
- Operating accounting year: **1 January to 31 December** (Calendar Year basis).
- Format: `YYYY-YY` (e.g., calendar year 2026 is labeled `2026-27`).
- Date boundary:
  - 31-12-2025 23:59:59 → FY `2025-26`
  - 01-01-2026 00:00:00 → FY `2026-27`
  - 31-12-2026 23:59:59 → FY `2026-27`
  - 01-01-2027 00:00:00 → FY `2027-28`

### 5.4 Sequential Number Formats & LockService
All sequential numbers MUST be generated inside `LockService.getScriptLock()`:
1. **Enquiry ID:** Sequential integer (default starts at `10001`).
2. **Transaction Number:** `TXN/<FY>/<5-digit sequence>` (e.g., `TXN/2026-27/00001`). Resets to 1 each January 1st.
3. **Bill Number:** `<Sequence>/<FY>` (e.g., `203/2026-27`). Resets to 1 each January 1st (or custom starting number set in Settings). Generated only upon **processing** a bill (never for drafts).

---

## 6. Billing & Invoice Lifecycle

```
[Completed Enquiries] 
         │
         ▼
[Pending Bills] ──(Select same Company + Client)──> [Create Draft Bill]
                                                            │
                                                            ▼
                                                    [Process Bill]
                                                    (Assigns Bill No: 203/2026-27)
                                                            │
                                    ┌───────────────────────┴───────────────────────┐
                                    ▼                                               ▼
                             [Download PDF]                                  [Receive Payments]
                      (Docs Template -> Merge -> PDF)                 (Unpaid -> Partial -> Paid)
```

1. **Pending Bills:** Displays all enquiries with stage `COMPLETED` that are not assigned to any bill.
2. **Bill Grouping:** A single bill can include multiple completed enquiries, provided they belong to the **same Company and same Client**.
3. **Pre-filled Line Items:**
   - Transportation Charges: `freightAmount`
   - Halting Charges: `haltingAmount` (if > 0)
   - Custom line items can be added, modified, or reordered.
4. **Draft vs Processed:**
   - **Draft:** No bill number is assigned. Linked enquiries move to `BILLING`. Can be cancelled/deleted (reverting enquiries to `COMPLETED`).
   - **Processed:** Permanent sequential bill number generated using `LockService`. Linked enquiries move to `PROCESSED`.
   - **Edits to Processed Bills:** Allowed by the single user; bill number never changes; changes logged in `audit_logs`. Total cannot be reduced below the amount already paid.

---

## 7. Bill PDF Template Specification

- **Engine:** Google Docs template filled with merge tags via Apps Script `DocumentApp` and exported to PDF.
- **Header:** Company Name, Address, Contact, GSTIN, PAN, Logo/Letterhead.
- **Bill Details:** Bill Number, Billing Date, Financial Year, Client Name, Company Party Name.
- **Job Details:** Vehicle numbers, Container numbers, Loading type.
- **Line Items Table:** Dynamic table with columns: Description, Rate/Amount, Total.
- **Summary:** Subtotal, Taxes (if applicable), Grand Total in INR with currency words.
- **Footer Block:**
  - Dedicated **SEAL** image area placed **ABOVE** the signature line.
  - Line with text: **"Authorized Signature"**.
  - Seal and signature dynamically embedded if uploaded in Settings (stored in Google Drive).

---

## 8. Expense Categories

1. **Loading Expenses (Trip-Related):**
   - Diesel (Auto-synced from enquiry or manual)
   - Halting (Auto-synced from enquiry or manual)
   - Loading Charges
   - Unloading Charges
   - Parking
   - Other Trip Expenses
2. **General Expenses (Office/Administrative):**
   - Office Stationery
   - Internet
   - Electricity
   - Tea / Coffee
   - Maintenance
   - Salary-Related
   - Office Repairs
   - Other

---

## 9. Reports & Metrics

1. **Daily Report (Date-specific):**
   - Total Enquiries created that date
   - Completed Jobs (of those created that date)
   - Pending Jobs
   - Bills Generated on that date
   - Total Billing (Sum of bills processed on that date)
   - Total Expenses (Loading + General expenses dated that date)
2. **Company-wise Report:**
   - Total Trips, Completed, Pending, Total Billing per Company with date range & import/export filters.
3. **Vendor Report:**
   - Vehicles Count, Trips, Advance, Diesel, Halting, Extra Advance, Bonus, Total Payable, Total Paid, Balance Pending.
4. **Billing Report:**
   - List of processed bills with status (Unpaid / Partial / Paid), Billed Amount, Received Amount, Outstanding Balance.
5. **Dashboard:**
   - Key KPI Cards: Today's Trips, Pending Bills, Processed Bills (Today), Today's Revenue, Today's Enquiries, Today's Expenses, Pending Vendor Payments.
   - Company-wise billing bar chart (Recharts).
   - Recent Bills list with direct click-to-view.

---

## 10. Data Formatting & Standards

- **Currency:** Indian Rupees (INR), 2 decimal places, formatted with commas (e.g. `₹1,85,000.00`).
- **Dates:** `DD-MM-YYYY` (e.g. `21-09-2026`).
- **Times:** 12-hour format with AM/PM (e.g. `02:30 PM`).
- **Timezone:** `Asia/Kolkata` across frontend, backend, and database timestamps.
- **Deletion:** Soft delete via `deletedAt` timestamp column across all tables.
