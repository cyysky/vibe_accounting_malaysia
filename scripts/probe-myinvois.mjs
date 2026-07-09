import { chromium } from 'playwright';

const targets = [
  'https://sdk.myinvois.hasil.gov.my/einvoicingapi/',
  'https://sdk.myinvois.hasil.gov.my/signature/',
  'https://sdk.myinvois.hasil.gov.my/integration-practices/',
  'https://sdk.myinvois.hasil.gov.my/postman/',
  'https://sdk.myinvois.hasil.gov.my/document-validation-rules/',
  'https://sdk.myinvois.hasil.gov.my/types/',
  'https://sdk.myinvois.hasil.gov.my/codes/',
  'https://sdk.myinvois.hasil.gov.my/standard-header-parameters/',
  'https://sdk.myinvois.hasil.gov.my/sample',
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0' });

for (const url of targets) {
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' });
    const status = resp ? resp.status() : 'no-response';
    const title  = await page.title();
    const text   = (await page.locator('body').first().innerText().catch(() => ''))
      .replace(/\s+/g, ' ').trim().slice(0, 2500);
    console.log(`\n========== ${url} ==========`);
    console.log(`status: ${status}`);
    console.log(`title:  ${title}`);
    console.log(`text:   ${text}`);
  } catch (e) {
    console.log(`\n========== ${url} ==========`);
    console.log(`ERROR:   ${e.message}`);
  } finally {
    await page.close();
  }
}

await ctx.close();
await browser.close();
