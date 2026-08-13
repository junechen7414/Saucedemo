# 進階技巧

> 本文件說明 Playwright 的進階功能與實用技巧

## API 型別安全

使用 `openapi-typescript` 從 Swagger 自動生成型別定義，確保 API 呼叫的型別安全。

### 生成型別定義

```bash
pnpm run api-spec:update
```

這個指令會：
1. 從 `http://localhost:8787/v3/api-docs` 取得 Swagger 規格（存成 `docs/swagger.live.json`，不入版控）
2. 生成 TypeScript 型別定義
3. 儲存到 `services/schema/api-types.ts`

因此執行前需要先 `pnpm run compose-up` 把後端容器帶起來。沒有容器可用時，改跑
`pnpm run api-spec:update:file`，它讀版控裡的 `docs/swagger.json` 快照。

### 為什麼從容器抓，而不是直接讀 docs/swagger.json

`docs/swagger.json` 是上游 SpringBoot repo 的 CI 推過來的**快照**，它必然落後被測 image：
上游 workflow 是在 build-and-push job 裡就 dispatch 本 repo 的 E2E，而同步 swagger 是**後續**
的 job，所以 E2E 開跑時 checkout 到的還是上一版 spec。手動 `workflow_dispatch` 指定舊 image
時錯配更明顯——檔案永遠是 main 最新的，image 卻是舊的。

規格的正確來源是**被測的那個 artifact 自己**：image 吐出來的 `/v3/api-docs` 定義上就同步，
三種觸發路徑（`repository_dispatch` / `workflow_dispatch` / PR 貼標籤）一次全對。`docs/swagger.json`
則保留為 API 變更的可讀記錄（在本 repo 看得到後端何時改了什麼），CI 會比對兩者並在
job summary 提示落差，但不阻擋測試。

### 使用範例

```typescript
import type { paths } from '@/services/schema/api-types';

// 定義 API 回應型別
type GetProductsResponse = paths['/api/products']['get']['responses']['200']['content']['application/json'];

// 在 API 客戶端中使用
class ProductApiClient {
  async getProducts(): Promise<GetProductsResponse> {
    const response = await this.request.get('/api/products');
    return response.json();
  }
}
```

### 優點

- ✅ **型別安全**: 編譯時期檢查 API 呼叫
- ✅ **自動完成**: IDE 提供完整的自動完成
- ✅ **重構友善**: 型別變更時自動提示
- ✅ **文件同步**: 確保程式碼與 API 規格一致

## 網路攔截與 Mocking

使用 `page.route` 攔截網路請求並偽造回應，適合測試錯誤處理與邊界情況。

### 基本用法

```typescript
// 攔截並偽造回應
await page.route('**/api/user', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
    }),
  });
});
```

### 模擬 API 錯誤

```typescript
test('處理 API 錯誤', async ({ page }) => {
  // 模擬 500 錯誤
  await page.route('**/api/user', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Internal Server Error' }),
    });
  });

  await page.goto('/profile');
  
  // 驗證錯誤訊息顯示
  await expect(page.getByText('Failed to load user data')).toBeVisible();
});
```

### 模擬網路延遲

```typescript
await page.route('**/api/products', async route => {
  // 延遲 3 秒後回應
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ products: [] }),
  });
});
```

### 條件式攔截

```typescript
await page.route('**/api/**', async route => {
  const url = route.request().url();
  
  if (url.includes('/api/products')) {
    // 攔截產品 API
    await route.fulfill({ status: 200, body: '[]' });
  } else {
    // 其他請求正常執行
    await route.continue();
  }
});
```

### 適用情境

- ✅ 測試錯誤處理邏輯
- ✅ 固定測試資料（避免外部依賴）
- ✅ 模擬網路中斷或延遲
- ✅ 測試載入狀態
- ✅ 隔離前端測試（不依賴後端）

## 自動處理隨機彈窗

使用 `addLocatorHandler` 處理隨機出現的元素，如 Cookie 同意、廣告等。

### 基本用法

```typescript
test('處理 Cookie 同意彈窗', async ({ page }) => {
  // 註冊處理器
  await page.addLocatorHandler(
    page.getByRole('button', { name: '接受 Cookie' }),
    async () => {
      await page.getByRole('button', { name: '接受 Cookie' }).click();
    }
  );

  // 正常執行測試
  await page.goto('/');
  await page.getByRole('link', { name: 'Products' }).click();
  // 如果彈窗出現，會自動處理
});
```

### 處理多種彈窗

```typescript
test('處理多種彈窗', async ({ page }) => {
  // Cookie 同意
  await page.addLocatorHandler(
    page.getByRole('button', { name: '接受' }),
    async () => {
      await page.getByRole('button', { name: '接受' }).click();
    }
  );

  // 訂閱通知
  await page.addLocatorHandler(
    page.getByText('訂閱我們的電子報'),
    async () => {
      await page.getByRole('button', { name: '關閉' }).click();
    }
  );

  // 執行測試
  await page.goto('/');
  // 彈窗會自動處理
});
```

