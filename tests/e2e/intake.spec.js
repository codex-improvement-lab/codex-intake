import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_AUTH_FIXTURE } from "../../src/demo.js";

function evidenceScreenshotPath(testInfo, filename) {
  if (process.env.CODEX_INTAKE_REFRESH_ASSETS === "1") {
    return path.resolve("assets", filename);
  }

  return testInfo.outputPath(filename);
}

async function acceptUpdate(page) {
  await expect(page.locator("#source-update-review")).toBeVisible();
  await page.locator("#accept-source-update").click();
  await expect(page.locator("#source-update-review")).toBeHidden();
}

test("the demo explains the product and preserves pointer navigation", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Drop the mess/i })).toBeVisible();
  await page.locator("#empty-demo-button").click();

  await expect(page.locator("#brief-title")).toHaveValue("Checkout export crashes after redaction");
  await expect(page.locator("[data-source-card]")).toHaveCount(3);
  await expect(page.locator("#risk-count")).toHaveText("3");
  await expect(page.locator(".criteria-list .criterion")).toHaveCount(5);

  await page.locator("[data-trace='S01']").click();
  await expect(page.locator("[data-source-card='S01']")).toHaveClass(/source-pulse/);
  await expect(page.locator("#trace-lens")).toBeVisible();
  await expect(page.locator(".pointer-chip.pointer-traced")).not.toHaveCount(0);
  await page.locator("#toast").evaluate((toast) => toast.classList.remove("toast-visible"));
  await page.waitForTimeout(220);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    const workspace = document.querySelector(".workspace");
    const target = workspace.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo(0, target);
  });
  await page.waitForTimeout(80);
  await page.screenshot({
    path: evidenceScreenshotPath(testInfo, "codex-intake-overview.png"),
    fullPage: false
  });

  await page.addStyleTag({ content: ".topbar,.export-bar{position:static!important}" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: evidenceScreenshotPath(testInfo, "codex-intake-full.png"),
    fullPage: true
  });
});

test("Markdown export is downloadable and omits raw source bodies", async ({ page }) => {
  await page.goto("/");
  await page.locator("#demo-button").click();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-md-button").click();
  const download = await downloadPromise;
  const filePath = await download.path();
  const content = await (await import("node:fs/promises")).readFile(filePath, "utf8");

  expect(download.suggestedFilename()).toBe("codex-intake-brief.md");
  expect(content).toContain("# Task brief");
  expect(content).toContain("S02:L2");
  expect(content).not.toContain(DEMO_AUTH_FIXTURE);
});

test("a screenshot can be OCRed locally into source-linked evidence", async ({ page }, testInfo) => {
  const screenshot = testInfo.outputPath("ocr-input.png");
  await page.setViewportSize({ width: 1000, height: 420 });
  await page.setContent(`<!doctype html><style>
    body{margin:0;background:white;color:black;font:700 36px Arial;padding:55px;line-height:1.55}
    .error{color:#a40000} code{font:700 30px monospace}
  </style><div>Checkout upload report</div><div class="error">ERROR: locator is missing</div><code>pnpm test -- export</code>`);
  await page.screenshot({ path: screenshot });

  await page.goto("/");
  await page.locator("#file-input").setInputFiles(screenshot);
  await expect(page.locator("[data-source-card]")) .toHaveCount(1);
  await page.getByRole("button", { name: "Run local OCR" }).click();
  await acceptUpdate(page);

  await expect(page.locator("[data-source-card] pre")).toContainText(/ERROR|locator/i, { timeout: 60_000 });
  await expect(page.locator(".ledger-list")).toContainText(/ERROR|locator/i);
  await expect(page.locator(".pointer-chip").first()).toContainText("S01:OCR:L");
});

test("the real-Mac handoff order preserves a user objective through upload, OCR, and Markdown", async ({ page }, testInfo) => {
  const screenshot = testInfo.outputPath("mac-handoff-input.png");
  const userObjective = "USER EDIT: keep this exact acceptance objective after every source refresh.";
  const syntheticSecret = "MAC_HANDOFF_SECRET_1234567890";

  await page.setViewportSize({ width: 1200, height: 520 });
  await page.setContent(`<!doctype html><style>
    body{margin:0;background:white;color:black;font:700 34px Arial;padding:60px;line-height:1.55}
    .error{color:#a40000} code,.secret{font:700 28px monospace}
  </style><div>Mac handoff screenshot</div><div class="error">ERROR: intake objective was replaced</div>
  <code>pnpm test -- edit-ownership</code><div class="secret">Bearer ${syntheticSecret}</div>`);
  await page.screenshot({ path: screenshot });

  await page.goto("/");
  await page.locator("#demo-button").click();
  await expect(page.locator("[data-source-card]")).toHaveCount(3);
  await page.locator(".pointer-chip").first().click();
  await expect(page.locator("[data-source-card].source-pulse")).toHaveCount(1);

  await page.locator("#brief-objective").fill(userObjective);
  await page.locator("#file-input").setInputFiles(screenshot);
  await acceptUpdate(page);
  await expect(page.locator("[data-source-card]")).toHaveCount(4);
  await expect(page.locator("#brief-objective")).toHaveValue(userObjective);

  const screenshotCard = page.locator("[data-source-card='S04']");
  await screenshotCard.getByRole("button", { name: "Run local OCR" }).click();
  await acceptUpdate(page);
  await expect(screenshotCard.locator("pre")).toContainText(/ERROR|objective/i, { timeout: 60_000 });
  await expect(page.locator(".pointer-chip").filter({ hasText: "S04:OCR:L" }).first()).toBeVisible();
  await expect(page.locator("#brief-objective")).toHaveValue(userObjective);
  await expect(page.locator(".risk-list")).toContainText(/credential|token/i);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-md-button").click();
  const download = await downloadPromise;
  const content = await readFile(await download.path(), "utf8");
  expect(content).toContain(userObjective);
  expect(content).toContain("S04:OCR:L");
  expect(content).not.toContain(syntheticSecret);
});

test("an unsupported binary is rejected without becoming a source", async ({ page }) => {
  await page.goto("/");
  await page.locator("#file-input").setInputFiles({
    name: "customer-brief.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF synthetic body that must not be parsed")
  });

  await expect(page.locator("[data-source-card]")).toHaveCount(0);
  await expect(page.locator("#toast")).toContainText("not extracted");
});
