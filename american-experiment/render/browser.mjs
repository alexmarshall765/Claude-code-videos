// Headless Chrome via Puppeteer, shared by capture.mjs and check.mjs.
// Set CHROME_PATH to use an installed Chrome/Chromium instead of Puppeteer's download.

import puppeteer from 'puppeteer';
import { startServer } from './serve.mjs';

export async function launch({ onFrame = null } = {}) {
  const server = await startServer({ onFrame });
  const args = ['--force-color-profile=srgb', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio'];
  if (process.getuid && process.getuid() === 0) args.push('--no-sandbox');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args,
    protocolTimeout: 600000,
  });
  return { browser, server, base: `http://127.0.0.1:${server.port}` };
}

/** Open the film page in render mode and wait for fonts, data and the first layout. */
export async function openFilm(ctx, { scale = 1, flags = '' } = {}) {
  const page = await ctx.browser.newPage();
  await page.setViewport({ width: 1920 * scale, height: 1080 * scale, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${ctx.base}/web/index.html?render&scale=${scale}${flags}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.ready, { timeout: 60000 });
    await page.evaluate(() => window.ready);
  } catch (e) {
    throw new Error(`film page failed to start: ${errors.join(' | ') || e.message}`);
  }
  page.filmErrors = errors;
  return page;
}

export async function close(ctx) {
  await ctx.browser.close();
  ctx.server.close();
}
