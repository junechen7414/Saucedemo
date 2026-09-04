# CI/CD 整合

> 本文件說明 GitHub Actions 與 Docker Compose 配置

## GitHub Actions 配置

本專案使用 GitHub Actions 進行自動化測試。

### 關鍵特點

#### 容器化執行

- 使用官方 Playwright Docker 映像檔 (`mcr.microsoft.com/playwright:v1.57.0`)
- 預先安裝瀏覽器，省去下載時間
- 確保環境一致性

#### 觸發條件

兩支 workflow 的觸發條件不同，因為 API 測試綁著上游後端 image、成本也高得多。

`demo.yml`（Saucedemo UI，`ui-staging`）—— 沒有外部依賴，能跑就跑：

```yaml
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  workflow_dispatch:
```

`springboot.yml`（Spring Boot API，`springboot-api`）—— 每次執行都要拉起 Oracle，因此對
PR 額外加了標籤把關：

```yaml
on:
  workflow_dispatch:      # 手動指定 image_tag (最後的保險)
  repository_dispatch:    # 上游 SpringBoot repo 推新 image 時連動
    types: [backend_image_updated]
  pull_request:           # 需再貼上 'e2e-test' 標籤才會真的跑 (見 job 的 if:)
    types: [labeled, synchronize]
    branches: [main]
  push:                   # trunk-based 下直接進 main 的小改，唯一的 CI 把關
    branches: [main]
```

job 層的閘門對 `labeled` 事件只認「**這次加的**標籤是不是 `e2e-test`」（比對
`github.event.label.name`），而不是問「這個 PR 現在有沒有 `e2e-test`」。因為一次貼多個
標籤時，GitHub 會為每個標籤各發一次 `labeled` 事件，而每次事件的 payload 都已含完整標籤
集合 —— 用 `contains()` 判斷會讓每次事件都成立，貼 N 個標籤就重複拉 N 次 Oracle。
`synchronize` 事件的 payload 沒有 `github.event.label`，那一路仍用 `contains()` 判斷標籤存在。

被測 image 的 tag 由觸發來源決定：`repository_dispatch` 取 payload 的 `image_tag`、
`workflow_dispatch` 取輸入值，`push` / `pull_request` 則固定對接 `latest`。

#### 環境變數管理

使用 GitHub Secrets 儲存敏感資訊：

```yaml
env:
  DB_USER: ${{ secrets.DB_USER }}
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
  ORACLE_TEST_USERNAME: ${{ secrets.DB_USER }}
  ORACLE_TEST_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

**必要的 Secrets**:
- `DB_USER`: 資料庫使用者名稱
- `DB_PASSWORD`: 資料庫密碼
- `GHCR_TOKEN`: GitHub Container Registry 存取權杖

### 工作流程步驟

#### 1. 登入 GHCR

```yaml
- name: Log in to GitHub Container Registry
  run: echo "${{ secrets.GHCR_TOKEN }}" | podman login ghcr.io -u ${{ github.actor }} --password-stdin
```

#### 2. 啟動測試環境

```yaml
- name: Start test environment
  run: |
    podman compose -f docker-compose.test.yml up -d
    sleep 30  # 等待服務啟動
```

#### 3. 等待健康檢查

```yaml
- name: Wait for services to be healthy
  run: |
    timeout 300 bash -c 'until podman exec oracle-db-test healthcheck.sh; do sleep 5; done'
    timeout 300 bash -c 'until curl -f http://localhost:8787/actuator/health; do sleep 5; done'
```

#### 4. 執行測試

```yaml
- name: Run Playwright tests
  run: pnpm playwright test --project=api-e2e
```

#### 5. 上傳測試報告

```yaml
- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

### 完整範例

```yaml
name: E2E Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.57.0
    
    env:
      DB_USER: ${{ secrets.DB_USER }}
      DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Log in to GHCR
        run: echo "${{ secrets.GHCR_TOKEN }}" | podman login ghcr.io -u ${{ github.actor }} --password-stdin
      
      - name: Start test environment
        run: podman compose -f docker-compose.test.yml up -d
      
      - name: Wait for services
        run: |
          timeout 300 bash -c 'until curl -f http://localhost:8787/actuator/health; do sleep 5; done'
      
      - name: Run tests
        run: pnpm playwright test --project=api-e2e
      
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Docker Compose 配置

### 服務架構

```yaml
services:
  app:
    image: ghcr.io/your-org/spring-boot-app:latest
    ports:
      - "8787:8787"
    depends_on:
      oracle-db:
        condition: service_healthy
    environment:
      - SPRING_DATASOURCE_URL=jdbc:oracle:thin:@oracle-db:1521/FREEPDB1
      - SPRING_DATASOURCE_USERNAME=${ORACLE_TEST_USERNAME}
      - SPRING_DATASOURCE_PASSWORD=${ORACLE_TEST_PASSWORD}

  oracle-db:
    image: container-registry.oracle.com/database/free:latest
    ports:
      - "1521:1521"
    environment:
      - ORACLE_PWD=${ORACLE_TEST_PASSWORD}
    volumes:
      - ./init-scripts:/opt/oracle/scripts/startup
    healthcheck:
      test: ["CMD", "healthcheck.sh"]
      interval: 10s
      timeout: 5s
      retries: 30