### 移除處理器

```typescript
// 註冊處理器
await page.addLocatorHandler(locator, handler);

// 移除所有處理器
await page.removeLocatorHandler(locator);
```

### 注意事項

- ⚠️ 處理器會在每次操作前檢查
- ⚠️ 可能影響測試效能
- ⚠️ 僅用於真正隨機出現的元素

## 斷言技巧

### 軟斷言 (Soft Assertions)

失敗時不中止測試，繼續執行後續步驟。

```typescript
import { test, expect } from '@playwright/test';

test('多個檢查點', async ({ page }) => {
  await page.goto('/product/1');

  // 使用軟斷言
  await expect.soft(page.getByText('Product Name')).toBeVisible();
  await expect.soft(page.getByText('$99.99')).toBeVisible();
  await expect.soft(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();

  // 即使前面的斷言失敗，這裡仍會執行
  await expect.soft(page.getByText('In Stock')).toBeVisible();
});
```

**使用時機**:
- 單一測試有多個獨立檢查點
- 想要收集所有失敗資訊
- 驗證頁面的多個元素

### API 狀態驗證

```typescript
test('API 回應正常', async ({ request }) => {
  const response = await request.get('/api/products');
  
  // 驗證狀態碼在 200-299 之間
  expect(response).toBeOK();
  
  // 等同於
  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);
});
```

### 自訂斷言訊息

```typescript
await expect(page.getByText('Welcome')).toBeVisible({
  timeout: 5000,
  // 自訂錯誤訊息
  message: '歡迎訊息應該在 5 秒內顯示',
});
```

### 陣列與物件斷言

```typescript
// 陣列包含
expect(['apple', 'banana', 'orange']).toContain('banana');

// 物件包含屬性
expect({ name: 'John', age: 30 }).toHaveProperty('name', 'John');

// 部分匹配
expect({ name: 'John', age: 30, city: 'NYC' }).toMatchObject({
  name: 'John',
  age: 30,
});
```

## 等待策略

### 等待元素狀態

```typescript
// 等待可見
await page.getByRole('button', { name: 'Submit' }).waitFor({ state: 'visible' });

// 等待隱藏
await page.getByRole('dialog').waitFor({ state: 'hidden' });

// 等待啟用
await page.getByRole('button', { name: 'Submit' }).waitFor({ state: 'enabled' });

// 等待從 DOM 移除
await page.getByRole('dialog').waitFor({ state: 'detached' });
```

### 等待網路請求

```typescript
// 等待特定 API 完成
const responsePromise = page.waitForResponse('**/api/products');
await page.getByRole('button', { name: 'Load Products' }).click();
const response = await responsePromise;
expect(response.status()).toBe(200);
```

### 等待導航

```typescript
// 等待頁面載入
await page.waitForLoadState('load');

// 等待網路閒置
await page.waitForLoadState('networkidle');

// 等待 DOM 內容載入
await page.waitForLoadState('domcontentloaded');
```

## 截圖與錄影

### 元素截圖

```typescript
// 截取特定元素
await page.getByRole('article').screenshot({ path: 'article.png' });

// 全頁截圖
await page.screenshot({ path: 'full-page.png', fullPage: true });
```

### 視覺回歸測試

```typescript
test('視覺回歸測試', async ({ page }) => {
  await page.goto('/');
  
  // 比對截圖
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,  // 允許的差異像素數
  });
});
```

### 錄影

```typescript
// 在配置中啟用
export default defineConfig({
  use: {
    video: 'on',  // 或 'retain-on-failure'
  },
});
```

## 平行執行控制

### 序列執行

```typescript
test.describe.serial('依序執行的測試', () => {
  test('步驟 1', async ({ page }) => {
    // ...
  });

  test('步驟 2', async ({ page }) => {
    // 依賴步驟 1 的結果
  });
});
```

### 限制並行數

```typescript
// 在配置中設定
export default defineConfig({
  workers: 3,  // 最多 3 個並行執行
});

// 或在測試中設定
test.describe.configure({ mode: 'parallel' });
test.describe.configure({ mode: 'serial' });
```

## 除錯技巧

### Playwright Inspector

```bash
# 啟動 Inspector
pnpm playwright test --debug

# 從特定測試開始
pnpm playwright test Shopping.spec.ts --debug
```

### 暫停執行

```typescript
test('除錯測試', async ({ page }) => {
  await page.goto('/');
  
  // 暫停執行，開啟 Inspector
  await page.pause();
  
  await page.getByRole('button', { name: 'Submit' }).click();
});
```

### 追蹤檢視器

```bash
# 生成追蹤檔案
pnpm playwright test --trace on

# 檢視追蹤
pnpm playwright show-trace trace.zip
```

## 相關文件

- [測試架構](./08-test-architecture.md)
- [元素定位策略](./09-locator-strategies.md)
- [測試策略](./10-testing-strategies.md)
- [Playwright API 文件](https://playwright.dev/docs/api/class-playwright)