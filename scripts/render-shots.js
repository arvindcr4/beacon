const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  const root = '/Users/m1/projects/beacon/play-assets';
  const files = [
    ['screenshot-templates/inbox.html', 'screenshots/01-inbox.png'],
    ['screenshot-templates/message.html', 'screenshots/02-message-ai.png'],
    ['screenshot-templates/compose.html', 'screenshots/03-compose-ai.png'],
  ];
  for (const [src, out] of files) {
    const page = await ctx.newPage();
    await page.goto('file://' + path.join(root, src));
    await page.screenshot({
      path: path.join(root, out),
      fullPage: false,
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
    });
    await page.close();
    console.log('✓', out);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
