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
  const rawUrl = process.env.APPS_SCRIPT_EXEC_URL;
  const execUrl = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : '';
  const rawSecret = process.env.APPS_SCRIPT_SHARED_SECRET;
  const sharedSecret = rawSecret ? rawSecret.trim().replace(/^["']|["']$/g, '') : '';

  if (!execUrl) {
    return {
      success: false,
      data: null,
      message: 'Server Configuration Error: APPS_SCRIPT_EXEC_URL is not configured.',
      errors: [{ message: 'Missing APPS_SCRIPT_EXEC_URL environment variable' }],
    };
  }

  try {
    const response = await axios.post<ApiResponse<TResult>>(
      execUrl,
      {
        action,
        payload: payload || {},
        sessionToken: sessionToken || null,
        secret: sharedSecret || '', // Pass in body as well to ensure it survives Google redirect proxies
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-tms-proxy-secret': sharedSecret || '',
        },
        maxRedirects: 5,
        timeout: 45000, // Apps Script cold starts can take a few seconds
      }
    );

    return response.data;
  } catch (error: unknown) {
    let errorMessage = 'Failed to communicate with Google Apps Script backend';
    let errorCode = 'BACKEND_CONNECTION_ERROR';

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        errorMessage = 'Apps Script returned 401 Unauthorized. Ensure the Web App deployment has "Who has access" set to "Anyone" and script permissions are authorized.';
        errorCode = 'APPS_SCRIPT_AUTH_ERROR';
      } else if (error.response?.status === 404) {
        errorMessage = 'Apps Script URL not found (404). Check APPS_SCRIPT_EXEC_URL in .env.local.';
        errorCode = 'APPS_SCRIPT_NOT_FOUND';
      } else if (typeof error.response?.data === 'string' && error.response.data.includes('<html')) {
        errorMessage = 'Apps Script returned an HTML page instead of JSON. Ensure the Web App is deployed with "Who has access: Anyone".';
        errorCode = 'APPS_SCRIPT_HTML_RESPONSE';
      } else {
        errorMessage = error.response?.data?.message || error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      data: null,
      message: errorMessage,
      errors: [{ message: errorMessage, code: errorCode }],
    };
  }
}
