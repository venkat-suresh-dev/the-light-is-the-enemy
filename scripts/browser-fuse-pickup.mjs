/**
 * Browser-runtime fuse pickup verification via Puppeteer.
 * Run with: node scripts/browser-fuse-pickup.mjs
 * Requires: npx puppeteer (auto-downloaded on first run)
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = 8766;
const URL = `http://127.0.0.1:${PORT}/?debug=true&objective=fuse`;

let server;
async function startServer() {
  server = spawn('python', ['-m', 'http.server', String(PORT)], {
    cwd: root,
    stdio: 'ignore',
    shell: true,
  });
  await new Promise((r) => setTimeout(r, 800));
}

function stopServer() {
  if (server) server.kill();
}

async function main() {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.error('puppeteer not installed; skipping browser test (module tests cover lifecycle)');
    process.exit(0);
  }

  await startServer();
  const browser = await puppeteer.default.launch({ headless: 'new' });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));

  try {
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.waitForSelector('#btn-play', { timeout: 5000 });
    await page.click('#btn-play');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    await page.click('#game-canvas');

    // Walk right toward debug-placed fuse (~6 tiles east)
    for (let i = 0; i < 40; i++) {
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(50);
      await page.keyboard.up('KeyD');
    }

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);

    const debugText = await page.evaluate(() => {
      const el = document.getElementById('debug-overlay');
      return el ? el.textContent : '';
    });

    const fuseCollected = debugText.includes('collected=true');
    const phaseGenerator = debugText.includes('findGenerator') || debugText.includes('Find the backup generator');
    const pickupSuccess = /success=\d+/.test(debugText) && !debugText.match(/success=0\b/);

    console.log('Browser debug excerpt:');
    console.log(debugText.split('\n').filter((l) => l.includes('FUSE') || l.includes('Objective') || l.includes('success')).join('\n'));

    if (!fuseCollected && !phaseGenerator) {
      console.error('FAIL: fuse not collected in browser');
      process.exit(1);
    }
    console.log('OK: browser fuse pickup path verified');
    process.exit(0);
  } catch (err) {
    console.error('Browser test error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
    stopServer();
  }
}

main();
