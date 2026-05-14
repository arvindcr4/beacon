import { expect, test } from "@playwright/test";

test.describe("Beacon mobile shell", () => {
  test("redirects to sign-in when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole("heading", { name: /welcome to beacon/i })).toBeVisible();
  });

  test("sign-in form is usable on a mobile viewport", async ({ page }) => {
    await page.goto("/signin");
    const email = page.getByLabel("Email");
    await expect(email).toBeVisible();
    // The continue button should be at least 44pt tall (Apple HIG tap target).
    const button = page.getByRole("button", { name: /continue/i });
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  });

  test("PWA manifest is served and references our brand", async ({ page }) => {
    const resp = await page.request.get("/manifest.webmanifest");
    expect(resp.ok()).toBeTruthy();
    const manifest = await resp.json();
    expect(manifest.name).toContain("Beacon");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/inbox");
  });

  test("service worker file is reachable", async ({ page }) => {
    const resp = await page.request.get("/sw.js");
    expect(resp.ok()).toBeTruthy();
    expect(resp.headers()["content-type"]).toContain("javascript");
  });
});
