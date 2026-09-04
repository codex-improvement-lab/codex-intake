import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function demo(page) {
  await page.goto("/");
  await page.locator("#demo-button").click();
  await expect(page.locator("[data-source-card]")).toHaveCount(3);
}
async function exportJson(page) {
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-json-button").click();
  return readFile(await (await downloadPromise).path(), "utf8");
}
async function updateText(page, sourceId, text) {
  await page.locator(`[data-source-card='${sourceId}'] [data-edit-source]`).click();
  await page.locator("#composer-content").fill(text);
  await page.locator("#composer button[type=submit]").click();
  await expect(page.locator("#source-update-review")).toBeVisible();
}
async function accept(page) {
  await page.locator("#accept-source-update").click();
  await expect(page.locator("#source-update-review")).toBeHidden();
}

test("a source replacement previews changes, discards cleanly, accepts, and undoes", async ({ page }) => {
  await demo(page);
  const before = await exportJson(page);
  await updateText(page, "S01", "New source request\nMust preserve the replacement format.");
  await expect(page.locator("#brief-title")).toBeDisabled();
  await expect(page.locator("#download-json-button")).toBeDisabled();
  await expect(page.locator("#source-update-review")).toContainText("r1 → r2");
  await page.locator("#discard-source-update").click();
  expect(await exportJson(page)).toBe(before);
  await updateText(page, "S01", "New source request\nMust preserve the replacement format.");
  await accept(page);
  const after = JSON.parse(await exportJson(page));
  expect(after.sources.find(source => source.id === "S01").revision).toBe(2);
  expect(after.sources.find(source => source.id === "S02").revision).toBe(1);
  await page.locator("#undo-source-update").click();
  expect(await exportJson(page)).toBe(before);
});

test("replacement preserves edited content and separates candidates from a retained user requirement", async ({ page }) => {
  const secret = ["synthetic", "private", "value"].join("");
  await demo(page);
  await page.locator("#brief-title").fill("My reviewed task");
  await page.locator("#brief-objective").fill("My reviewed objective");
  const firstCriterion = page.locator(".criterion").first();
  await firstCriterion.locator("textarea").fill("My retained requirement");
  await firstCriterion.locator("[data-confirm-criterion]").click();
  const requirementFinding = page.locator(".ledger-row").filter({ has: page.locator(".type-requirement") }).first();
  await requirementFinding.locator("textarea").fill("My retained source interpretation");
  await updateText(page, "S01", ["Different task", "Must change the original rule.", ["password", secret].join("=")].join("\n"));
  await expect(page.locator("#source-update-review")).not.toContainText(secret);
  await expect(page.locator("#source-update-review")).toContainText("manual edit");
  await accept(page);
  await expect(page.locator("#brief-title")).toHaveValue("My reviewed task");
  await expect(page.locator("#brief-objective")).toHaveValue("My reviewed objective");
  const staleFinding = page.locator(".ledger-row.item-needs-review").filter({ has: page.locator("textarea", { hasText: "My retained source interpretation" }) });
  await staleFinding.locator(".pointer-chip").click();
  await expect(page.locator("[data-history-source='S01'][data-history-revision='1']")).toHaveClass(/source-pulse/);
  await expect(page.locator("#trace-lens")).toBeHidden();
  const kept = page.locator(".criterion.item-needs-review").filter({ has: page.locator("textarea", { hasText: "My retained requirement" }) });
  await expect(kept).toHaveCount(1);
  await kept.getByRole("button", { name: "Keep as my requirement" }).click();
  const exported = JSON.parse(await exportJson(page));
  const retained = exported.doneWhen.find(item => item.text === "My retained requirement");
  expect(retained).toMatchObject({ confirmation: "user-confirmed", authorship: "user-authored", pointer: { sourceId: "USER" }, previousPointer: { sourceId: "S01", sourceRevision: 1 } });
  expect(exported.findings.find(item => item.text === "My retained source interpretation").reviewStatus).toBe("needs-review");
  expect(exported.sourceHistory.some(source => source.id === "S01" && source.revision === 1)).toBe(true);
  expect(JSON.stringify(exported)).not.toContain(secret);
});

