import { defineConfig, devices } from '@playwright/test';

// 外部 API 呼叫端憑證：CI 由 GitHub Secrets 帶入，本機用預設值
const API_USERNAME = process.env.API_USERNAME || 'api';
const API_PASSWORD = process.env.API_PASSWORD || 'local-api-secret';
const BASIC_AUTH = `Basic ${Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString('base64')}`;

/**
 * 建立時間戳記 (優化可讀性)
 */
function getLocalDate() {
	const now = new Date();

	// 使用解構賦值並給予預設值 ''
	const [datePart = ''] = now.toISOString().split('T');

	// 這裡同樣給予預設值，確保 timePart 永遠是 string
	const [timePart = ''] = now.toTimeString().split(' ');

	// 現在 timePart 確定是字串了，replace 不會再報錯
	const formattedTime = timePart.replace(/:/g, '-');

	return `${datePart}_${formattedTime}`;
}
process.env.PW_DATE = process.env.PW_DATE || getLocalDate();

export default defineConfig({
	testDir: './tests',
	// globalSetup: './global-setup.ts', // 暫時停用，使用容器重啟策略
	timeout: 30000,
	expect: { timeout: 5000 },
	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : 3,

	outputDir: 'test-results/',

	// CI 與本地 Reporter 區分報告產出路徑
	reporter: process.env.CI
		? [['list'], ['html', { outputFolder: 'playwright-report/', open: 'never' }]]
		: [
				['list'],
				['html', { outputFolder: `playwright-report/${process.env.PW_DATE}`, open: 'never' }],
			],

	use: {
		trace: 'off',
		screenshot: 'on-first-failure',
		video: {
			mode: 'retain-on-failure',
			size: { width: 1280, height: 960 },
		},
	},

	projects: [
		/* --- 1. UI Setup (登入預處理) --- */
		{
			name: 'ui-setup',
			testMatch: '**/saucedemo/*.setup.ts',
			use: {
				baseURL: 'https://www.saucedemo.com/',
				...devices['Desktop Chrome'],
			},
		},

		/* --- 2. UI 本地測試 (對接你的 Docker Spring Boot) --- */
		{
			name: 'springboot-api',
			testMatch: '**/springboot/*.spec.ts',
			use: {
				baseURL: process.env.BASE_URL || 'http://localhost:8787/', // 對應你 docker-compose 的 port
				// 每次請求主動帶 HTTP Basic 標頭，覆蓋全部測試與 fixtures，無 401→retry 往返
				extraHTTPHeaders: {
					Authorization: BASIC_AUTH,
				},
			},
		},

		/* --- 3. UI Staging 測試 (對接外部環境) --- */
		{
			name: 'ui-staging',
			testMatch: '**/saucedemo/*.spec.ts',
			dependencies: ['ui-setup'],
			use: {
				baseURL: 'https://www.saucedemo.com/',
				...devices['Desktop Chrome'],
			},
		},
	],
});
