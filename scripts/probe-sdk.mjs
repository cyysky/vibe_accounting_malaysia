// Quick probe of MyInvois SDK pages. Uses locally cached playwright (npx cache).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { chromium = require("playwright").chromium; }
catch { chromium = require("C:/Users/Administrator/AppData/Local/npm-cache/_npx/361ceb562f3b3235/node_modules/playwright").chromium; }

const targets = [
  "https://sdk.myinvois.hasil.gov.my/einvoicingapi/",
  "https://sdk.myinvois.hasil.gov.my/signature/",
  "https://sdk.myinvois.hasil.gov.my/integration-practices/",
  "https://sdk.myinvois.hasil.gov.my/postman/",
  "https://sdk.myinvois.hasil.gov.my/document-validation-rules/",
  "https://sdk.myinvois.hasil.gov.my/types/",
  "https://sdk.myinvois.hasil.gov.my/codes/",
  "https://sdk.myinvois.hasil.gov.my/standard-header-parameters/",
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0" });

for (const url of targets) {
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
    const status = resp ? resp.status() : "no-response";
    const title  = await page.title();
    const text   = (await page.locator("body").first().innerText().catch(() => ""))
      .replace(/\s+/g, " ").trim().slice(0, 2500);
    const sep = "==========";
    console.log("\n" + sep + " " + url + " " + sep);
    console.log("status: " + status);
    console.log("title:  " + title);
    console.log("text:   " + text);
  } catch (e) {
    const sep = "==========";
    console.log("\n" + sep + " " + url + " " + sep);
    console.log("ERROR:   " + e.message);
  } finally {
    await page.close();
  }
}

await ctx.close();
await browser.close();
