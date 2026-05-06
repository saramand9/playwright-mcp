# 阶段 2：MCP 工具调用记录及标准代码输出

## 初始化

```json
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0","clientInfo":{"name":"t"},"capabilities":{}}}
← {"id":1,"result":{"capabilities":{"tools":{}}}}
```

## Step 0：导航到页面

```json
→ {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"browser_navigate","arguments":{"url":"http://localhost:8080/device-manager.html"}}}
← 页面加载完成
```

## Step 0.5：获取页面快照（提取 ref）

```json
→ {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"browser_snapshot","arguments":{}}}
← ARIA 树片段:
  - generic [ref=e23] [cursor=pointer]: Apple    → ref=e23
  - generic [ref=e24] [cursor=pointer]: Samsung  → ref=e24
  - generic [ref=e25] [cursor=pointer]: 华为     → ref=e25
  - table [ref=e89]: ...                          → ref=e89
  - heading "设备筛选 30" [ref=e17]               → 计数=30
```

---

## Phase 1：前置验证

### Step 1 — browser_verify_page_url
```json
→ {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"browser_verify_page_url","arguments":{"expected":"device-manager","mode":"contains"}}}
← 通过
```
> addCode: `await expect(page).toHaveURL(/device-manager/);`

### Step 2 — browser_verify_text_visible
```json
→ {"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"browser_verify_text_visible","arguments":{"text":"设备管理"}}}
← 通过（匹配到 📱 设备管理平台）
```
> addCode: `await expect(page.getByText('📱 设备管理平台')).toBeVisible();`
> xpath: `//span[contains(text(),"📱 设备管理平台")]`
> fullXPath: `/html/body/div/span`

### Step 3 — browser_verify_text_visible
```json
→ {"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"browser_verify_text_visible","arguments":{"text":"品牌"}}}
← 通过（normalize 时发现 scope 为 #filter-panel）
```
> addCode: `await expect(page.locator('#filter-panel').getByText('品牌')).toBeVisible();`
> xpath: `//*[@id="filter-panel"]/div[1]/div[1]/div[1]`
> fullXPath: `/html/body/div[2]/div/div/div/div`

### Step 4 — browser_verify_text_visible
```json
→ {"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"browser_verify_text_visible","arguments":{"text":"操作系统"}}}
← 通过
```
> addCode: `await expect(page.locator('#filter-panel').getByText('操作系统')).toBeVisible();`
> xpath: `//*[@id="filter-panel"]/div[1]/div[2]/div[1]`
> fullXPath: `/html/body/div[2]/div/div/div[2]/div`

### Step 5 — browser_verify_text_visible
```json
→ {"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"browser_verify_text_visible","arguments":{"text":"30"}}}
← 通过（exact:true 防匹配 300）
```
> addCode: `await expect(page.getByText('30', { exact: true })).toBeVisible();`
> xpath: `//*[@id="filter-count"]`
> fullXPath: `/html/body/div[2]/div/h2/span`

### Step 6 — browser_verify_state（元素级）
```json
→ {"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"browser_verify_state","arguments":{"element":"Apple品牌标签","ref":"e23","state":"visible"}}}
← 内部: refLocator(e23) → page.locator('#filter-panel').getByText('Apple') → isVisible()=true
```
> addCode: `await expect(page.locator('#filter-panel').getByText('Apple')).toBeVisible();`

### Step 7 — browser_verify_state
```json
→ {"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"browser_verify_state","arguments":{"element":"Samsung品牌标签","ref":"e24","state":"visible"}}}
← 通过
```
> addCode: `await expect(page.locator('#filter-panel').getByText('Samsung')).toBeVisible();`

### Step 8 — browser_verify_state
```json
→ {"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"browser_verify_state","arguments":{"element":"华为品牌标签","ref":"e25","state":"visible"}}}
← 通过（refLocator 未找到 #filter-panel 上下文，降级为裸 getByText）
```
> addCode: `await expect(page.getByText('华为')).toBeVisible();`

