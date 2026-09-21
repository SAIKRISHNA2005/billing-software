# API Architecture & Endpoint Specification

This document maps all API endpoints across both layers of the application:
1. **Frontend Proxy Layer:** Next.js Route Handlers (`/web/app/api/**`).
2. **Backend API Layer:** Google Apps Script Web App (`doPost(e)` dispatcher).

---

## 1. Architectural Communication Pattern

```
[Browser Client]
       │
       ▼ (HTTP Requests, Cookies automatically passed)
[Next.js App Router: /api/** Route Handlers]
       │  • Parses request body & validates with Zod
       │  • Extracts `tms_session` cookie
       │  • Injects header: `x-tms-proxy-secret: <APPS_SCRIPT_SHARED_SECRET>`
       ▼ (HTTP POST)
[Google Apps Script Web App `doPost(e)`]
       │  • Verifies `x-tms-proxy-secret` header
       │  • Parses `{ action, payload, sessionToken }`
       │  • Calls `requireSession(sessionToken)` (except for login and health)
       │  • Executes action handler
       ▼
[Standardized Response Envelope]
```

### Standardized Response Envelope
Every response returned by Apps Script and forwarded by Next.js follows this contract:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors?: Array<{ field?: string; message: string; code?: string }>;
}
```

---

## 2. API Endpoint Matrix

### 2.1 Health & System Check
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/health` | `GET` | `health` | Confirms connectivity to Apps Script and Google Sheet access |

---

### 2.2 Authentication & Session
| Next.js Route | Method | Apps Script Action | Request Body / Payload | Description |
|---|---|---|---|---|
| `/api/auth/login` | `POST` | `auth.login` | `{ email, password }` | Authenticates operator, sets `httpOnly` cookie |
| `/api/auth/logout` | `POST` | `auth.logout` | `{}` | Invalidates session in sheet, clears cookie |
| `/api/auth/me` | `GET` | `auth.me` | `{}` | Returns current operator profile |
| `/api/auth/change-password` | `POST` | `auth.changePassword` | `{ currentPassword, newPassword }` | Updates salted hash, invalidates sessions |

---

### 2.3 Master Data
Generic Route Handler pattern: `/api/master/[entity]` (where entity = `companies`, `clients`, `vendors`, `vehicles`, `drivers`, `containers`).

| Next.js Route | Method | Apps Script Action | Payload |
|---|---|---|---|
| `/api/master/[entity]` | `GET` | `[entity].list` | Query: `?page=1&limit=20&search=...&active=true` |
| `/api/master/[entity]/lookup` | `GET` | `[entity].lookup` | Query: `?search=...&limit=20` (returns `{id, label}`) |
| `/api/master/[entity]/[id]` | `GET` | `[entity].get` | `{ id }` |
| `/api/master/[entity]` | `POST` | `[entity].create` | Entity creation object |
| `/api/master/[entity]/[id]` | `PUT` | `[entity].update` | `{ id, patch }` |
| `/api/master/[entity]/[id]` | `DELETE` | `[entity].deactivate` | Soft-deactivates (`active = false`) |

---

### 2.4 Enquiry (Transport Job)
| Next.js Route | Method | Apps Script Action | Payload & Description |
|---|---|---|---|
| `/api/enquiries` | `POST` | `enquiry.create` | `{ basic, vehicle, movement, money, vendor }` - Creates enquiry & movement row under `LockService` |
| `/api/enquiries` | `GET` | `enquiry.list` | Query filters: `dateFrom`, `dateTo`, `companyId`, `clientId`, `stage`, `vendorId`, `loadingType`, `search` |
| `/api/enquiries/[id]` | `GET` | `enquiry.get` | Returns full enquiry, movement times, vendor calculation, stage history |
| `/api/enquiries/[id]` | `PUT` | `enquiry.update` | Updates fields; triggers expense auto-sync |
| `/api/enquiries/[id]` | `DELETE` | `enquiry.delete` | Soft deletes; blocked if already in a bill |
| `/api/enquiries/[id]/movement` | `PATCH` | `enquiry.updateMovement` | Updates the 6 gate times + movement/shipping status |
| `/api/enquiries/[id]/stage` | `POST` | `enquiry.moveStage` | `{ toStage, remarks }` - Enforces prerequisites or records backward move |

---

### 2.5 Operations Control
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/operations/movements` | `GET` | `operations.movements` | Active movements (`VEHICLE_ASSIGNED` to `PORT_MOVEMENT`) |
| `/api/operations/pending` | `GET` | `operations.pending` | Uncompleted jobs before `COMPLETED` stage |
| `/api/operations/completed` | `GET` | `operations.completed` | Completed jobs (`COMPLETED` or later) |

---

### 2.6 Expenses (Loading & General)
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/expenses/loading` | `GET` | `loadingExpense.list` | List loading expenses with date, enquiry, vehicle filters |
| `/api/expenses/loading` | `POST` | `loadingExpense.create` | Add manual loading expense (`source = MANUAL`) |
| `/api/expenses/loading/[id]` | `PUT` | `loadingExpense.update` | Edit loading expense (blocked if `source = ENQUIRY`) |
| `/api/expenses/loading/[id]` | `DELETE` | `loadingExpense.delete` | Soft delete (blocked if `source = ENQUIRY`) |
| `/api/expenses/general` | `GET` | `generalExpense.list` | List general expenses with date & category filters |
| `/api/expenses/general` | `POST` | `generalExpense.create` | Record general office expense |
| `/api/expenses/general/[id]` | `PUT` | `generalExpense.update` | Edit general expense |
| `/api/expenses/general/[id]` | `DELETE` | `generalExpense.delete` | Soft delete general expense |

