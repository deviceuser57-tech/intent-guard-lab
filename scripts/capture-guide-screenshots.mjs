import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173";
const outputDir = "public/guide-screenshots";
const pageErrors = [];
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(15000);
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Prompt Engineering Workbench" }).waitFor({
    state: "visible",
  });
  const taskInput = page.locator('textarea[aria-label="Describe what you need the prompt to do"]');
  await taskInput.fill(
    "Create a TypeScript function to validate email addresses and include unit tests.",
  );
  await page.screenshot({
    path: `${outputDir}/01-task-input.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Generate prompt" }).click();
  const driftAlert = page.getByRole("alert").filter({
    hasText: "Intent classification disagreement",
  });
  await driftAlert.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  if (await driftAlert.isVisible().catch(() => false)) {
    await page.screenshot({
      path: `${outputDir}/11-analyzer-review-gate.png`,
      fullPage: true,
    });
    await driftAlert.getByRole("button", {
      name: "Continue with current Workbench classification",
    }).click();
    await driftAlert.waitFor({ state: "hidden", timeout: 5000 });
  }
  await page.getByRole("button", { name: "Compiled Prompts" }).waitFor({
    state: "visible",
  });
  const compiled = page.locator(".workbench-content-compiled");
  await compiled.waitFor({ state: "visible" });
  await page.getByText("System instructions", { exact: true }).waitFor({ state: "visible" });
  await page.getByText("Output contract", { exact: true }).waitFor({ state: "visible" });
  assert.ok((await compiled.innerText()).trim().length > 100, "Generation must populate the compiled prompt panel");
  await page.screenshot({
    path: `${outputDir}/02-compiled-prompt.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Intent Analysis" }).click();
  await page.locator(".workbench-content-intent").waitFor({ state: "visible" });
  assert.ok((await page.locator(".workbench-content-intent").innerText()).trim().length > 20);
  await page.screenshot({
    path: `${outputDir}/02-intent-analysis.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Specification" }).click();
  await page.locator(".workbench-content-spec").waitFor({ state: "visible" });
  assert.ok((await page.locator(".workbench-content-spec").innerText()).trim().length > 20);
  await page.screenshot({
    path: `${outputDir}/03-specification.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Security / Validation" }).click();
  await page.locator(".workbench-content-security").waitFor({ state: "visible" });
  await page.getByText(/Security score/).waitFor({ state: "visible" });
  await page.screenshot({
    path: `${outputDir}/05-security-validation.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Compiled Prompts" }).click();
  await page.getByRole("button", { name: "openai", exact: true }).click();
  const exportPanel = page.locator(".workbench-content-compiled");
  assert.match(await exportPanel.innerText(), /messages|model|chat\/completions/i, "OpenAI export must render a provider payload");
  await page.screenshot({
    path: `${outputDir}/06-openai-export.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Live Playground" }).click();
  await page.locator(".workbench-content-playground").waitFor({ state: "visible" });
  await page.getByText("Fill variables", { exact: true }).waitFor({ state: "visible" });
  await page.screenshot({
    path: `${outputDir}/04-playground.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Prompt Registry" }).click();
  await page.locator(".workbench-content-registry").waitFor({ state: "visible" });
  assert.ok((await page.locator(".workbench-content-registry").innerText()).trim().length > 10);
  await page.screenshot({
    path: `${outputDir}/08-prompt-registry.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "العربية" }).click();
  await page.getByRole("heading", { name: "منصة هندسة الأوامر" }).waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    document.documentElement.lang === "ar" && document.documentElement.dir === "rtl",
  );
  assert.equal(await page.evaluate(() => document.documentElement.lang), "ar");
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  await page.screenshot({
    path: `${outputDir}/09-arabic-desktop.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, "Arabic layout must not overflow horizontally at 390px width");
  await page.screenshot({
    path: `${outputDir}/10-arabic-mobile.png`,
    fullPage: true,
  });

  assert.deepEqual(pageErrors, [], `Browser runtime errors: ${pageErrors.join("; ")}`);
} finally {
  await browser.close();
}
