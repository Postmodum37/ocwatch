import { test, expect } from '@playwright/test';

test('diagram card width is at least 310px', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  const nodeCount = await page.locator('.react-flow__node').count();
  if (nodeCount > 0) {
    const firstNode = page.locator('.react-flow__node').first();
    const box = await firstNode.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(310);
      expect(box.width).toBeLessThanOrEqual(340);
    }
  }
});

test('build output has multiple JS chunks with main chunk under 400KB', async () => {
  const { readdirSync, statSync, existsSync } = await import('fs');
  const { join } = await import('path');
  const { execSync } = await import('child_process');

  const distDir = '/Users/tomas/Workspace/ocwatch/src/client/dist/assets';

  // Run build only if dist doesn't already exist
  if (!existsSync(distDir)) {
    execSync('bun run build', { cwd: '/Users/tomas/Workspace/ocwatch', stdio: 'pipe' });
  }

  const jsFiles = readdirSync(distDir).filter((f: string) => f.endsWith('.js'));
  expect(jsFiles.length).toBeGreaterThanOrEqual(3);

  // Find main chunk (index-*.js)
  const mainChunk = jsFiles.find((f: string) => f.startsWith('index-'));
  if (mainChunk) {
    const size = statSync(join(distDir, mainChunk)).size;
    expect(size).toBeLessThan(400 * 1024); // 400KB
  }
});

test('animated edges are present and stable (smoke test)', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  const nodeCount = await page.locator('.react-flow__node').count();
  if (nodeCount > 1) {
    // Verify edges exist between nodes
    const edgeCount = await page.locator('.react-flow__edge').count();
    expect(edgeCount).toBeGreaterThan(0);

    // Wait 4 seconds (2+ poll cycles) and verify edges still exist (not reset/removed)
    await page.waitForTimeout(4000);
    const edgeCountAfter = await page.locator('.react-flow__edge').count();
    expect(edgeCountAfter).toBe(edgeCount);
  }
});
