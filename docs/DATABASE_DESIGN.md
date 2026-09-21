# Google Sheets Database Design

In this architecture, **a single Google Spreadsheet serves as the entire database**. Each tab (sheet) corresponds to a table, and each row represents a record.

Because Google Sheets does not enforce database schemas or foreign key constraints, **the header row and exact column order define the schema**. The Apps Script Data Access Layer (`SheetRepo.gs`) strictly maps rows by column position and header names.

---

## 1. Sheet Relationship Diagram (via `id` references)

```
[companies] ◄────┐
                 ├─── [enquiries] ────────┬───► [movements] (1:1 via enquiryId)
[clients]   ◄────┘         ▲              ├───► [stage_history] (1:N via enquiryId)
                           │              ├───► [loading_expenses] (1:N via enquiryId)
[vendors]   ◄──────────────┤              └───► [bill_items] ───► [bills]
                           │                                        ▲
[vehicles]  ◄──────────────┤                                        │
                           │                                        ├──► [bill_payments] (1:N via billId)
[drivers]   ◄──────────────┘                                        │
                                                                    └──► [audit_logs] (entityId reference)
[vendors]   ◄───────────────────────────────── [vendor_payments] (1:N via vendorId)

Standalone System Sheets:
- [users] ─────────► [sessions] (via userId)
- [number_sequences] (tracks atomic counters for enquiries, transactions, bills)
- [app_settings] (single row: company profile, seal/signature Drive IDs, numbering defaults)
- [general_expenses] (independent office/admin expenses)
```

---

## 2. Common Column Conventions

Every business entity sheet includes standard metadata columns:
- `id` (String): Unique identifier (e.g. UUID or prefixed string like `ENQ-10001`, `BILL-001`, `CMP-101`).
- `createdAt` (String): ISO 8601 timestamp in Asia/Kolkata timezone.
- `updatedAt` (String): ISO 8601 timestamp of the last update.
- `deletedAt` (String): ISO 8601 timestamp if soft-deleted, empty/null if active.

---

## 3. Sheet-by-Sheet Column Specifications

### 1. `users`
Stores credentials and profile for the single operator account.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Unique user ID (e.g., `USR-001`) |
| B | `name` | String | Full name of the operator |
| C | `email` | String | Login email address (lowercase, unique) |
| D | `passwordHash` | String | Salted SHA-256 hash |
| E | `salt` | String | Cryptographic salt used for hashing |
| F | `createdAt` | String | ISO 8601 timestamp |
| G | `updatedAt` | String | ISO 8601 timestamp |

---

