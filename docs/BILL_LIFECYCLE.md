# Bill Lifecycle & Numbering Specification

This document defines the states, rules, numbering conventions, and audit mechanisms for the billing module of the Transport & Logistics Management System (TMS).

---

## 1. Bill Lifecycle State Machine

```
[Completed Enquiries] 
         │
         ▼
[Pending Bills Queue] ──(Select same Company + Client)──> [Create Draft Bill]
                                                                  │
                                            ┌─────────────────────┴─────────────────────┐
                                            │                                           │
                                            ▼ (Cancel / Delete)                         ▼ (Process Bill)
                                 [Revert Enquiries to COMPLETED]               [PROCESSED BILL]
                                                                               - FY Number Assigned
                                                                               - Enquiries -> PROCESSED
                                                                               - Immutable Bill No
                                                                                        │
                                                                                        ▼
                                                                               [Client Payments]
                                                                               (UNPAID -> PARTIAL -> PAID)
```

---

## 2. States & Rules

### 2.1 State: `DRAFT`
- **Creation:** Initiated from the **Pending Bills** screen.
- **Selection Criteria:** One or more enquiries in `COMPLETED` stage sharing the **exact same Company and Client**.
- **Numbering:** **No bill number is assigned** while in `DRAFT`.
- **Linked Enquiries:** All selected enquiries transition their stage from `COMPLETED` to `BILLING`.
- **Pre-filled Line Items:**
  - `Transportation Charges`: `freightAmount` from each enquiry.
  - `Halting Charges`: `haltingAmount` from each enquiry (if $> 0$).
  - Additional custom lines can be added, modified, or removed.
- **Actions Permitted:**
  - Update line items, remarks, billing date.
  - Delete Draft: Deleting a draft completely restores all linked enquiries back to `COMPLETED` stage.

### 2.2 State: `PROCESSED`
- **Transition:** Triggered by user clicking **Process Bill** on a draft.
- **Number Allocation:**
  - Inside `LockService.getScriptLock()`, the system reads the current counter for `bill_<FY>` from `number_sequences`, increments by 1, writes back, and assigns the formatted number.
  - Format: `<sequence>/<financialYear>` (e.g., `203/2026-27`).
- **Linked Enquiries:** All linked enquiries permanently transition to `PROCESSED`.
- **Immutability of Number:** The assigned bill number **can never be changed, reassigned, or reused**.
- **Initial Payment Status:** Automatically set to `UNPAID` with balance = `totalAmount`.

---

## 3. Financial Year (FY) Numbering Rules

1. **Cycle:** Indian Financial Year running from **April 1** to **March 31**.
2. **Label Format:** `YYYY-YY` (e.g., `2026-27` for 01-Apr-2026 to 31-Mar-2027).
3. **Sequence Reset:**
   - On April 1st of each year, the sequence for the new financial year resets to 1 (or the configured start number in Settings).
   - Bills dated 31-Mar-2026 get formatted as `N/2025-26`.
   - Bills dated 01-Apr-2026 get formatted as `1/2026-27`.
4. **LockService Protection:**
   Because numbering must never contain duplicates or race-condition gaps, the entire sequence read-increment-save cycle is protected by:
   ```javascript
   const lock = LockService.getScriptLock();
   lock.waitLock(30000); // Wait up to 30 seconds
   try {
     const nextSeq = getAndIncrementSequence(`bill_${financialYear}`);
     bill.billNumber = `${nextSeq}/${financialYear}`;
     bill.billSeq = nextSeq;
     bill.status = "PROCESSED";
     // Save bill and update linked enquiries...
   } finally {
     lock.releaseLock();
   }
   ```

---

## 4. Editing Processed Bills & Audit Trail

In traditional enterprise systems, processed bills are locked behind complex role permissions. In this single-user system:
- **Full Edit Authority:** The operator can edit line items, descriptions, amounts, remarks, and billing date on a processed bill.
- **Inviolable Constraints:**
  1. **Bill Number is Fixed:** The assigned bill number is permanent and cannot be modified.
  2. **Financial Year Lock:** If the user modifies the billing date, the new date must belong to the **same financial year** as the bill's original sequence. If it falls into a different financial year, the update is rejected.
  3. **Payment Protection:** If client payments have already been recorded against this bill, the updated `totalAmount` **cannot be less than the total amount already paid**.
- **Audit Logging:**
  Every edit to a processed bill creates an immutable entry in `audit_logs`:
  - Timestamp
  - Entity: `bills`
  - Action: `UPDATE`
  - Old Value (full JSON string)
  - New Value (full JSON string)

---

## 5. Invoice PDF Generation

- Generated on-demand via Apps Script `bill.generatePdf`.
- Always reads fresh, live data from `bills` and `bill_items` (never cached).
- Structure:
  - Header: Company letterhead, address, GSTIN, PAN.
  - Bill meta: Bill No, Date, Client Name, Company Name.
  - Vehicles & Containers summarized from linked enquiries.
  - Itemized table with formatted INR currency.
  - Total in figures and words.
  - Bottom section: Dedicated **SEAL** image box placed directly **above** the signature line reading **"Authorized Signature"**.
