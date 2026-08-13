# 配置指南

> 本文件說明 Playwright 與 TypeScript 配置檔案

## playwright.config.ts

Playwright 測試框架的核心配置檔案。

### 動態報告路徑

根據執行環境自動調整報告路徑：

```typescript
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

export default defineConfig({
  reporter: process.env.CI
    ? [['list'], ['html']]  // CI: 固定路徑
    : [['list'], ['html', { outputFolder: `playwright-report/${timestamp}` }]],  // 本地: 時間戳記
});
```

**路徑範例**:
- **本地開發**: `playwright-report/2024-05-20T14-30-00/`
- **CI 環境**: `playwright-report/`

### CI/CD 策略差異

根據環境自動調整測試策略：

```typescript
export default defineConfig({
  // 重試次數
  retries: process.env.CI ? 2 : 0,
  
  // 並行執行數
  workers: process.env.CI ? 2 : 3,
  
  // 測試超時
  timeout: 30 * 1000,
  
  // 全域設定
  use: {
    // 截圖
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    
    // 錄影
    video: process.env.CI ? 'retain-on-failure' : 'off',
    
    // Trace
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    
    // 基礎 URL
    baseURL: 'http://localhost:8787',
  },
});
```

**策略對照表**:

| 設定項目 | CI 環境 | 本機開發 | 說明 |
|---------|---------|----------|------|
| Retries | 2 次 | 0 次 | CI 環境允許重試以應對網路不穩定 |
| Workers | 2 | 3 | CI 環境資源有限，減少並行數 |
| Reporter | List + HTML | List + HTML (時間戳記) | 本地保留歷史報告 |
| Screenshot | On Failure | Off | CI 需要截圖協助除錯 |
| Video | Retain on Failure | Off | CI 保留失敗測試的錄影 |
| Trace | Retain on Failure | Off | CI 保留詳細的執行追蹤 |

### 專案配置

定義多個測試專案與依賴關係：

```typescript
export default defineConfig({
  projects: [
    // UI Setup 專案
    {
      name: 'ui-setup',
      testMatch: '**/saucedemo/*.setup.ts',
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
    
    // UI 測試專案（依賴 Setup）
    {
      name: 'ui-staging',
      testMatch: '**/saucedemo/*.spec.ts',
      dependencies: ['ui-setup'],  // 先執行 Setup
      use: {
        storageState: 'playwright/.auth/user.json',
        baseURL: 'https://www.saucedemo.com',
      },
    },
    
    // API 測試專案
    {
      name: 'api-e2e',
      testMatch: '**/api/springboot/*.spec.ts',
      use: {
        baseURL: 'http://localhost:8787',
      },
    },
  ],
});
```

**專案類型**:
- `ui-setup`: 執行登入並儲存狀態
- `ui-staging`: UI 測試（使用儲存的登入狀態）
- `api-e2e`: API 測試

### 瀏覽器配置

