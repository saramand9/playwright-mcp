import { test, expect } from '@playwright/test';
const { robustLocate } = require('./helpers/repair-helper.js');

const BASE_URL = 'http://localhost:8080/device-manager.html';

test.describe('设备管理 — 价格筛选', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  });

  test('输入价格范围3000-8000筛选，验证结果', async ({ page }) => {
    test.setTimeout(180_000);

    // ═══════════════════════════════════════════════════════
    // 前置验证
    // ═══════════════════════════════════════════════════════

    // 页面级：URL 包含 device-manager
    // 来源: browser_verify_page_url(expected=device-manager, mode=contains)
    await expect(page).toHaveURL(/device-manager/);

    // 页面级：页面标题
    // 来源: browser_verify_text_visible(text=设备管理)
    await robustLocate(page, {
      intent: '页面标题 (设备管理平台 可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('📱 设备管理平台') },
        { type: 'xpath', locator: () => page.locator('//span[contains(text(),"📱 设备管理平台")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div/span') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 页面级：计数徽标 "30"
    // 来源: browser_verify_text_visible(text=30)
    await robustLocate(page, {
      intent: '设备计数徽标 (30 可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('30', { exact: true }) },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-count"]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/h2/span') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 筛选面板标签
    // 来源: browser_verify_text_visible(text=品牌)
    await robustLocate(page, {
      intent: '品牌 筛选标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('品牌') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]/div[1]/div[1]/div[1]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div/div') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 来源: browser_verify_text_visible(text=操作系统)
    await robustLocate(page, {
      intent: '操作系统 筛选标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-panel').getByText('操作系统') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]/div[1]/div[2]/div[1]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div[2]/div') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 来源: browser_verify_text_visible(text=运行内存)
    await robustLocate(page, {
      intent: '运行内存 筛选标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('运行内存') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]/div[1]/div[3]/div[1]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div[3]/div') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 来源: browser_verify_text_visible(text=存储容量)
    await robustLocate(page, {
      intent: '存储容量 筛选标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('存储容量') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]/div[1]/div[4]/div[1]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div[4]/div') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 来源: browser_verify_text_visible(text=设备状态)
    await robustLocate(page, {
      intent: '设备状态 筛选标签 (可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('设备状态') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-panel"]/div[1]/div[5]/div[1]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div[5]/div') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 元素级：设备表格
    // 来源: browser_verify_state(ref=e89, state=visible)
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

    // 元素级：分页器
    // 来源: browser_verify_state(ref=e289, state=visible)
    await robustLocate(page, {
      intent: '分页器 (可见性验证)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('‹123›') },
        { type: 'xpath', locator: () => page.locator('//*[@id="pagination"]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div[2]/div[3]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // ═══════════════════════════════════════════════════════
    // 执行：展开更多筛选 → 输入价格范围 → 查询
    // ═══════════════════════════════════════════════════════

    // 来源: browser_evaluate(function=toggleExtended())
    // 展开"更多筛选"面板
    await robustLocate(page, {
      intent: '更多筛选 展开按钮',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#toggle-more') },
        { type: 'semantic', locator: () => page.getByText('▼ 更多筛选') },
        { type: 'xpath', locator: () => page.locator('//span[contains(text(),"更多筛选")]') },
      ],
      action: (loc) => loc.click(),
      timeout: 5000,
    });

    // 等待扩展面板出现
    await page.waitForTimeout(500);

    // 来源: browser_evaluate — 设置价格最低=3000
    // DOM: <input id="filter-price-min" type="number">
    await robustLocate(page, {
      intent: '价格最低输入框',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-price-min') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-price-min"]') },
      ],
      action: (loc) => loc.fill('3000'),
      timeout: 5000,
    });

    // 来源: browser_evaluate — 设置价格最高=8000
    // DOM: <input id="filter-price-max" type="number">
    await robustLocate(page, {
      intent: '价格最高输入框',
      strategies: [
        { type: 'semantic', locator: () => page.locator('#filter-price-max') },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-price-max"]') },
      ],
      action: (loc) => loc.fill('8000'),
      timeout: 5000,
    });

    // 来源: browser_click(ref=e82)
    // 点击"查询"按钮
    await robustLocate(page, {
      intent: '查询按钮',
      strategies: [
        { type: 'semantic', locator: () => page.getByRole('button', { name: '查询' }) },
        { type: 'xpath', locator: () => page.locator('//button[contains(text(),"查询")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[4]/button') },
      ],
      action: (loc) => loc.click(),
      timeout: 5000,
    });

    // ═══════════════════════════════════════════════════════
    // 预期结果验证
    // ═══════════════════════════════════════════════════════

    // 等待筛选结果更新
    await page.waitForTimeout(1000);

    // 验证计数变化（30 → 18）
    // 来源: browser_verify_text_visible(text=18)
    await robustLocate(page, {
      intent: '筛选后计数 (18 可见性)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('18', { exact: true }) },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-count"]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/h2/span') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 验证"查询"按钮仍然可见
    // 来源: browser_verify_state(ref=e82, state=visible)
    await robustLocate(page, {
      intent: '查询按钮 (筛选后仍可见)',
      strategies: [
        { type: 'semantic', locator: () => page.getByRole('button', { name: '查询' }) },
        { type: 'xpath', locator: () => page.locator('//button[contains(text(),"查询")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div[4]/button') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 验证所有可见价格在 3000-8000 范围内
    const priceCells = page.locator('td').filter({ hasText: /^¥\d+$/ });
    const count = await priceCells.count();
    for (let i = 0; i < count; i++) {
      const text = await priceCells.nth(i).textContent();
      const price = parseInt(text.replace('¥', ''));
      expect(price, `价格 ¥${price} 应在 3000-8000 范围内`).toBeGreaterThanOrEqual(3000);
      expect(price, `价格 ¥${price} 应在 3000-8000 范围内`).toBeLessThanOrEqual(8000);
    }
    expect(count, '筛选后至少应有可见的价格行').toBeGreaterThan(0);
  });
});
