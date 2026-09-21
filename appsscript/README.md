# Google Apps Script Backend (`/appsscript`)

This directory houses the Google Apps Script codebase managed via Google's `clasp` CLI.

## Manual Setup Steps (Phase 0):
1. Install clasp globally:
   ```bash
   npm install -g @google/clasp
   ```
2. Log in with your Google account:
   ```bash
   clasp login
   ```
3. Enable the Google Apps Script API:
   - Visit https://script.google.com/home/usersettings
   - Toggle **Google Apps Script API** to **ON**.
4. Link this directory to your Apps Script project:
   - If you already created an Apps Script project bound to your Google Sheet:
     ```bash
     cd appsscript
     clasp clone <YOUR_SCRIPT_ID>
     ```
   - Or create a new standalone/bound project:
     ```bash
     cd appsscript
     clasp create --title "TMS-Backend" --type sheets --rootDir .
     ```
