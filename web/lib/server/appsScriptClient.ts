import axios from 'axios';

export interface AppsScriptRequest<T = unknown> {
  action: string;
  payload?: T;
  sessionToken?: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
  errors?: Array<{ field?: string; message: string; code?: string }>;
}

/**
 * Server-side helper function to invoke Google Apps Script Web App
 * STRICT RULE R5: Only invoked from Next.js server Route Handlers under /web/app/api/**.
 */
export async function callAppsScript<TResult = unknown, TPayload = unknown>(
  action: string,
  payload?: TPayload,
  sessionToken?: string | null
): Promise<ApiResponse<TResult>> {
  // Resolve environment variable across multiple standard naming patterns
  const rawUrl =
    process.env.APPS_SCRIPT_EXEC_URL ||
    process.env.NEXT_PUBLIC_APPS_SCRIPT_EXEC_URL ||
    process.env.APPSCRIPT_EXEC_URL ||
    process.env.APPS_SCRIPT_URL ||
    process.env.APPSCRIPT_URL;

  let execUrl = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : '';
  // Ensure trailing slashes are trimmed
  execUrl = execUrl.replace(/\/+$/, '');

  const rawSecret =
    process.env.APPS_SCRIPT_SHARED_SECRET ||
    process.env.APPSCRIPT_SHARED_SECRET ||
    process.env.SHARED_SECRET;
  const sharedSecret = rawSecret ? rawSecret.trim().replace(/^["']|["']$/g, '') : '';

  if (!execUrl) {
    return {
      success: false,
      data: null,
      message: 'Server Configuration Error: APPS_SCRIPT_EXEC_URL is not configured in environment variables.',
      errors: [{ message: 'Missing APPS_SCRIPT_EXEC_URL environment variable' }],
    };
  }

  const requestBody = JSON.stringify({
    action,
    payload: payload || {},
    sessionToken: sessionToken || null,
    secret: sharedSecret || '',
  });

  let lastError: unknown = null;
  const maxAttempts = 3;
  const backoffDelays = [1000, 2500, 5000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Send POST with manual redirect handling to reliably capture 302 Location header
      let response = await fetch(execUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tms-proxy-secret': sharedSecret || '',
        },
        body: requestBody,
        redirect: 'manual',
        signal: AbortSignal.timeout ? AbortSignal.timeout(120000) : undefined,
      });

      // Follow Google Apps Script 301/302/307/308 redirect to echo endpoint via GET
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          response = await fetch(location, {
            method: 'GET',
            redirect: 'follow',
            signal: AbortSignal.timeout ? AbortSignal.timeout(120000) : undefined,
          });
        }
      }

      const text = await response.text();

      // Check if response is HTML (Google authorization prompt or 404 page)
      if (text.includes('<html') || text.includes('<!DOCTYPE html>')) {
        if (response.status === 404 || text.includes('404 Not Found') || text.includes('The requested URL was not found')) {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, backoffDelays[attempt - 1]));
            continue;
          }
          return {
            success: false,
            data: null,
            message: 'Apps Script endpoint returned 404 after retries. The web app deployment may be warming up or temporarily unreachable.',
            errors: [{ code: 'APPS_SCRIPT_404', message: 'Apps Script Web App 404 response' }],
          };
        }

        if (response.status === 401 || text.includes('accounts.google.com') || text.includes('Sign in')) {
          return {
            success: false,
            data: null,
            message: 'Apps Script requires authentication. Ensure the Web App is deployed with "Who has access: Anyone".',
            errors: [{ code: 'APPS_SCRIPT_AUTH_ERROR', message: 'Access denied: authorization required' }],
          };
        }
      }

      // Parse JSON response
      try {
        const jsonResult = JSON.parse(text) as ApiResponse<TResult>;

        // If GAS redirected to doGet ping instead of executing action
        if (
          jsonResult &&
          typeof jsonResult.message === 'string' &&
          (jsonResult.message.includes('Send POST') || jsonResult.message.includes('Web App is active')) &&
          (!jsonResult.data || typeof jsonResult.data !== 'object' || Object.keys(jsonResult.data).length <= 4)
        ) {
          try {
            const fallbackUrl = `${execUrl}?action=${encodeURIComponent(action)}&data=${encodeURIComponent(requestBody)}`;
            const fallbackRes = await fetch(fallbackUrl, {
              method: 'GET',
              headers: { 'x-tms-proxy-secret': sharedSecret || '' },
              redirect: 'follow',
            });
            const fallbackText = await fallbackRes.text();
            if (fallbackText && !fallbackText.includes('<html')) {
              return JSON.parse(fallbackText) as ApiResponse<TResult>;
            }
          } catch {
            // continue with normal flow
          }
        }

        return jsonResult;
      } catch (parseErr) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, backoffDelays[attempt - 1]));
          continue;
        }
        return {
          success: false,
          data: null,
          message: 'Received invalid response from Google Apps Script backend.',
          errors: [{ code: 'INVALID_JSON_RESPONSE', message: text.substring(0, 300) }],
        };
      }
    } catch (error: unknown) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, backoffDelays[attempt - 1]));
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown communication error';
  return {
    success: false,
    data: null,
    message: `Failed to communicate with Google Apps Script backend: ${errorMessage}`,
    errors: [{ message: errorMessage, code: 'BACKEND_CONNECTION_ERROR' }],
  };
}