```

### 環境變數配置

#### Spring Boot 應用

```yaml
environment:
  - SPRING_DATASOURCE_URL=jdbc:oracle:thin:@oracle-db:1521/FREEPDB1
  - SPRING_DATASOURCE_USERNAME=${ORACLE_TEST_USERNAME}
  - SPRING_DATASOURCE_PASSWORD=${ORACLE_TEST_PASSWORD}
  - SPRING_JPA_HIBERNATE_DDL_AUTO=none
  - SPRING_FLYWAY_ENABLED=true
```

#### Oracle Database

```yaml
environment:
  - ORACLE_PWD=${ORACLE_TEST_PASSWORD}
  - ORACLE_CHARACTERSET=AL32UTF8
```

### 健康檢查

#### Oracle DB 健康檢查

```yaml
healthcheck:
  test: |
    bash -c "echo 'SELECT 1 FROM DUAL;' | 
    sqlplus -s sys/${ORACLE_TEST_PASSWORD}@//localhost:1521/FREEPDB1 as sysdba"
  interval: 10s
  timeout: 5s
  retries: 30
  start_period: 60s
```

**檢查邏輯**:
- 使用 SYS 使用者連接
- 檢查 PDB 是否處於 READ WRITE 模式
- 避免時序問題（等待 PDB 完全啟動）

#### Spring Boot 健康檢查

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8787/actuator/health"]
  interval: 10s
  timeout: 5s
  retries: 10
  start_period: 30s
```

### 初始化流程

1. **Oracle DB 啟動**
   - 容器啟動
   - 執行 `init-scripts/01_setup.sh`
   - 創建測試使用者和權限

2. **Spring Boot 啟動**
   - 等待 Oracle DB 健康檢查通過
   - 連接資料庫
   - 執行 Flyway migrate
   - 應用程式就緒

3. **測試執行**
   - 等待所有服務健康檢查通過
   - 執行 Playwright 測試

### 初始化腳本範例

```bash
#!/bin/bash
# init-scripts/01_setup.sh

sqlplus -s sys/${ORACLE_PWD}@//localhost:1521/FREEPDB1 as sysdba <<EOF
  -- 創建測試使用者
  CREATE USER ${ORACLE_TEST_USERNAME} IDENTIFIED BY ${ORACLE_TEST_PASSWORD};
  
  -- 授予權限
  GRANT CONNECT, RESOURCE TO ${ORACLE_TEST_USERNAME};
  GRANT CREATE SESSION TO ${ORACLE_TEST_USERNAME};
  GRANT CREATE TABLE TO ${ORACLE_TEST_USERNAME};
  GRANT CREATE SEQUENCE TO ${ORACLE_TEST_USERNAME};
  GRANT UNLIMITED TABLESPACE TO ${ORACLE_TEST_USERNAME};
  
  EXIT;
EOF
```

## CI/CD 策略差異

### 本地開發 vs CI 環境

| 設定項目 | CI 環境 | 本機開發 |
|---------|---------|----------|
| Retries | 2 次 | 0 次 |
| Workers | 2 | 3 |
| Reporter | List + HTML | List + HTML (時間戳記) |
| Video | Retain on Failure | Off |
| Trace | Retain on Failure | Off |
| 容器重啟 | 每次執行 | 手動控制 |

### 配置範例

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.CI
    ? [['list'], ['html']]
    : [['list'], ['html', { outputFolder: `playwright-report/${timestamp}` }]],
  use: {
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
});
```

## 疑難排解

### 容器啟動失敗

```bash
# 檢查容器狀態
podman ps -a

# 查看容器日誌
podman logs spring-boot-app-test
podman logs oracle-db-test

# 重新啟動
podman compose -f docker-compose.test.yml down -v
podman compose -f docker-compose.test.yml up -d
```

### 健康檢查超時

```yaml
# 增加等待時間
healthcheck:
  retries: 50  # 從 30 增加到 50
  start_period: 120s  # 從 60s 增加到 120s
```

### 測試連線失敗

```bash
# 確認服務正在運行
curl http://localhost:8787/actuator/health

# 檢查網路連接
podman network inspect bridge
```

## 相關文件

- [測試策略](./10-testing-strategies.md)
- [快速開始](./03-quick-start.md)
- [疑難排解](./14-troubleshooting.md)
- [GitHub Actions 文件](https://docs.github.com/en/actions)
- [Docker Compose 文件](https://docs.docker.com/compose/)