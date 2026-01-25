/*
Run with:
  npm run playwright:console

Notes:
  - Make sure the app is running at http://localhost:3000/practice
  - Optionally override the URL with PLAYWRIGHT_URL
*/

import { chromium } from 'playwright';

const targetUrl = process.env.PLAYWRIGHT_URL || 'http://localhost:3000/practice';

const formatLocation = (location) => {
  if (!location || !location.url) {
    return '';
  }
  const line = location.lineNumber ?? 0;
  const column = location.columnNumber ?? 0;
  return ` (${location.url}:${line}:${column})`;
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() !== 'error') {
      return;
    }
    const location = formatLocation(msg.location());
    console.log(`[console.error]${location} ${msg.text()}`);
  });

  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error.stack || error.message}`);
  });

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  } catch (error) {
    console.log(`[navigationerror] ${error.stack || error.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
};

run();
