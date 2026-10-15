import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173";
const outputDir = "public/guide-screenshots";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(15000);

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const taskInput = page.locator('textarea[aria-label="Describe what you need the prompt to do"]');
  await taskInput.fill(
    "Create a TypeScript function to validate email addresses and include unit tests.",
  );
  await page.screenshot({
    path: `${outputDir}/01-task-input.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Generate prompt" }).click();
  await page.getByRole("button", { name: "Intent Analysis" }).waitFor({
    state: "visible",
  });
  await page.getByRole("button", { name: "Intent Analysis" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${outputDir}/02-intent-analysis.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Specification" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${outputDir}/03-specification.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Playground" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${outputDir}/04-playground.png`,
    fullPage: true,
  });
} finally {
  await browser.close();
}