### 2. `companies`
Internal operating companies / billing entities.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Company ID (e.g., `CMP-101`) |
| B | `name` | String | Company Name (e.g., "FIRST SOLAR", unique) |
| C | `address` | String | Postal address |
| D | `contactPerson`| String | Primary contact person |
| E | `phone` | String | Contact telephone / mobile |
| F | `email` | String | Official contact email |
| G | `gstin` | String | 15-character GSTIN |
| H | `pan` | String | 10-character PAN |
| I | `active` | Boolean | `true` if active, `false` if deactivated |
| J | `createdAt` | String | ISO 8601 timestamp |
| K | `updatedAt` | String | ISO 8601 timestamp |
| L | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 3. `clients`
Clients who book transport services.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Client ID (e.g., `CLI-201`) |
| B | `name` | String | Client Name (e.g., "DHL Supply Chain", unique) |
| C | `companyId` | String | Associated Company ID reference |
| D | `contactPerson`| String | Contact person name |
| E | `phone` | String | Contact mobile |
| F | `email` | String | Contact email |
| G | `address` | String | Billing / physical address |
| H | `gstin` | String | GSTIN of the client |
| I | `active` | Boolean | `true` if active, `false` if deactivated |
| J | `createdAt` | String | ISO 8601 timestamp |
| K | `updatedAt` | String | ISO 8601 timestamp |
| L | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 4. `vendors`
Third-party transport and fleet providers.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Vendor ID (e.g., `VND-301`) |
| B | `name` | String | Vendor Name (e.g., "SPT Transports", unique) |
| C | `contactPerson`| String | Primary contact person |
| D | `phone` | String | Contact mobile |
| E | `email` | String | Contact email |
| F | `address` | String | Office address |
| G | `pan` | String | PAN number |
| H | `bankDetails` | String | Bank account, IFSC, branch information |
| I | `active` | Boolean | `true` if active, `false` if deactivated |
| J | `createdAt` | String | ISO 8601 timestamp |
| K | `updatedAt` | String | ISO 8601 timestamp |
| L | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 5. `vehicles`
Transport vehicles utilized in operations.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Vehicle ID (e.g., `VEH-401`) |
| B | `vehicleNumber`| String | Standard uppercase format (e.g., `TN04AB1234`) |
| C | `vehicleType` | String | Trailer, 40ft Flatbed, 20ft, etc. |
| D | `vendorId` | String | Vendor ID reference (if vendor vehicle) |
| E | `active` | Boolean | `true` if active, `false` if deactivated |
| F | `createdAt` | String | ISO 8601 timestamp |
| G | `updatedAt` | String | ISO 8601 timestamp |
| H | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 6. `drivers`
Drivers operating vehicles.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Driver ID (e.g., `DRV-501`) |
| B | `name` | String | Driver Full Name |
| C | `phone` | String | 10-digit mobile number |
| D | `licenseNumber`| String | Driving license number |
| E | `active` | Boolean | `true` if active, `false` if deactivated |
| F | `createdAt` | String | ISO 8601 timestamp |
| G | `updatedAt` | String | ISO 8601 timestamp |
| H | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 7. `containers`
Containers handled during transport operations.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Container record ID (e.g., `CON-601`) |
| B | `containerNumber` | String | 4 letters + 7 digits (e.g., `MSCU1234567`) |
| C | `containerType`| String | 20ft / 40ft / Open Top / Reefer |
| D | `createdAt` | String | ISO 8601 timestamp |
| E | `updatedAt` | String | ISO 8601 timestamp |

---

### 8. `enquiries`
Core transport jobs (most critical entity in the system).

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | System record ID (e.g., `ENQ-10001`) |
| B | `enquiryNumber`| Integer | Sequential Enquiry ID (starts at 10001) |
| C | `transactionNumber` | String | Format: `TXN/2026-27/00001` |
| D | `date` | String | Job creation date (`DD-MM-YYYY`) |
| E | `companyId` | String | Company ID reference |
| F | `clientId` | String | Client ID reference |
| G | `loadingType` | String | `Import` or `Export` |
| H | `vehicleId` | String | Vehicle ID reference |
| I | `driverId` | String | Driver ID reference |
| J | `containerId` | String | Container ID reference |
| K | `sealNumber` | String | Container security seal number |
| L | `stage` | String | `ENQUIRY_CREATED`, `VEHICLE_ASSIGNED`, `CONTAINER_MOVEMENT`, `PORT_MOVEMENT`, `COMPLETED`, `BILLING`, `PROCESSED` |
| M | `vendorId` | String | Vendor ID reference (optional) |
| N | `freightAmount`| Number | Transportation Charges to client (2 decimals) |
| O | `dieselAmount` | Number | Fuel advance given (2 decimals) |
| P | `advanceAmount`| Number | Cash advance given (2 decimals) |
| Q | `extraAdvance` | Number | Additional advance given (2 decimals) |
| R | `haltingDays` | Integer | Number of halting days |
| S | `haltingAmount`| Number | Halting charges incurred (2 decimals) |
| T | `bonus` | Number | Bonus / incentive paid (2 decimals) |
| U | `billId` | String | Processed Bill ID reference (empty if unbilled) |
| V | `completedAt` | String | Timestamp when stage moved to `COMPLETED` |
| W | `createdAt` | String | ISO 8601 timestamp |
| X | `updatedAt` | String | ISO 8601 timestamp |
| Y | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 9. `movements`
Time tracking and movement gate statuses for each enquiry (1:1 with `enquiries`).

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Movement record ID |
| B | `enquiryId` | String | Linked Enquiry ID reference |
| C | `companyInTime` | String | Factory Gate-In timestamp (`DD-MM-YYYY hh:mm A`) |
| D | `companyOutTime`| String | Factory Gate-Out timestamp |
| E | `printInTime` | String | Printing / customs Gate-In timestamp |
| F | `printOutTime` | String | Printing / customs Gate-Out timestamp |
| G | `portInTime` | String | Seaport Terminal Gate-In timestamp |
| H | `portOutTime` | String | Seaport Terminal Gate-Out timestamp |
| I | `movementStatus`| String | `NOT_MOVED` or `MOVED` |
| J | `shippingStatus`| String | `PENDING`, `IN_PROGRESS`, `COMPLETED` |
| K | `createdAt` | String | ISO 8601 timestamp |
| L | `updatedAt` | String | ISO 8601 timestamp |

