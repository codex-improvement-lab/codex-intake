import { expect, test } from "@playwright/test";

test("keyboard file selection activates the picker once per key", async ({ page }) => {
  await page.goto("/");
  await page.locator("#demo-button").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#choose-files-button")).toBeFocused();

  await page.evaluate(() => {
    const input = document.querySelector("#file-input");
    window.__filePickerInvocations = 0;
    input.click = () => { window.__filePickerInvocations += 1; };
  });

  await page.locator("#choose-files-button").focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.__filePickerInvocations)).toBe(1);

  await page.keyboard.press("Space");
  expect(await page.evaluate(() => window.__filePickerInvocations)).toBe(2);

  await page.locator("#dropzone").click({ position: { x: 12, y: 12 } });
  expect(await page.evaluate(() => window.__filePickerInvocations)).toBe(3);
});
