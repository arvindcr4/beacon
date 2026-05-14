const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('file:///Users/m1/projects/beacon/play-assets/screenshot-templates/feature-graphic.html');
  await page.screenshot({ path: '/Users/m1/projects/beacon/play-assets/feature-graphic.png', fullPage: false, clip: { x: 0, y: 0, width: 1024, height: 500 } });
  await browser.close();
  console.log('✓ feature-graphic.png');
})().catch(e => { console.error(e); process.exit(1); });
