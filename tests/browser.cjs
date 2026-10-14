/* Automated input checks application behavior, not physical-device accuracy.
 * Optional: node tests/browser.cjs /absolute/path/to/playwright */
const { chromium } = require(process.argv[2] || 'playwright');
const { createServer } = require('../tools/serve.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless:true });
    const context = await browser.newContext({ viewport:{ width:1440, height:1200 }, acceptDownloads:true });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil:'load' });
    assert.equal(await page.title(), 'Mouse Polling Rate Test – Open Source Mouse Hz Checker');
    assert.equal(await page.locator('h1').innerText(), 'Mouse Polling\nRate Test');
    assert.equal(await page.locator('#results tr').count(), 3);
    assert.ok((await page.locator('#capabilities').innerText()).includes('Secure context'));
    assert.equal(await page.locator('#export').isDisabled(), true);
    await page.locator('#start').click();
    // A synthetic DOM event must not start the capture.
    await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { bubbles:true })));
    assert.equal(await page.locator('#elapsed').innerText(), '0.0 / 10.0 s');
    // Browser-generated mouse movement reaches the trusted-event handlers.
    await page.mouse.move(400, 470);
    for (let i = 0; i < 60; i++) {
      await page.mouse.move(400 + i * 5, 470 + (i % 2) * 60, { steps:3 });
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    await page.waitForFunction(() => parseFloat(document.querySelector('#elapsed').textContent) >= 3);
    await page.locator('#stop').click();
    assert.ok((await page.locator('#status').innerText()).includes('Capture complete'));
    assert.equal(await page.locator('#export').isDisabled(), false);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadEvent;
    const payload = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(payload.experiment, 'Mouse Polling Rate Test');
    assert.ok(download.suggestedFilename().startsWith('mouse-polling-rate-test-'));
    assert.ok(payload.streams.mousemove.samples > 0);
    assert.ok(payload.streams.pointermove.samples > 0);
    assert.ok(payload.elapsedMs >= 3000);
    assert.equal(payload.measurementLayer, 'browser-visible mouse movement');
    assert.equal(payload.streams.pointermove.sampleCompleteness, 'not-established');
    assert.equal('timestamps' in payload.streams.pointermove, false);
    const before = await page.locator('#elapsed').innerText();
    await page.mouse.move(900, 700);
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(await page.locator('#elapsed').innerText(), before);
    const artifacts = path.resolve(__dirname, '../artifacts');
    fs.mkdirSync(artifacts, { recursive:true });
    // Reload to show an honest, empty screenshot instead of automation Hz.
    await page.reload();
    await page.screenshot({ path:path.join(artifacts, 'desktop.png'), fullPage:true });
    await page.locator('#start').click();
    await page.mouse.move(500, 500, { steps:5 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.ok((await page.locator('#status').innerText()).includes('Interrupted'));
    assert.equal(await page.locator('#start').isDisabled(), false);
    // Restart replaces previous data, and a manual stop before movement is empty.
    await page.reload();
    await page.locator('#start').focus();
    await page.keyboard.press('Enter');
    await page.locator('#stop').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#export').isDisabled(), true);
    // Full timed capture stops automatically, even if movement stops early.
    await page.locator('#start').focus();
    await page.keyboard.press('Enter');
    await page.mouse.move(510, 510, { steps:5 });
    await page.waitForFunction(() => document.querySelector('#start').disabled === false, { timeout:12000 });
    assert.equal(await page.locator('#elapsed').innerText(), '10.0 / 10.0 s');
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height:1000 });
      await page.reload();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path:path.join(artifacts, `viewport-${width}.png`), fullPage:true });
    }
    assert.deepEqual(errors, []);
    const hidden = await context.request.get(base + '/docs/PUBLISHING.md');
    assert.equal(hidden.status(), 404);
    console.log('Browser checks passed: trusted movement, export, stop, interruption, reset, auto-stop, responsive layout, no runtime errors.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
