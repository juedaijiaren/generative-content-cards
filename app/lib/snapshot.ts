import 'server-only';
import { existsSync } from 'node:fs';
import { chromium, type Browser } from 'playwright';

let browserPromise: Promise<Browser> | null = null;

function chromeExecutablePath() {
  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => existsSync(candidate));
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      executablePath: chromeExecutablePath(),
    });
  }
  return browserPromise;
}

export async function capture(id: string): Promise<Buffer> {
  const baseUrl = process.env.SNAPSHOT_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/preview/${id}?mode=snapshot`;

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    // domcontentloaded 即可——LLM 输出有时 HTML 不完整，networkidle 会一直等
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 兜底：snapshot 类如果没自动注入（HTML 截断或脚本未执行），手动加一下
    await page
      .waitForFunction(() => document.body?.classList.contains('snapshot'), {
        timeout: 3000,
      })
      .catch(async () => {
        await page.evaluate(() => {
          if (document.body) document.body.classList.add('snapshot');
        });
      });

    await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
    await page.waitForTimeout(500);

    const buffer = await page.screenshot({
      type: 'png',
      fullPage: true,
    });
    return buffer;
  } finally {
    await context.close();
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
