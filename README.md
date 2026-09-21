# Transport & Logistics Management System (TMS)

A modern, streamlined Transport & Logistics Management System built for single-operator dispatch, movement tracking, trip expense reconciliation, and financial-year automated billing.

## Architecture

```
Browser Client (Ant Design UI, React Hook Form, TanStack Query)
         │
         ▼
Next.js 14 App Router (/web)  ──[Server-side API Proxy (/api/**)]──> Google Apps Script Web App (/appsscript)
                                (httpOnly session cookies,           (Validation, Numbering, LockService,
                                 shared-secret header)                Google Docs PDF, Google Sheets DB)
                                                                               │
                                                                               ▼
                                                                     Google Sheets Database
```

## Directory Structure

- `/web`: Next.js 14 App Router frontend application with TypeScript strict, Ant Design 5, TanStack Query, and Vitest.
- `/appsscript`: Google Apps Script backend code managed and deployed via Google's `clasp` CLI.
- `/docs`: Foundational architecture documents, sheets schema specifications, business workflows, and setup guides.

## Quick Start

See [docs/SETUP.md](docs/SETUP.md) for complete step-by-step setup instructions, including Google Sheets configuration, Apps Script deployment, and environment variables.

### Running Frontend Locally

```bash
cd web
npm install
npm run dev
```

### Running Tests

```bash
cd web
npm run test
```
