import { test, expect } from '@playwright/test';

test('smoke test - page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('client');
});

test('smoke test - activity section visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h3:has-text("Live Activity")')).toBeVisible();
});
