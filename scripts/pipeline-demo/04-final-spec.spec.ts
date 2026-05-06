import { test, expect } from '@playwright/test';
const { robustLocate } = require('./helpers/repair-helper.js');

const BASE_URL = 'http://localhost:8080/device-manager.html';

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
    // 来源: browser_verify_page_url(expected=device-manager, mode=contains)
    await expect(page).toHaveURL(/device-manager/);

    // 页面级：页面标题可见
    // 来源: browser_verify_text_visible(text=设备管理)
    await expect(page.getByText('📱 设备管理平台')).toBeVisible();

    // 页面级：计数徽标 "30"
    // 来源: browser_verify_text_visible(text=30)
    await expect(page.getByText('30', { exact: true })).toBeVisible();

    // 页面级：筛选面板标签
    // 来源: browser_verify_text_visible(text=品牌)
    await expect(page.locator('#filter-panel').getByText('品牌')).toBeVisible();
    // 来源: browser_verify_text_visible(text=操作系统)
    await expect(page.locator('#filter-panel').getByText('操作系统')).toBeVisible();

    // 元素级：品牌标签 — Apple
    // 来源: browser_verify_state(ref=e23, state=visible)
    // DOM: <label>Apple</label>
    await robustLocate(page, {
      intent: '品牌筛选标签 (Apple 可见性验证)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('Apple') },
        { type: 'xpath', locator: () => page.locator('//label[contains(text(),"Apple")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div/div[2]/label') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 元素级：Samsung 标签
    // 来源: browser_verify_state(ref=e24, state=visible)
    // DOM: <label>Samsung</label>
    await robustLocate(page, {
      intent: 'Samsung 标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('Samsung') },
        { type: 'xpath', locator: () => page.locator('//label[contains(text(),"Samsung")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div/div[2]/label[2]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 元素级：华为 标签
    // 来源: browser_verify_state(ref=e25, state=visible)
    // DOM: <label>华为</label>
    await robustLocate(page, {
      intent: '华为 标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('华为') },
        { type: 'xpath', locator: () => page.locator('//label[contains(text(),"华为")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div/div[2]/label[3]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 元素级：设备表格
    // 来源: browser_verify_state(ref=e89, state=visible)
    // DOM: <table>设备ID ▲ 品牌 型号 ...</table>
    await robustLocate(page, {
      intent: '设备表格 (可见性验证)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('设备ID ▲ 品牌 型号 操作系统 系统版本 屏幕尺寸 RAM 存储 电池 网络 价格 状态 采购日期 部门 NFC 刷新率 DEV-') },
        { type: 'xpath', locator: () => page.locator('//div[2]/div[2]/div[2]/table[1]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div[2]/div[2]/table') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // ═══════════════════════════════════════════════════════
    // 执行：点击 Apple 品牌筛选标签
    // ═══════════════════════════════════════════════════════

    // 来源: browser_click(ref=e23)
    // DOM: <label>Apple</label>
    await robustLocate(page, {
      intent: 'Apple品牌筛选标签',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('Apple') },
        { type: 'xpath', locator: () => page.locator('//label[contains(text(),"Apple")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div/div[2]/label') },
      ],
      action: (loc) => loc.click(),
      timeout: 5000,
    });

    // ═══════════════════════════════════════════════════════
    // 预期结果验证
    // ═══════════════════════════════════════════════════════

    // 元素级：Apple 标签点击后仍可见
    // 来源: browser_verify_text_visible(text=Apple)
    await robustLocate(page, {
      intent: 'Apple标签 (点击后仍可见)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('Apple') },
        { type: 'xpath', locator: () => page.locator('//label[contains(text(),"Apple")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div/div[2]/label') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });
  });
});
