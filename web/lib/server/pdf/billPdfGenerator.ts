import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

/**
 * Automatically locate Chrome, Chromium, Edge, or Brave executable on Windows, Linux, or macOS
 */
export function getBrowserExecutablePath(): string {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    process.env.CHROME_BIN,
    // Standard 64-bit & 32-bit Program Files (Chrome, Chromium, Edge, Brave)
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Chromium', 'Application', 'chrome.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    // Per-user non-admin installations (AppData Local)
    localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    localAppData ? path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : '',
    localAppData ? path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') : '',
    localAppData ? path.join(localAppData, 'Chromium', 'Application', 'chrome.exe') : '',
    // Linux distributions
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) return p;
  }

  throw new Error('No compatible Chrome or Edge browser executable found on this system for PDF rendering.');
}

/**
 * Returns true if a compatible browser executable is available for server-side PDF generation
 */
export function isBrowserAvailable(): boolean {
  try {
    getBrowserExecutablePath();
    return true;
  } catch {
    return false;
  }
}

/**
 * Renders an A4 PDF Buffer in-memory from HTML
 * The generated PDF is NOT stored to disk.
 */
export async function generateBillPdfBuffer(html: string): Promise<Buffer> {
  const executablePath = getBrowserExecutablePath();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Returns PDF as Base64 string for direct client downloads
 */
export async function generateBillPdfBase64(html: string): Promise<string> {
  const buffer = await generateBillPdfBuffer(html);
  return buffer.toString('base64');
}