### Step 9 — browser_verify_state
```json
→ {"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"browser_verify_state","arguments":{"element":"设备表格","ref":"e89","state":"visible"}}}
← 通过（refLocator 把表格表头文本拼成了 getByText）
```
> addCode: `await expect(page.getByText('设备ID ▲ 品牌 型号 操作系统 系统版本 屏幕尺寸 RAM 存储 电池 网络 价格 状态 采购日期 部门 NFC 刷新率 DEV-')).toBeVisible();`

---

## Phase 2：执行

### Step 10 — browser_click（action）
```json
→ {"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"browser_click","arguments":{"element":"Apple品牌筛选标签","ref":"e23"}}}
← 内部: refLocator(e23) → locator → extractXPath(locator) → click() → 新快照保存到 .playwright-mcp/
```
> addCode: `await page.locator('#filter-panel').getByText('Apple').click();`
> xpath: `//label[contains(text(),"Apple")]`
> fullXPath: `/html/body/div[2]/div/div/div/div[2]/label`

---

## Phase 3：预期结果验证

### Step 11 — browser_verify_text_visible
```json
→ {"jsonrpc":"2.0","id":14,"method":"tools/call","params":{"name":"browser_verify_text_visible","arguments":{"text":"Apple"}}}
← 通过（点击后 Apple 标签仍可见）
```
> addCode: `await expect(page.locator('#filter-panel').getByText('Apple')).toBeVisible();`
> xpath: `//label[contains(text(),"Apple")]`
> fullXPath: `/html/body/div[2]/div/div/div/div[2]/label`

---

## addCode 汇总

| # | 工具 | addCode（标准 Playwright） | xpath | fullXPath |
|---|------|---------------------------|-------|----------|
| 1 | verify_page_url | `await expect(page).toHaveURL(/device-manager/);` | — | — |
| 2 | verify_text_visible | `await expect(page.getByText('📱 设备管理平台')).toBeVisible();` | `//span[contains(text(),"📱 设备管理平台")]` | `/html/body/div/span` |
| 3 | verify_text_visible | `await expect(page.locator('#filter-panel').getByText('品牌')).toBeVisible();` | `//*[@id="filter-panel"]/div[1]/div[1]/div[1]` | `/html/body/div[2]/div/div/div/div` |
| 4 | verify_text_visible | `await expect(page.locator('#filter-panel').getByText('操作系统')).toBeVisible();` | `//*[@id="filter-panel"]/div[1]/div[2]/div[1]` | `/html/body/div[2]/div/div/div[2]/div` |
| 5 | verify_text_visible | `await expect(page.getByText('30', { exact: true })).toBeVisible();` | `//*[@id="filter-count"]` | `/html/body/div[2]/div/h2/span` |
| 6 | verify_state | `await expect(page.locator('#filter-panel').getByText('Apple')).toBeVisible();` | `//label[contains(text(),"Apple")]` | `/html/body/div[2]/div/div/div/div[2]/label` |
| 7 | verify_state | `await expect(page.locator('#filter-panel').getByText('Samsung')).toBeVisible();` | `//label[contains(text(),"Samsung")]` | `/html/body/div[2]/div/div/div/div[2]/label[2]` |
| 8 | verify_state | `await expect(page.getByText('华为')).toBeVisible();` | `//label[contains(text(),"华为")]` | `/html/body/div[2]/div/div/div/div[2]/label[3]` |
| 9 | verify_state | `await expect(page.getByText('设备ID ▲ 品牌...')).toBeVisible();` | `//div[2]/div[2]/div[2]/table[1]` | `/html/body/div[2]/div[2]/div[2]/table` |
| 10 | click | `await page.locator('#filter-panel').getByText('Apple').click();` | `//label[contains(text(),"Apple")]` | `/html/body/div[2]/div/div/div/div[2]/label` |
| 11 | verify_text_visible | `await expect(page.locator('#filter-panel').getByText('Apple')).toBeVisible();` | `//label[contains(text(),"Apple")]` | `/html/body/div[2]/div/div/div/div[2]/label` |
