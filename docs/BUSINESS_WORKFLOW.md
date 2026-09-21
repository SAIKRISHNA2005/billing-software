# Business Workflow Specification

This document details the complete operational lifecycle of a transport job within the Transport & Logistics Management System (TMS), tracing transactions from initial client request through execution, expenses, billing, and settlement.

---

## 1. Overview of the Transport Lifecycle

A transport job is termed an **Enquiry**. Each enquiry represents a single vehicle movement for a specific client and company, carrying cargo in one container.

```
[1. Order Ingestion & Enquiry Creation]
                │
                ▼
[2. Vehicle & Driver Assignment]
                │
                ▼
[3. Container Movement Tracking]
                │
                ▼
[4. Port Movement Execution]
                │
                ▼
[5. Job Completion & Expense Consolidation]
                │
                ▼
[6. Billing Aggregation & Processing]
                │
                ▼
[7. Client Payment & Vendor Settlement]
```

---

## 2. Detailed Step-by-Step Flow

### Step 1: Order Receipt & Enquiry Creation (`ENQUIRY_CREATED`)
- **Action:** A client (e.g., *DHL Supply Chain*) requests container movement for a company (e.g., *FIRST SOLAR*).
- **Data Capture:**
  - Loading Type: `Import` or `Export`.
  - Date of Job: Auto-defaults to current date (`Asia/Kolkata`).
  - Agreed Freight Amount (Transportation Charges payable by client, e.g., ₹25,000.00).
- **Automated Generation (Locked):**
  - **Enquiry ID:** Auto-generated sequential integer (e.g., `10001`), atomic via `LockService`.
  - **Transaction Number:** Formatted string `TXN/YYYY-YY/00001` (e.g., `TXN/2026-27/00001`), resetting each financial year (April 1).
- **Initial Status:** `movementStatus = NOT_MOVED`, `shippingStatus = PENDING`.

### Step 2: Vehicle & Driver Assignment (`VEHICLE_ASSIGNED`)
- **Action:** Dispatcher allocates transport assets to the job.
- **Data Capture:**
  - Vehicle Number: Selected from Master Data or created on-the-fly (e.g., `TN04AB1234`, validated uppercase letters and numbers).
  - Driver: Selected or added with a 10-digit mobile number.
  - Vendor (optional): The transport fleet provider (e.g., *SPT Transports*).
  - Initial Vendor Advances:
    - Cash Advance (e.g., ₹10,000.00).
    - Diesel Advance (e.g., ₹8,000.00).
- **Rule:** Transition from `ENQUIRY_CREATED` to `VEHICLE_ASSIGNED` requires both vehicle number and driver number to be present.

### Step 3: Container Movement (`CONTAINER_MOVEMENT`)
- **Action:** Container allocation and gate-in/gate-out at the factory/loading yard.
- **Data Capture:**
  - Container Number: 4 letters + 7 digits (e.g., `MSCU1234567`).
  - Seal Number: Security seal identifier.
  - Movement Timestamps:
    - Company In Time (Factory arrival).
    - Company Out Time (Factory departure).
- **Rule:** Transition to `CONTAINER_MOVEMENT` requires a valid container number.
- **Timestamp Integrity:** Out Time must never be chronologically earlier than In Time.

### Step 4: Port Movement (`PORT_MOVEMENT`)
- **Action:** Vehicle moves between yard/printer and seaport terminal.
- **Data Capture:**
  - Print In Time / Print Out Time (customs documentation/print gate).
  - Port In Time / Port Out Time (terminal gate-in / gate-out).
  - Movement Status updates to `MOVED`.
  - Shipping Status updates to `IN_PROGRESS`.
- **Rule:** Transition to `PORT_MOVEMENT` requires `companyOutTime` to be recorded.

### Step 5: Job Completion & Trip Expenses (`COMPLETED`)
- **Action:** Cargo is successfully offloaded at the port terminal.
- **Prerequisites for Completion:**
  - `portOutTime` must be filled.
- **Automated Side Effects on Completion:**
  - `shippingStatus` is automatically set to `COMPLETED`.
  - `movementStatus` is confirmed as `MOVED`.
  - `completedAt` timestamp is recorded.
- **Trip Expense Reconciliation:**
  - Additional trip charges recorded: Halting Days, Halting Amount, Extra Advance, Bonus.
  - **Expense Auto-Sync:** Diesel Amount and Halting Amount recorded on the enquiry automatically populate `loading_expenses` (`source = ENQUIRY`).
  - **Vendor Total Payable:** Automatically evaluated via the single standard formula:
    $$\text{Total Payable} = \text{Advance} + \text{Extra Advance} + \text{Diesel} + \text{Halting} + \text{Bonus}$$

### Step 6: Billing Aggregation & Invoice Processing
Completed enquiries wait in the **Pending Bills** queue.
1. **Selection:** The operator selects one or more completed enquiries belonging to the **same Company and same Client**.
2. **Draft Bill Creation (`BILLING` stage):**
   - The selected enquiries transition to `BILLING`.
   - A Draft Bill is created with line items pre-filled:
     - Transportation Charges: `freightAmount`
     - Halting Charges: `haltingAmount` (if > 0)
   - Line items can be added, adjusted, or reordered.
3. **Bill Processing (`PROCESSED` stage):**
   - Operator reviews and clicks **Process Bill**.
   - Holding `LockService.getScriptLock()`, the system allocates a permanent, immutable Bill Number: `<sequence>/<financial year>` (e.g., `203/2026-27`).
   - The linked enquiries transition to `PROCESSED`.
   - The bill status becomes `PROCESSED` with `paymentStatus = UNPAID`.
4. **PDF Invoice Generation:**
   - A Google Docs template with merge tags (`{{billNo}}`, `{{clientName}}`, line items, etc.) is filled, merged with company seal and signature, and converted to a PDF document.

### Step 7: Settlements & Reconciliation
1. **Client Payments (`bill_payments`):**
   - Client sends payments against the processed bill.
   - Payment modes: NEFT/RTGS, Cheque, UPI, Cash.
   - Bill payment status dynamically updates: `UNPAID` → `PARTIAL` → `PAID`.
   - Overpayment beyond remaining balance is strictly prevented.
2. **Vendor Settlements (`vendor_payments`):**
   - Operator records payments made to the vendor.
   - Vendor pending balance = Total Payable on all trips minus all recorded payments.
3. **Audit & Reporting:**
   - Daily reports compile revenue, expenses, and trip counts for the date.
   - Company-wise and Billing reports track volume and receivables.
   - Live Google Sheet is view-accessible at all times without requiring export operations.

---

## 3. Backward Movement & Exception Handling

- **Correction Capability:** Because this system is operated by a single authorized user, mistakes can be corrected. The user can move an enquiry backward through earlier operational stages using a confirmation modal.
- **Billing Boundary Guard:** An enquiry that has reached `BILLING` or `PROCESSED` cannot be moved backward using enquiry stage controls. To revert an enquiry in `BILLING`, the user must delete the Draft Bill, which safely returns all linked enquiries to `COMPLETED`.