---

### 10. `stage_history`
Chronological audit of enquiry stage transitions.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Stage history record ID |
| B | `enquiryId` | String | Linked Enquiry ID reference |
| C | `fromStage` | String | Previous stage |
| D | `toStage` | String | New stage |
| E | `direction` | String | `FORWARD` or `BACKWARD` |
| F | `remarks` | String | Reason / confirmation note |
| G | `timestamp` | String | ISO 8601 timestamp |

---

### 11. `loading_expenses`
Trip-associated direct expenses.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Loading expense ID (e.g., `LEXP-701`) |
| B | `expenseDate` | String | Date of expense (`DD-MM-YYYY`) |
| C | `category` | String | `Diesel`, `Loading Charges`, `Unloading Charges`, `Parking`, `Halting`, `Other Trip Expenses` |
| D | `amount` | Number | Expense amount (2 decimals) |
| E | `description` | String | Remarks or notes |
| F | `enquiryId` | String | Linked Enquiry ID reference (optional) |
| G | `vehicleId` | String | Linked Vehicle ID reference (optional) |
| H | `source` | String | `ENQUIRY` (auto-synced) or `MANUAL` |
| I | `createdAt` | String | ISO 8601 timestamp |
| J | `updatedAt` | String | ISO 8601 timestamp |
| K | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 12. `general_expenses`
Office, administrative, and overhead expenses.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | General expense ID (e.g., `GEXP-801`) |
| B | `expenseDate` | String | Date of expense (`DD-MM-YYYY`) |
| C | `category` | String | `Office Stationery`, `Internet`, `Electricity`, `Tea/Coffee`, `Maintenance`, `Salary-Related`, `Office Repairs`, `Other` |
| D | `amount` | Number | Expense amount (2 decimals) |
| E | `description` | String | Itemized expense description |
| F | `createdAt` | String | ISO 8601 timestamp |
| G | `updatedAt` | String | ISO 8601 timestamp |
| H | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 13. `bills`
Invoices raised to clients.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Internal Bill ID (e.g., `BIL-901`) |
| B | `billNumber` | String | Immutable FY number, e.g., `203/2026-27` (blank for Draft) |
| C | `billSeq` | Integer | Sequence number within financial year |
| D | `financialYear`| String | E.g. `2026-27` |
| E | `status` | String | `DRAFT` or `PROCESSED` |
| F | `billingDate` | String | Billing Date (`DD-MM-YYYY`) |
| G | `companyId` | String | Company ID reference |
| H | `clientId` | String | Client ID reference |
| I | `totalAmount` | Number | Sum of line items (2 decimals) |
| J | `remarks` | String | Invoice remarks / payment instructions |
| K | `processedAt` | String | ISO 8601 timestamp when processed |
| L | `createdAt` | String | ISO 8601 timestamp |
| M | `updatedAt` | String | ISO 8601 timestamp |
| N | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 14. `bill_items`
Itemized line items on a bill.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Line item ID |
| B | `billId` | String | Linked Bill ID reference |
| C | `enquiryId` | String | Linked Enquiry ID (optional) |
| D | `description` | String | Item description (e.g. "Transportation Charges") |
| E | `amount` | Number | Item amount (2 decimals) |
| F | `sortOrder` | Integer | Display sequence order |
| G | `createdAt` | String | ISO 8601 timestamp |
| H | `updatedAt` | String | ISO 8601 timestamp |

