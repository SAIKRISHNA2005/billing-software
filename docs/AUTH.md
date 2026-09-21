# Authentication & Session Architecture

This document specifies the authentication model, session lifecycle, and security controls for the single-operator Transport & Logistics Management System (TMS).

---

## 1. Single-User Paradigm (No Role Matrix)

There is **exactly one operator** using this application.
- All multi-tenant permission matrices, user management screens, and role gating (Admin vs. Staff vs. Accounts) from traditional ERPs are **eliminated**.
- The single authenticated user has full authority to perform all actions: creating, updating, deleting records, moving stages forward/backward, and editing processed bills.
- **Why authentication still exists:**
  Because the frontend is hosted on the public internet (Render) and the backend is deployed as a public Apps Script Web App, an authentication gate is essential to protect private business data and prevent unauthorized execution.

---

## 2. Password Security & Storage

- **Storage Location:** The `users` sheet holds exactly one active operator record.
- **Hashing Algorithm:** Salted SHA-256 using Apps Script's native `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password)`.
- **Seeding:**
  - On first deployment (Phase 3), `Seed.gs` seeds the initial user account.
  - Initial credentials originate from Apps Script Script Properties (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`), never committed to git.
- **Password Updates:**
  - The operator can change their password at any time via Settings > Change Password (`auth.changePassword`).
  - This requires the existing password, re-hashes with a freshly generated salt, and invalidates all existing sessions.

---

## 3. Session Lifecycle & Token Management

```
[Browser]                     [Next.js Proxy (/api/**)]                   [Google Apps Script]
    │                                    │                                         │
    │ 1. POST /api/auth/login            │                                         │
    │ ─────────────────────────────────> │ 2. doPost({action: "login", ...})       │
    │                                    │ ──────────────────────────────────────> │ 3. Verify Hash & Salt
    │                                    │                                         │    Issue Opaque Token
    │                                    │                                         │    Save to `sessions` sheet
    │                                    │ <────────────────────────────────────── │
    │ 4. Set-Cookie: tms_session=token   │                                         │
    │    (httpOnly, secure, sameSite)    │                                         │
    │ <───────────────────────────────── │                                         │
    │                                    │                                         │
    │ 5. GET /api/enquiries              │                                         │
    │    (Cookie automatically attached) │                                         │
    │ ─────────────────────────────────> │ 6. Extract token                        │
    │                                    │    doPost({..., sessionToken: token})   │
    │                                    │    Header: x-tms-proxy-secret           │
    │                                    │ ──────────────────────────────────────> │ 7. requireSession(token)
    │                                    │                                         │    Validate expiry & active
    │                                    │ <────────────────────────────────────── │ 8. Return business data
    │ <───────────────────────────────── │                                         │
```

### 3.1 Session Token Mechanics
- **Token Format:** Cryptographically strong, random 64-character hexadecimal string (`Utilities.getUuid() + random bytes`).
- **Token Storage:** Stored in the `sessions` sheet with fields `token`, `userId`, `createdAt`, `expiresAt`, `lastActiveAt`.
- **Session Lifetime:** Default is 7 days (configurable via `SESSION_TTL_MINUTES` in Script Properties).
- **Cookie Security:**
  - Next.js Route Handlers set an `httpOnly`, `Secure`, `SameSite=Strict`, `Path=/` cookie named `tms_session`.
  - Browser JavaScript cannot access or inspect the token, preventing XSS token theft.

### 3.2 Server-Side Session Enforcement (`requireSession`)
Every single Apps Script business action (except public health check and login) calls:
```javascript
function requireSession(sessionToken) {
  if (!sessionToken) {
    throw new UnauthorizedError("Authentication required");
  }
  const session = SessionRepo.findByToken(sessionToken);
  if (!session || new Date(session.expiresAt) < new Date()) {
    throw new UnauthorizedError("Session expired or invalid. Please log in again.");
  }
  // Refresh last active timestamp periodically
  return session;
}
```
If validation fails, Apps Script returns `{ success: false, errors: [{ code: "UNAUTHORIZED", message: "..." }] }`, and the Next.js Route Handler returns HTTP 401, triggering immediate redirect to `/login`.

---

## 4. Shared Secret Header Protection

To prevent strangers who discover the Apps Script Web App `exec` URL from calling backend actions directly:
- Next.js Route Handlers attach a private header:
  `x-tms-proxy-secret: <APPS_SCRIPT_SHARED_SECRET>`
- Apps Script checks this header on every invocation of `doPost(e)`.
- If the secret does not match the value in Script Properties (`SHARED_SECRET`), the request is rejected immediately with HTTP 403 / Access Denied.

---

## 5. Brute Force Defense & Rate Limiting

- **Scope:** Login endpoint (`auth.login`).
- **Mechanism:** Apps Script `CacheService.getScriptCache()`.
- **Policy:**
  - Key: `login_fail_<normalized_email>`.
  - Incremented on each failed attempt.
  - If 5 failed attempts occur within 10 minutes, the account is temporarily locked out for 10 minutes.
  - Successful authentication clears the failure counter.
