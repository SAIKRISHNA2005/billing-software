import axios from 'axios';

/**
 * Frontend Axios client instance
 * STRICT RULE R5: Always calls Next.js's own /api routes, NEVER Apps Script directly.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standard error formatting
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // If unauthorized and in browser, redirect to login unless already there
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
