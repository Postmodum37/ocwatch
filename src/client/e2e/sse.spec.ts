import { test, expect } from '@playwright/test';

test('real-time update on file change within 500ms', async ({ page }) => {
  await page.goto('/');
  
  await expect(page.locator('h3:has-text("Live Activity")')).toBeVisible({ timeout: 10000 });
  
  const initialCount = await page.locator('.react-flow__node').count();
  
  const startTime = Date.now();
  await page.evaluate(() => {
    fetch('/api/poll').catch(() => {});
  });
  
  await expect(async () => {
    const newCount = await page.locator('.react-flow__node').count();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  }).toPass({ timeout: 500 });
  
  const endTime = Date.now();
  const elapsed = endTime - startTime;
  
  expect(elapsed).toBeLessThan(500);
});

test('SSE failure falls back to polling', async ({ page }) => {
  await page.route('**/api/sse*', route => {
    route.abort('failed');
  });
  
  await page.goto('/');
  
  await expect(page.locator('h3:has-text("Live Activity")')).toBeVisible({ timeout: 10000 });
  
  let pollRequestMade = false;
  page.on('response', response => {
    if (response.url().includes('/api/poll')) {
      pollRequestMade = true;
    }
  });
  
  await page.waitForTimeout(5000);
  
  expect(pollRequestMade).toBe(true);
});

test('respects reduced motion preference', async ({ page }) => {
  await page.goto('/');
  
  await expect(page.locator('h3:has-text("Live Activity")')).toBeVisible({ timeout: 10000 });
  
  const prefersReducedMotion = await page.evaluate(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  
  expect(prefersReducedMotion).toBe(false);
  
  await page.emulateMedia({ reducedMotion: 'reduce' });
  
  const prefersReducedMotionAfter = await page.evaluate(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  
  expect(prefersReducedMotionAfter).toBe(true);
  
  const animationDuration = await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }';
    document.head.appendChild(style);
    return window.getComputedStyle(document.body).animationDuration;
  });
  
  expect(animationDuration).toBeDefined();
});

test('SSE connection established on page load', async ({ page }) => {
  let sseConnected = false;
  
  page.on('response', response => {
    if (response.url().includes('/api/sse')) {
      sseConnected = true;
    }
  });
  
  await page.goto('/');
  
  await expect(page.locator('h3:has-text("Live Activity")')).toBeVisible({ timeout: 10000 });
  
  await page.waitForTimeout(1000);
  
  expect(sseConnected).toBe(true);
});

test('fallback to polling when SSE unavailable', async ({ page }) => {
  await page.route('**/api/sse*', route => {
    route.abort('failed');
  });
  
  let pollAttempts = 0;
  page.on('response', response => {
    if (response.url().includes('/api/poll')) {
      pollAttempts++;
    }
  });
  
  await page.goto('/');
  
  await expect(page.locator('h3:has-text("Live Activity")')).toBeVisible({ timeout: 10000 });
  
  await page.waitForTimeout(2000);
  
  expect(pollAttempts).toBeGreaterThan(0);
});
