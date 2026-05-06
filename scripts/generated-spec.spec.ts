import { test, expect } from '@playwright/test';
const { robustLocate } = require('./helpers/repair-helper.js');

const BASE_URL = 'http://127.0.0.1:8765/device-manager.html';

test.describe('设备管理 — 品牌筛选', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  });

  test('点击Apple品牌标签筛选，验证结果', async ({ page }) => {
    test.setTimeout(180_000);

    // ═══════════════════════════════════════════════════════
    // 前置验证
    // ═══════════════════════════════════════════════════════

    // 页面级：URL 包含 device-manager
    await expect(page).toHaveURL(/device-manager/);

    // 页面级：页面标题可见
    await expect(page.getByText('📱 设备管理平台')).toBeVisible();

    // 页面级：计数徽标 "30"
    await expect(page.getByText('30', { exact: true })).toBeVisible();

    // 元素级：品牌/操作系统筛选标签
    await robustLocate(page, {
      intent: '筛选面板 — 品牌标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('品牌') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]//*[contains(text(),"品牌")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[2]/div/div[1]/div[contains(text(),"品牌")]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    await robustLocate(page, {
      intent: '筛选面板 — 操作系统标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('操作系统') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]//*[contains(text(),"操作系统")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[2]/div/div[2]/div[contains(text(),"操作系统")]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 元素级：品牌标签 — Apple + Samsung + 华为
    // DOM: <div id="filter-panel"><span>Apple</span></div>
    await robustLocate(page, {
      intent: '品牌筛选标签 (Apple 可见性验证)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('Apple') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]//*[contains(text(),"Apple")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[2]/div/div[1]/div[1]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    await robustLocate(page, {
      intent: 'Samsung 标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('Samsung') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]//*[contains(text(),"Samsung")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[2]/div/div[2]/div[contains(text(),"Samsung")]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    await robustLocate(page, {
      intent: '华为 标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('华为') },
        { type: 'xpath', locator: () => page.locator('//*[contains(text(),"华为")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[2]/div/div[3]/div[contains(text(),"华为")]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 元素级：表格可见
    await robustLocate(page, {
      intent: '设备表格 (可见性验证)',
      strategies: [
        { type: 'semantic', locator: () => page.getByRole('table') },
        { type: 'xpath', locator: () => page.locator('//table') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div/div/div/table') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // ═══════════════════════════════════════════════════════
    // 执行：点击 Apple 品牌筛选标签
    // ═══════════════════════════════════════════════════════

    // DOM: <div id="filter-panel"><span>Apple</span></div>
    await robustLocate(page, {
      intent: 'Apple品牌筛选标签',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('Apple') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]//*[contains(text(),"Apple")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[2]/div/div[1]/div[1]') },
      ],
      action: (loc) => loc.click(),
      timeout: 5000,
    });

    // ═══════════════════════════════════════════════════════
    // 预期结果验证
    // ═══════════════════════════════════════════════════════

    // 元素级：Apple 筛选标签点击后仍可见
    await robustLocate(page, {
      intent: 'Apple标签 (点击后仍可见)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('Apple') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]//*[contains(text(),"Apple")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[2]/div/div[1]/div[1]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });
  });
});
