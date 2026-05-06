import { test, expect } from '@playwright/test';
const { robustLocate } = require('./helpers/repair-helper.js');

const BASE_URL = 'http://localhost:8080/device-manager.html';

test.describe('设备管理 — 表格排序', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  });

  test('TC-027 按价格列排序（升序→降序）', async ({ page }) => {
    test.setTimeout(180_000);

    // ═══════════════════════════════════════════════════════
    // 前置验证
    // ═══════════════════════════════════════════════════════

    // 页面级：URL
    // 来源: browser_verify_page_url(expected=device-manager, mode=contains)
    await expect(page).toHaveURL(/device-manager/);

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

    // 来源: browser_verify_state(ref=e89, state=visible)
    // DOM: <table>设备表格</table>
    await robustLocate(page, {
      intent: '设备表格 (可见性验证)',
      strategies: [
        { type: 'semantic', locator: () => page.getByRole('table') },
        { type: 'xpath', locator: () => page.locator('//div[2]/div[2]/div[2]/table[1]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div[2]/div[2]/table') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 来源: browser_verify_state(ref=e289, state=visible)
    // DOM: <nav>分页器</nav>
    await robustLocate(page, {
      intent: '分页器 (可见性验证)',
      strategies: [
        { type: 'semantic', locator: () => page.getByRole('navigation') },
        { type: 'xpath', locator: () => page.locator('//*[@id="pagination"]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div[2]/div[3]') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // ═══════════════════════════════════════════════════════
    // 执行：点击价格表头 → 升序 → 再点击 → 降序
    // ═══════════════════════════════════════════════════════

    // 来源: browser_click(ref=e102)
    // DOM: <th>价格</th>
    await robustLocate(page, {
      intent: '价格列表头 (首次点击 — 升序)',
      strategies: [
        { type: 'semantic', locator: () => page.getByRole('columnheader', { name: '价格' }) },
        { type: 'xpath', locator: () => page.locator('//th[contains(text(),"价格")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div[2]/div[2]/table/thead/tr/th[11]') },
      ],
      action: (loc) => loc.click(),
      timeout: 5000,
    });

    // 等待排序生效
    await page.waitForTimeout(800);

    // 验证升序：提取价格列，验证非降序（每个值 ≤ 下一个）
    const priceCellsAsc = page.locator('td').filter({ hasText: /^¥\d+$/ });
    const countAsc = await priceCellsAsc.count();
    expect(countAsc, '排序后至少应有可见的价格行').toBeGreaterThan(0);

    const pricesAsc: number[] = [];
    for (let i = 0; i < countAsc; i++) {
      const text = await priceCellsAsc.nth(i).textContent();
      pricesAsc.push(parseInt(text?.replace(/[¥,]/g, '') || '0', 10));
    }
    for (let i = 1; i < pricesAsc.length; i++) {
      expect(pricesAsc[i], `升序验证: ¥${pricesAsc[i]} 应 ≥ ¥${pricesAsc[i-1]}`)
        .toBeGreaterThanOrEqual(pricesAsc[i - 1]);
    }

    // 来源: browser_click(ref=e297, 表头文本已变为"价格 ▲")
    // DOM: <th>价格 ▲</th>
    await robustLocate(page, {
      intent: '价格列表头 (第二次点击 — 降序)',
      strategies: [
        { type: 'semantic', locator: () => page.getByRole('columnheader', { name: /价格/ }) },
        { type: 'xpath', locator: () => page.locator('//th[contains(text(),"价格 ▲")]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div[2]/div[2]/table/thead/tr/th[11]') },
      ],
      action: (loc) => loc.click(),
      timeout: 5000,
    });

    // 等待排序生效
    await page.waitForTimeout(800);

    // 验证降序：提取价格列，验证非升序（每个值 ≥ 下一个）
    const priceCellsDesc = page.locator('td').filter({ hasText: /^¥\d+$/ });
    const countDesc = await priceCellsDesc.count();
    expect(countDesc, '排序后至少应有可见的价格行').toBeGreaterThan(0);

    const pricesDesc: number[] = [];
    for (let i = 0; i < countDesc; i++) {
      const text = await priceCellsDesc.nth(i).textContent();
      pricesDesc.push(parseInt(text?.replace(/[¥,]/g, '') || '0', 10));
    }
    for (let i = 1; i < pricesDesc.length; i++) {
      expect(pricesDesc[i], `降序验证: ¥${pricesDesc[i]} 应 ≤ ¥${pricesDesc[i-1]}`)
        .toBeLessThanOrEqual(pricesDesc[i - 1]);
    }

    // ═══════════════════════════════════════════════════════
    // 预期结果验证
    // ═══════════════════════════════════════════════════════

    // 来源: browser_verify_state(ref=e89, state=visible)
    await robustLocate(page, {
      intent: '设备表格 (排序后仍可见)',
      strategies: [
        { type: 'semantic', locator: () => page.getByRole('table') },
        { type: 'xpath', locator: () => page.locator('//div[2]/div[2]/div[2]/table[1]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div[2]/div[2]/table') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });

    // 来源: browser_verify_text_visible(text=30)
    // 排序不改变条目数量
    await robustLocate(page, {
      intent: '设备计数 (排序后仍为30)',
      strategies: [
        { type: 'semantic', locator: () => page.getByText('30', { exact: true }) },
        { type: 'xpath', locator: () => page.locator('//*[@id="filter-count"]') },
        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/h2/span') },
      ],
      action: (loc) => expect(loc).toBeVisible(),
      timeout: 5000,
    });
  });
});
