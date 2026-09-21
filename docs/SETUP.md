# System Setup & Deployment Guide

This guide details how to configure Google Sheets, deploy the Google Apps Script Web App, configure environment variables, and run the Next.js frontend locally or on Render.

---

## 1. Google Sheets & Apps Script Setup

### Step 1: Note Your Google Sheet ID
1. Open your master Google Sheet (e.g. `TMS-Production-Database`).
2. The URL in your browser is structured as:
   ```
   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
   ```
3. Copy your `SPREADSHEET_ID` (as recorded in `docs/PROJECT_DETAILS.md`: `11PvzwwPpFwHlZ-05WmJ4cMLMX3d4UEzhA8Z0Amx3ZM4`).

### Step 2: Configure Script Properties in Apps Script
1. In your Google Sheet, open **Extensions** → **Apps Script**.
2. Click **Project Settings** (gear icon on the left sidebar).
3. Scroll down to **Script Properties** and click **Add script property**.
4. Add the following required properties:

| Property Name | Example Value | Description |
|---|---|---|
| `SPREADSHEET_ID` | `11PvzwwPpFwHlZ-05WmJ4cMLMX3d4UEzhA8Z0Amx3ZM4` | ID of your master Google Sheet |
| `SHARED_SECRET` | `a_very_secure_random_secret_string_32_chars_min` | Secret key shared between Next.js and Apps Script |
| `SESSION_TTL_MINUTES`| `10080` | Session lifetime in minutes (10080 = 7 days) |

5. Click **Save script properties**.

### Step 3: Push Code & Deploy Apps Script Web App
You can deploy directly using `clasp` from your terminal:

```powershell
cd appsscript

# Push latest code to Google Apps Script
clasp push

# Deploy as a Web App
clasp deploy --description "v1.0.0 - Initial Scaffold and Health Check"
```

*Alternatively, from the Google Apps Script web UI:*
1. Click the blue **Deploy** button (top right) → **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in configuration:
   - **Description:** `v1.0.0 - TMS Backend`
   - **Execute as:** `Me (<your_email@gmail.com>)`
   - **Who has access:** `Anyone`
4. Click **Deploy**.
5. Copy the **Web App URL** (ends in `/exec`).

---

## 2. Next.js Frontend Configuration (`/web`)

### Step 1: Create Environment Configuration
In the `/web` directory, create your local environment file:

```powershell
cd web
cp .env.example .env.local
```

### Step 2: Fill in `.env.local`
Edit `web/.env.local`:

```env
# Google Apps Script Web App exec URL (copied from Step 3 above)
APPS_SCRIPT_EXEC_URL="https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec"

# Shared Secret (MUST MATCH SHARED_SECRET set in Script Properties)
APPS_SCRIPT_SHARED_SECRET="a_very_secure_random_secret_string_32_chars_min"

# Session Cookie Name
SESSION_COOKIE_NAME="tms_session"

# Application Environment
NODE_ENV="development"

# Default Timezone
TZ="Asia/Kolkata"
```

---

## 3. Running the Next.js Frontend Locally

```powershell
cd web

# 1. Install dependencies
npm install

# 2. Run unit tests
npm run test

# 3. Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Verifying the Health Check Endpoint
Once running, verify the backend connection by opening:
[http://localhost:3000/api/health](http://localhost:3000/api/health)

Expected response:
```

---

## 4. User Authentication & Login Credentials

### Default Seeded Operator Credentials
When `seedDevData()` is run in Google Apps Script, the default operator account is created:
- **Email:** `admin@tms.local`
- **Default Password:** `Admin@12345` *(or the custom password set in Script Property `SEED_ADMIN_PASSWORD`)*

### Logging In
1. Navigate to [http://localhost:3000/login](http://localhost:3000/login) (or root `/`, which redirects automatically).
2. Enter your credentials.
3. Upon success, an `httpOnly`, `Secure` session cookie named `tms_session` is issued, granting access to the App Shell and Dashboard.

### Changing the Password
1. Once logged in, click your name/avatar in the top-right corner of the header.
2. Select **Change Password** from the dropdown.
3. Enter your current password and your desired new password (minimum 6 characters).
4. Click **Update Password**.
5. Apps Script updates the cryptographic salt and SHA-256 hash in the `users` sheet, invalidates active sessions, and prompts you to log in with your new password.

### Security Notes
- **Rate Limiting:** If 5 consecutive failed login attempts occur within 10 minutes, the account is temporarily locked for 10 minutes via Google Apps Script `CacheService`.
- **Session Expiry:** By default, sessions remain active for 7 days (`SESSION_TTL_MINUTES=10080`), tracked server-side in the `sessions` sheet.