---

### 2.7 Vendor Management & Reports
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/vendors/[id]/trips` | `GET` | `vendor.trips` | List trips with advance, diesel, halting, total payable, paid, balance |
| `/api/vendors/payments` | `GET` | `vendorPayment.list` | List vendor payments with filters |
| `/api/vendors/payments` | `POST` | `vendorPayment.create` | Record payment made to vendor |
| `/api/vendors/payments/[id]` | `PUT` | `vendorPayment.update` | Edit vendor payment |
| `/api/vendors/payments/[id]` | `DELETE` | `vendorPayment.delete` | Delete vendor payment |
| `/api/vendors/report` | `GET` | `vendor.report` | Summary: Vehicles, Trips, Advances, Halting, Total, Paid, Pending |

---

### 2.8 Settings & Audit
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/settings` | `GET` | `settings.get` | Fetch company profile, seal/signature URLs, numbering defaults |
| `/api/settings` | `PUT` | `settings.update` | Update company profile details |
| `/api/settings/seal` | `POST` | `settings.uploadSeal` | Upload seal image (Base64) to Drive, return view URL |
| `/api/settings/seal` | `DELETE` | `settings.removeSeal` | Delete seal image from Drive |
| `/api/settings/signature` | `POST` | `settings.uploadSignature` | Upload signature image (Base64) to Drive |
| `/api/settings/signature` | `DELETE` | `settings.removeSignature` | Delete signature image from Drive |
| `/api/settings/preview-bill-no` | `GET` | `settings.previewNextBillNumber` | Non-reserving preview of next FY bill number |
| `/api/audit-logs` | `GET` | `audit.list` | Query audit trail with entity and date filters |

---

### 2.9 Billing & Invoices
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/bills/pending` | `GET` | `bill.pending` | Unbilled enquiries at `COMPLETED` stage |
| `/api/bills/draft` | `POST` | `bill.create` | `{ enquiryIds, billingDate, remarks }` - Creates DRAFT bill |
| `/api/bills/draft/[id]` | `PUT` | `bill.update` | Update line items, remarks on draft bill |
| `/api/bills/draft/[id]` | `DELETE` | `bill.deleteDraft` | Cancels draft and returns enquiries to `COMPLETED` |
| `/api/bills/[id]/process` | `POST` | `bill.process` | Assigns FY Bill Number under `LockService` and marks `PROCESSED` |
| `/api/bills/processed` | `GET` | `bill.list` | Filter processed bills by date, FY, client, company |
| `/api/bills/[id]` | `GET` | `bill.get` | Full bill details, line items, linked enquiries, audit log |
| `/api/bills/[id]` | `PUT` | `bill.updateProcessed` | Edit lines/date (number fixed; cannot reduce below paid amount) |
| `/api/bills/[id]/pdf` | `GET` | `bill.generatePdf` | Generates and streams invoice PDF via Google Docs merge |

---

### 2.10 Client Payments & Receivables
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/bills/[id]/payments` | `GET` | `billPayment.list` | List payments against a specific bill |
| `/api/bills/[id]/payments` | `POST` | `billPayment.create` | Record client payment (validates not exceeding balance) |
| `/api/bills/[id]/payments/[pid]` | `PUT` | `billPayment.update` | Edit payment record |
| `/api/bills/[id]/payments/[pid]` | `DELETE` | `billPayment.delete` | Delete payment record and adjust bill balance |
| `/api/reports/outstanding` | `GET` | `reports.outstanding` | Receivables ageing report (0-30, 31-60, 61-90, 90+ days) |

---

### 2.11 Reports & Dashboard
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/reports/daily` | `GET` | `reports.daily` | Six key metrics for a date + day's itemized transactions |
| `/api/reports/company` | `GET` | `reports.company` | Company-wise trip volume and billing totals |
| `/api/reports/billing` | `GET` | `reports.billing` | Billing and collection summary |
| `/api/dashboard/summary` | `GET` | `dashboard.summary` | KPI cards, company billing chart data, recent 10 bills |

---

### 2.12 Exports (Live Sheet & Snapshots)
| Next.js Route | Method | Apps Script Action | Description |
|---|---|---|---|
| `/api/export/master-xlsx` | `GET` | `export.masterXlsx` | Downloads full spreadsheet snapshot as `.xlsx` |
| `/api/export/report-xlsx` | `POST` | `export.reportXlsx` | Exports filtered report rows as `.xlsx` |