```typescript
export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // 行動裝置
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

### 完整配置範例

```typescript
import { defineConfig, devices } from '@playwright/test';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 3,
  
  reporter: process.env.CI
    ? [['list'], ['html']]
    : [['list'], ['html', { outputFolder: `playwright-report/${timestamp}` }]],
  
  use: {
    baseURL: 'http://localhost:8787',
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
  },
  
  projects: [
    {
      name: 'ui-setup',
      testMatch: '**/saucedemo/*.setup.ts',
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
    {
      name: 'ui-staging',
      testMatch: '**/saucedemo/*.spec.ts',
      dependencies: ['ui-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        baseURL: 'https://www.saucedemo.com',
      },
    },
    {
      name: 'api-e2e',
      testMatch: '**/api/springboot/*.spec.ts',
      use: {
        baseURL: 'http://localhost:8787',
      },
    },
  ],
});
```

## tsconfig.json

TypeScript 編譯器配置，使用現代化設定。

### 核心配置

```json
{
  "compilerOptions": {
    // 模組系統
    "module": "esnext",
    "moduleResolution": "bundler",
    
    // 目標版本
    "target": "ES2022",
    "lib": ["ES2022"],
    
    // 型別檢查
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    
    // 輸出
    "outDir": "./dist",
    "rootDir": "./",
    
    // 其他
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "tests/**/*",
    "services/**/*",
    "global-setup.ts",
    "playwright.config.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### 重要設定說明

#### module: "esnext"
- 使用最新的 ES 模組語法
- 支援 `import` / `export`
- 與 Playwright 完美整合

#### moduleResolution: "bundler"
- 現代模組解析策略
- 支援 package.json 的 `exports` 欄位
- 更好的型別推斷

#### strict: true
啟用所有嚴格型別檢查：
- `noImplicitAny`: 禁止隱式 `any`
- `strictNullChecks`: 嚴格的 null 檢查
- `strictFunctionTypes`: 嚴格的函式型別檢查
- `strictBindCallApply`: 嚴格的 bind/call/apply 檢查

#### noUncheckedIndexedAccess: true
確保陣列存取安全：

```typescript
// 啟用後
const items: string[] = ['a', 'b', 'c'];
const first = items[0];  // 型別: string | undefined

// 未啟用
const first = items[0];  // 型別: string (不安全)
```

### 路徑別名

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@services/*": ["services/*"],
      "@tests/*": ["tests/*"],
      "@fixtures/*": ["services/fixtures/*"]
    }
  }
}
```

**使用範例**:
```typescript
// 使用別名
import { LoginPage } from '@services/pages/login-page';
import { test } from '@fixtures/chain-fixtures';

// 不使用別名
import { LoginPage } from '../../services/pages/login-page';
import { test } from '../../services/fixtures/chain-fixtures';
```

## package.json

專案依賴與腳本配置。

### 重要腳本

```json
{
  "scripts": {
    // 測試執行
    "test:e2e": "playwright test --project=api-e2e",
    "test:e2e:ci": "pwsh -File ./scripts/test-e2e-ci.ps1",
    "test:ui": "playwright test --project=ui-staging",
    
    // 容器管理
    "compose-up": "podman compose -f docker-compose.test.yml up -d",
    "compose-down": "podman compose -f docker-compose.test.yml down -v",
    "compose-restart": "pnpm run compose-down && pnpm run compose-up",
    
    // 程式碼品質
    "biome:check": "biome check .",
    "biome:fix": "biome check --write .",
    
    // API 型別生成（預設從跑起來的容器抓 spec；:file 改讀版控快照，離線用）
    "api-spec:update": "curl -fsS http://localhost:8787/v3/api-docs -o ./docs/swagger.live.json && openapi-typescript ./docs/swagger.live.json -o ./services/schema/api-types.ts",
    "api-spec:update:file": "openapi-typescript ./docs/swagger.json -o ./services/schema/api-types.ts"
  }
}
```

### 依賴版本

```json
{
  "devDependencies": {
    "@playwright/test": "^1.57.0",
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.7.2",
    "openapi-typescript": "^7.4.4"
  }
}
```

## .env 配置

環境變數配置檔案。

### 範例

```bash
# Oracle Database
ORACLE_TEST_USERNAME=testuser
ORACLE_TEST_PASSWORD=testpass123

# Spring Boot
SPRING_DATASOURCE_URL=jdbc:oracle:thin:@localhost:1521/FREEPDB1
SPRING_DATASOURCE_USERNAME=testuser
SPRING_DATASOURCE_PASSWORD=testpass123
```

### 使用方式

```typescript
// 在測試中使用
const dbUser = process.env.ORACLE_TEST_USERNAME;
const dbPassword = process.env.ORACLE_TEST_PASSWORD;
```

## biome.json

程式碼格式化與 Linting 配置。

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

## 相關文件

- [專案概述](./01-project-overview.md)
- [架構概覽](./07-architecture-overview.md)
- [測試策略](./10-testing-strategies.md)
- [Playwright 配置文件](https://playwright.dev/docs/test-configuration)
- [TypeScript 配置文件](https://www.typescriptlang.org/tsconfig)