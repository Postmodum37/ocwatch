import { test, expect } from '@playwright/test';

test('smoke test - page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('OCWatch');
});

test('smoke test - activity section visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h3:has-text("Live Activity")')).toBeVisible({ timeout: 10000 });
});

test('smoke test - graph view renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="graph-view"], [data-testid="graph-view-empty"], [data-testid="graph-view-loading"]')).toBeVisible({ timeout: 10000 });
});

test('smoke test - activity stream present', async ({ page }) => {
  await page.goto('/');
  const streamHeader = page.locator('h3:has-text("Activity Stream")');
  await expect(streamHeader).toBeVisible({ timeout: 10000 });
});