---

### 15. `bill_payments`
Client payment transactions received against processed bills.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Payment transaction ID (e.g., `CLM-101`) |
| B | `billId` | String | Linked Bill ID reference |
| C | `paymentDate` | String | Payment receipt date (`DD-MM-YYYY`) |
| D | `amount` | Number | Amount received (2 decimals) |
| E | `mode` | String | `Cash`, `Bank Transfer`, `Cheque`, `UPI`, `Other` |
| F | `reference` | String | Transaction/UTR/Cheque reference |
| G | `notes` | String | Remarks |
| H | `createdAt` | String | ISO 8601 timestamp |
| I | `updatedAt` | String | ISO 8601 timestamp |
| J | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 16. `vendor_payments`
Disbursements made to fleet vendors.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Vendor payment ID (e.g., `VPM-201`) |
| B | `vendorId` | String | Linked Vendor ID reference |
| C | `enquiryId` | String | Linked Enquiry ID (optional; empty = unallocated) |
| D | `paymentDate` | String | Payment date (`DD-MM-YYYY`) |
| E | `amount` | Number | Amount disbursed (2 decimals) |
| F | `mode` | String | `Cash`, `Bank Transfer`, `Cheque`, `UPI`, `Other` |
| G | `reference` | String | Transaction/UTR/Cheque reference |
| H | `notes` | String | Payment notes |
| I | `createdAt` | String | ISO 8601 timestamp |
| J | `updatedAt` | String | ISO 8601 timestamp |
| K | `deletedAt` | String | ISO 8601 timestamp (soft delete) |

---

### 17. `number_sequences`
Tracks atomic sequential numbering under script locks.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `sequenceKey` | String | Primary key: `enquiry`, `txn_<financialYear>`, `bill_<financialYear>` |
| B | `financialYear`| String | Financial year label (e.g., `2026-27` or `ALL`) |
| C | `currentValue` | Integer | Latest allocated integer value |
| D | `updatedAt` | String | ISO 8601 timestamp |

---

### 18. `app_settings`
System-wide configuration and profile (Single-row entity).

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Key identifier (e.g. `DEFAULT`) |
| B | `companyName` | String | Legal company name |
| C | `address` | String | Registered office address |
| D | `phone` | String | Contact telephone |
| E | `email` | String | Contact email |
| F | `gstin` | String | Registered GSTIN |
| G | `pan` | String | Company PAN |
| H | `sealFileId` | String | Google Drive File ID of the company seal image |
| I | `sealViewUrl` | String | Direct view URL for the seal |
| J | `signatureFileId`| String| Google Drive File ID of the authorized signature |
| K | `signatureViewUrl`|String| Direct view URL for the signature |
| L | `enquiryStartNumber` | Integer | Starting Enquiry ID (default: 10001) |
| M | `billStartNumber` | Integer | Starting Bill Sequence per FY (default: 1) |
| N | `updatedAt` | String | ISO 8601 timestamp |

---

### 19. `audit_logs`
Immutable audit log recording critical mutations.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | String | Audit record ID |
| B | `timestamp` | String | ISO 8601 timestamp |
| C | `entity` | String | Target entity (`enquiries`, `bills`, `settings`, etc.) |
| D | `entityId` | String | ID of the mutated record |
| E | `action` | String | `CREATE`, `UPDATE`, `STAGE_CHANGE`, `PROCESS`, `DELETE` |
| F | `oldValue` | String | JSON string of previous state |
| G | `newValue` | String | JSON string of updated state |
| H | `userId` | String | Operator User ID reference |

---

### 20. `sessions`
Server-side active session store for the single user.

| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `token` | String | Opaque cryptographically random token string |
| B | `userId` | String | Linked User ID reference |
| C | `createdAt` | String | ISO 8601 timestamp |
| D | `expiresAt` | String | ISO 8601 expiry timestamp |
| E | `lastActiveAt`| String | ISO 8601 timestamp of last validated call |
