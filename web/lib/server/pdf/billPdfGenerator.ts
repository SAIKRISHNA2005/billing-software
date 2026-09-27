import fs from 'fs';
import puppeteer from 'puppeteer-core';

/**
 * Automatically locate Chrome or Edge executable on Windows/Linux
 */
export function getBrowserExecutablePath(): string {
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) return p;
  }

  throw new Error('No compatible Chrome or Edge browser executable found on this system for PDF rendering.');
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
