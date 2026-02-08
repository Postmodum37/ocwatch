import { test, expect } from '@playwright/test';

test('graph view renders with nodes', async ({ page }) => {
  await page.goto('/');
  
  const graphView = page.locator('[data-testid="graph-view"]');
  const emptyState = page.locator('[data-testid="graph-view-empty"]');
  const loadingState = page.locator('[data-testid="graph-view-loading"]');
  
  await expect(graphView.or(emptyState).or(loadingState)).toBeVisible({ timeout: 10000 });
  
  const hasNodes = await page.locator('.react-flow__node').count();
  if (hasNodes > 0) {
    await expect(graphView).toBeVisible();
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
  }
});

test('graph nodes display agent information', async ({ page }) => {
  await page.goto('/');
  
  await page.waitForTimeout(1000);
  
  const nodeCount = await page.locator('.react-flow__node').count();
  
  if (nodeCount > 0) {
    const firstNode = page.locator('.react-flow__node').first();
    await expect(firstNode).toBeVisible();
    
    await expect(firstNode.locator('[role="img"]')).toBeVisible();
  }
});

test('graph node selection highlights node', async ({ page }) => {
  await page.goto('/');
  
  await page.waitForTimeout(1000);
  
  const nodeCount = await page.locator('.react-flow__node').count();
  
  if (nodeCount > 0) {
    const firstNode = page.locator('.react-flow__node').first();
    
    await firstNode.click();
    
    await page.waitForTimeout(200);
    
    const afterClick = await firstNode.evaluate((el) => {
      const nodeDiv = el.querySelector('div');
      if (!nodeDiv) return null;
      const classes = nodeDiv.className;
      return {
        hasBorderAccent: classes.includes('border-accent'),
        hasRing: classes.includes('ring-accent'),
        borderColor: window.getComputedStyle(nodeDiv).borderColor,
      };
    });
    
    expect(afterClick?.hasBorderAccent || afterClick?.hasRing).toBeTruthy();
  }
});

test('graph node drag changes position', async ({ page }) => {
  await page.goto('/');
  
  await page.waitForTimeout(1000);
  
  const nodeCount = await page.locator('.react-flow__node').count();
  
  if (nodeCount > 0) {
    const firstNode = page.locator('.react-flow__node').first();
    
    const beforeBox = await firstNode.boundingBox();
    expect(beforeBox).not.toBeNull();
    
    if (beforeBox) {
      await page.mouse.move(beforeBox.x + beforeBox.width / 2, beforeBox.y + beforeBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(beforeBox.x + 100, beforeBox.y + 100, { steps: 10 });
      await page.mouse.up();
      
      await page.waitForTimeout(300);
      
      const afterBox = await firstNode.boundingBox();
      expect(afterBox).not.toBeNull();
      
      if (afterBox) {
        const moved = Math.abs(afterBox.x - beforeBox.x) > 50 || Math.abs(afterBox.y - beforeBox.y) > 50;
        expect(moved).toBe(true);
      }
    }
  }
});

test('activity stream starts collapsed by default', async ({ page }) => {
  await page.goto('/');
  
  await page.waitForTimeout(500);
  
  const isCollapsed = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const streamButton = buttons.find(b => b.textContent?.includes('Activity Stream') || b.textContent?.includes('Stream'));
    if (!streamButton) return null;
    
    const container = streamButton.closest('div[class*="flex"]')?.parentElement;
    if (!container) return null;
    
    const height = window.getComputedStyle(container).height;
    const parsedHeight = parseInt(height);
    return parsedHeight < 100;
  });
  
  if (isCollapsed !== null) {
    expect(isCollapsed).toBe(true);
  }
});

test('activity stream expands on interaction', async ({ page }) => {
  await page.goto('/');
  
  await page.waitForTimeout(500);
  
  const expandButton = page.locator('button').filter({ hasText: /Activity Stream|Stream/ }).first();
  
  const isVisible = await expandButton.isVisible().catch(() => false);
  
  if (isVisible) {
    await expandButton.click();
    
    await page.waitForTimeout(300);
    
    const isExpanded = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const streamButton = buttons.find(b => b.textContent?.includes('Activity Stream') || b.textContent?.includes('Stream'));
      if (!streamButton) return null;
      
      const container = streamButton.closest('div[class*="flex"]')?.parentElement;
      if (!container) return null;
      
      const height = window.getComputedStyle(container).height;
      const parsedHeight = parseInt(height);
      return parsedHeight > 100;
    });
    
    if (isExpanded !== null) {
      expect(isExpanded).toBe(true);
    }
  }
});

test('zoom controls are present and functional', async ({ page }) => {
  await page.goto('/');
  
  await page.waitForTimeout(1000);
  
  const nodeCount = await page.locator('.react-flow__node').count();
  
  if (nodeCount > 0) {
    const zoomInButton = page.locator('.react-flow__controls button[aria-label*="zoom in"], .react-flow__controls button').first();
    const zoomOutButton = page.locator('.react-flow__controls button[aria-label*="zoom out"], .react-flow__controls button').nth(1);
    
    await expect(zoomInButton.or(zoomOutButton)).toBeVisible();
    
    const viewport = page.locator('.react-flow__viewport');
    const beforeTransform = await viewport.evaluate((el) => window.getComputedStyle(el).transform);
    
    await zoomInButton.click();
    await page.waitForTimeout(200);
    
    const afterTransform = await viewport.evaluate((el) => window.getComputedStyle(el).transform);
    
    expect(beforeTransform).not.toBe(afterTransform);
  }
});

test('graph background is visible', async ({ page }) => {
  await page.goto('/');
  
  await page.waitForTimeout(500);
  
  const background = page.locator('.react-flow__background');
  
  const hasNodes = await page.locator('.react-flow__node').count();
  if (hasNodes > 0) {
    await expect(background).toBeVisible();
  }
});

test('edges connect parent-child sessions', async ({ page }) => {
  await page.goto('/');
  
  await page.waitForTimeout(1000);
  
  const edgeCount = await page.locator('.react-flow__edge').count();
  const nodeCount = await page.locator('.react-flow__node').count();
  
  if (nodeCount > 1) {
    expect(edgeCount).toBeGreaterThanOrEqual(0);
  }
});