test("selected file replacement keeps its source ID and Undo preserves later manual edits", async ({ page }) => {
  await demo(page);
  await page.locator("[data-source-card='S02'] [data-replace-file]").click();
  await page.locator("#replace-file-input").setInputFiles({ name: "replacement.log", mimeType: "text/plain", buffer: Buffer.from("ERROR: replacement failure\npnpm test") });
  await expect(page.locator("#source-update-review")).toBeVisible();
  await accept(page);
  await expect(page.locator("[data-source-card='S02']")).toContainText("replacement.log");
  await page.locator("#brief-objective").fill("Edited after accepting the source update");
  await page.locator("#undo-source-update").click();
  await expect(page.locator("#brief-objective")).toHaveValue("Edited after accepting the source update");
  await expect(page.locator("[data-source-card='S02']")).not.toContainText("replacement.log");
});

test("source removal keeps later IDs and new source additions stay in one review batch", async ({ page }) => {
  await demo(page);
  await page.locator("[data-source-card='S02'] [data-remove]").click();
  await accept(page);
  await expect(page.locator("[data-source-card='S03']")).toHaveCount(1);
  await expect(page.locator("[data-source-card='S02']")).toHaveCount(0);
  await page.locator("#file-input").setInputFiles([
    { name: "one.txt", mimeType: "text/plain", buffer: Buffer.from("Must include one new case.") },
    { name: "two.txt", mimeType: "text/plain", buffer: Buffer.from("Must include another new case.") }
  ]);
  await expect(page.locator("#source-update-review")).toContainText("2 source changes");
  await accept(page);
  const data = JSON.parse(await exportJson(page));
  expect(data.sources.map(source => source.id)).toEqual(["S01", "S03", "S04", "S05"]);
});

test("clearing the desk discards an in-flight OCR result", async ({ page }) => {
  let releaseResponse;
  const responseReady = new Promise(resolve => { releaseResponse = resolve; });
  await page.route("**/api/ocr", async route => {
    await responseReady;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ text: "ERROR: late synthetic OCR", engine: "test fixture", languages: ["eng"], confidence: 99 }) }).catch(() => {});
  });
  await page.goto("/");
  await page.locator("#file-input").setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("selected synthetic bytes; OCR response is mocked") });
  const request = page.waitForRequest("**/api/ocr");
  await page.getByRole("button", { name: "Run local OCR" }).click();
  await request;
  await page.locator("#clear-button").click();
  releaseResponse();
  await expect(page.locator("[data-source-card]")).toHaveCount(0);
  await expect(page.locator("#source-update-review")).toBeHidden();
  await expect(page.locator("#brief-content")).toBeHidden();
});

for (const width of [1440, 390]) {
  test(`source update review fits ${width}px and makes no external request`, async ({ page }, testInfo) => {
    const external = [];
    const errors = [];
    page.on("request", request => { if (/^https?:/.test(request.url()) && !["localhost", "127.0.0.1"].includes(new URL(request.url()).hostname)) external.push(request.url()); });
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/");
    await expect(page.locator("#brief-empty")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await demo(page);
    await page.locator("#brief-title").fill("Reviewed export repair");
    await page.locator("#brief-objective").fill("Keep the task objective I reviewed.");
    await page.locator("[data-done-text]").first().fill("Keep my reviewed acceptance check.");
    await updateText(page, "S01", "Review the new task inputs\nMust keep the manually reviewed completion checks.");
    await expect(page.locator("#export-bar")).toBeHidden();
    await expect(page.locator("#toast")).not.toHaveClass(/toast-visible/);
    await page.locator("#source-update-review").evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
    await expect.poll(async () => {
      const heading = await page.locator(".update-heading").boundingBox();
      const header = await page.locator(".topbar").boundingBox();
      return heading.y - (header.y + header.height);
    }).toBeGreaterThanOrEqual(0);
    await expect(page.locator("#accept-source-update")).toBeInViewport();
    await expect(page.locator("#discard-source-update")).toBeInViewport();
    expect(await page.locator("#accept-source-update").evaluate(button => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`source-update-review-${width}.png`) });
    await accept(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });
}
