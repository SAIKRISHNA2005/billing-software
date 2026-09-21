/**
 * Transport & Logistics Management System (TMS) - Google Apps Script Backend
 * Phase 2 - Project Scaffolding & Health Check
 */

// Action Handler Registry
const ACTION_HANDLERS = {
  health: handleHealthCheck,
  setup: function() {
    return createAllSheets();
  },
  seedDev: function() {
    return seedDevData();
  },
  runTests: function() {
    return runAllTests();
  },
};

/**
 * Direct Toolbar Runner Functions
 * These appear in the top toolbar function dropdown regardless of which file is selected.
 */
function createAllSheetsRunner() {
  const res = createAllSheets();
  Logger.log('createAllSheets: ' + JSON.stringify(res));
  return res;
}

function seedDevDataRunner() {
  const res = seedDevData();
  Logger.log('seedDevData: ' + JSON.stringify(res));
  return res;
}

function runAllTestsRunner() {
  const res = runAllTests();
  Logger.log('runAllTests: ' + JSON.stringify(res));
  return res;
}

/**
 * Main Web App POST Entrypoint
 */
function doPost(e) {
  try {
    // 1. Verify Post Data exists
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Bad Request: Missing request body",
        errors: [{ message: "Missing request body" }],
      });
    }

    // 2. Parse request payload
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Bad Request: Malformed JSON payload",
        errors: [{ message: parseErr.message }],
      });
    }

    const action = body.action;
    const payload = body.payload || {};
    const sessionToken = body.sessionToken || null;

    // 3. Verify Shared Secret
    const scriptProperties = PropertiesService.getScriptProperties();
    const configuredSecret = scriptProperties.getProperty("SHARED_SECRET");

    // Allow secret from query params, body.secret, or headers if present
    const incomingSecret =
      (e.parameter && e.parameter.secret) ||
      body.secret ||
      (e.headers && (e.headers["x-tms-proxy-secret"] || e.headers["X-Tms-Proxy-Secret"]));

    if (configuredSecret && incomingSecret !== configuredSecret) {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Forbidden: Invalid or missing proxy secret",
        errors: [{ code: "FORBIDDEN", message: "Unauthorized proxy caller" }],
      });
    }

    // 4. Validate Action
    if (!action) {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Bad Request: Action parameter is required",
        errors: [{ message: "Missing action" }],
      });
    }

    const handler = ACTION_HANDLERS[action];
    if (typeof handler !== "function") {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Action not supported: " + action,
        errors: [{ code: "ACTION_NOT_FOUND", message: "Unknown action: " + action }],
      });
    }

    // 5. Execute Action Handler
    const result = handler(payload, sessionToken);

    return createJsonResponse({
      success: true,
      data: result,
      message: "Operation completed successfully",
      errors: [],
    });
  } catch (error) {
    // Catch-all to prevent raw stack trace leakage
    return createJsonResponse({
      success: false,
      data: null,
      message: error.message || "An unexpected server error occurred",
      errors: [{ message: error.message || "Internal error" }],
    });
  }
}

/**
 * Health Check Action Handler
 * Verifies connectivity to the configured Google Spreadsheet.
 */
function handleHealthCheck(payload, sessionToken) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty("SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("Configuration Error: SPREADSHEET_ID is not set in Script Properties.");
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    return {
      ok: true,
      sheetConnected: true,
      spreadsheetName: spreadsheet.getName(),
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    throw new Error("Failed to connect to Google Sheet with ID '" + spreadsheetId + "': " + err.message);
  }
}

/**
 * Web App GET Entrypoint (Convenience / Ping)
 */
function doGet(e) {
  return createJsonResponse({
    success: true,
    data: {
      service: "Transport Logistics Management System (TMS) API",
      status: "online",
      runtime: "Apps Script V8",
      timestamp: new Date().toISOString(),
    },
    message: "TMS Apps Script Web App is active. Send POST requests to invoke actions.",
    errors: [],
  });
}

/**
 * Helper to construct JSON response
 */
function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}
